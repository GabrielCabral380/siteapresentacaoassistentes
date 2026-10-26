/* Teste de ponta a ponta do Demo Interativo e da foto do grupo, num DOM simulado (jsdom).
   Rodar: npm run test:dom  (também é chamado pelos testes Python quando o jsdom está instalado). */
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const RAIZ = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf-8");
const script = fs.readFileSync(path.join(RAIZ, "js", "main.js"), "utf-8");

function montar(prepararJanela) {
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
  if (prepararJanela) prepararJanela(dom.window);
  dom.window.eval(script);
  return dom;
}

// Síntese de fala falsa: registra o que foi falado e simula início, palavras e fim.
// `comecar: false` simula um navegador que aceita speak() mas nunca começa a falar.
function vozFalsa(janela, { comecar = true, duracao = 250 } = {}) {
  const sintese = {
    faladas: [],
    cancelados: 0,
    getVoices: () => [
      { name: "Microsoft Daniel - Portuguese (Brazil)", lang: "pt-BR" },
      { name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", lang: "pt-BR" },
      { name: "Microsoft Antonio Online (Natural) - Portuguese (Brazil)", lang: "pt-BR" },
      { name: "Google US English", lang: "en-US" },
    ],
    addEventListener() {},
    cancel() { this.cancelados++; },
    speak(fala) {
      this.faladas.push(fala);
      if (!comecar) return;
      setTimeout(() => {
        fala.onstart && fala.onstart();
        fala.onboundary && fala.onboundary({ charIndex: 4 });
      }, 10);
      setTimeout(() => fala.onend && fala.onend(), duracao);
    },
  };
  janela.speechSynthesis = sintese;
  janela.SpeechSynthesisUtterance = function (texto) { this.text = texto; };
  return sintese;
}

// Reconhecimento de voz falso: os testes disparam resultado, erro e fim à mão.
function micFalso(janela) {
  const instancias = [];
  janela.webkitSpeechRecognition = function () {
    this.iniciado = false;
    this.start = () => { this.iniciado = true; };
    this.stop = () => { this.onend && this.onend(); };
    this.abort = () => { this.abortado = true; };
    instancias.push(this);
  };
  return instancias;
}

function resultado(texto, final) {
  const item = [{ transcript: texto }];
  item.isFinal = final;
  return { resultIndex: 0, results: [item] };
}

function esperar(condicao, limite = 5000) {
  const inicio = Date.now();
  return new Promise((resolve, reject) => {
    (function checar() {
      if (condicao()) return resolve();
      if (Date.now() - inicio > limite) return reject(new Error("tempo esgotado"));
      setTimeout(checar, 20);
    })();
  });
}

const testes = [];
const teste = (nome, fn) => testes.push({ nome, fn });

function partes(dom) {
  const doc = dom.window.document;
  const demo = doc.querySelector("[data-demo]");
  return {
    doc,
    demo,
    palco: demo.querySelector("[data-palco]"),
    campo: demo.querySelector(".demo-campo"),
    form: demo.querySelector(".demo-form"),
    log: demo.querySelector(".demo-log"),
    escolha: (nome) => demo.querySelector(`.demo-escolha[data-assistente="${nome}"]`),
    sugestoes: () => [...demo.querySelectorAll(".demo-sugestao")].map((b) => b.textContent),
    msgs: () => [...demo.querySelectorAll(".demo-log .demo-msg")],
    enviar(texto) {
      this.campo.value = texto;
      this.form.dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
    },
  };
}

teste("estado inicial mostra Xavier no palco", () => {
  const p = partes(montar());
  assert.equal(p.palco.querySelector("[data-palco-nome]").textContent, "Xavier");
  assert.equal(p.palco.dataset.estado, "ocioso");
  assert.equal(p.escolha("xavier").getAttribute("aria-pressed"), "true");
  assert.deepEqual(p.sugestoes(), ["Organize meus arquivos", "O que tenho na agenda amanhã?", "Leia meu WhatsApp"]);
});

teste("selecionar Maya troca tema, avatar, placeholder e sugestões", () => {
  const p = partes(montar());
  p.escolha("maya").click();
  assert.match(p.demo.className, /\btema-maya\b/);
  assert.doesNotMatch(p.demo.className, /tema-xavier/);
  assert.equal(p.escolha("maya").getAttribute("aria-pressed"), "true");
  assert.equal(p.escolha("xavier").getAttribute("aria-pressed"), "false");
  assert.equal(p.palco.querySelector("[data-palco-nome]").textContent, "Maya");
  assert.match(p.palco.querySelector("[data-palco-papel]").textContent, /Organizada/);
  assert.equal(p.campo.placeholder, "Pergunte algo para a Maya…");
  assert.equal(
    p.palco.querySelector(".avatar-svg").innerHTML,
    p.escolha("maya").querySelector(".avatar-svg").innerHTML
  );
  assert.deepEqual(p.sugestoes(), ["Acende as luzes da sala", "Como está o sistema?", "Crie uma rotina de briefing"]);
});

teste("mensagem passa por pensando → falando → ocioso e mostra a resposta", async () => {
  const p = partes(montar());
  p.escolha("maya").click();
  p.enviar("Acende a luz da sala");

  const [usuario, resposta] = p.msgs().slice(-2);
  assert.ok(usuario.classList.contains("demo-usuario"));
  assert.equal(usuario.querySelector(".demo-msg-texto").textContent, "Acende a luz da sala");
  assert.ok(resposta.classList.contains("tema-maya"));
  assert.ok(resposta.classList.contains("digitando"));
  assert.ok(resposta.querySelector(".demo-msg-avatar .avatar-svg"), "mensagem tem mini avatar");
  assert.equal(p.palco.dataset.estado, "pensando");
  assert.match(p.palco.querySelector("[data-palco-acao]").textContent, /casa/);
  assert.equal(p.log.getAttribute("aria-busy"), "true");
  assert.equal(p.campo.value, "");

  await esperar(() => p.palco.dataset.estado === "falando");
  await esperar(() => p.palco.dataset.estado === "ocioso");
  assert.match(resposta.querySelector(".demo-msg-texto").textContent, /23 °C/);
  assert.ok(!resposta.classList.contains("digitando"));
  assert.equal(p.log.getAttribute("aria-busy"), "false");
});

teste("clicar numa sugestão envia a mensagem", async () => {
  const p = partes(montar());
  p.escolha("gabriel").click();
  p.demo.querySelector(".demo-sugestao").click();
  const ultima = p.msgs().at(-1);
  assert.equal(p.msgs().at(-2).querySelector(".demo-msg-texto").textContent, "Crie um projeto novo");
  await esperar(() => p.palco.dataset.estado === "ocioso");
  assert.match(ultima.querySelector(".demo-msg-texto").textContent, /12 de 12/);
});

teste("nova mensagem ou troca de assistente conclui a resposta pendente", () => {
  const p = partes(montar());
  p.enviar("Organize meus arquivos");
  const primeira = p.msgs().at(-1);
  p.enviar("oi");
  assert.match(primeira.querySelector(".demo-msg-texto").textContent, /Downloads/);
  const segunda = p.msgs().at(-1);
  p.escolha("gabriel").click();
  assert.match(segunda.querySelector(".demo-msg-texto").textContent, /Xavier/);
  assert.equal(p.palco.dataset.estado, "ocioso");
});

teste("mensagem vazia não é enviada", () => {
  const p = partes(montar());
  const antes = p.msgs().length;
  p.enviar("    ");
  assert.equal(p.msgs().length, antes);
});

teste("texto do usuário é inserido como texto, não como HTML", () => {
  const p = partes(montar());
  p.enviar("<img src=x onerror=alert(1)>");
  const usuario = p.msgs().at(-2);
  assert.equal(usuario.querySelector("img"), null);
  assert.equal(usuario.querySelector(".demo-msg-texto").textContent, "<img src=x onerror=alert(1)>");
});

teste("sem reconhecimento de voz, o microfone mostra o aviso e o botão de voz fica oculto", () => {
  const p = partes(montar());
  const dica = p.demo.querySelector(".demo-dica");
  assert.equal(dica.hidden, true);
  assert.equal(p.demo.querySelector("[data-voz-toggle]").hidden, true);
  p.demo.querySelector(".demo-mic").click();
  assert.equal(dica.hidden, false);
  assert.match(dica.textContent, /Chrome e no Edge/);
});

teste("memória: o nome dito a um assistente é usado pelos outros", async () => {
  const p = partes(montar());
  p.enviar("Oi, meu nome é ana");
  await esperar(() => p.palco.dataset.estado === "ocioso");
  assert.match(p.msgs().at(-1).querySelector(".demo-msg-texto").textContent, /Ana/);
  assert.equal(p.palco.dataset.humor, "feliz");
  p.escolha("gabriel").click();
  p.enviar("oi");
  await esperar(() => p.palco.dataset.estado === "ocioso");
  assert.match(p.msgs().at(-1).querySelector(".demo-msg-texto").textContent, /^E aí, Ana!/);
});

teste("responder “sim” executa o que o assistente acabou de oferecer", async () => {
  const p = partes(montar());
  p.enviar("Organize meus arquivos");
  p.enviar("sim, pode");
  await esperar(() => p.palco.dataset.estado === "ocioso");
  assert.match(p.msgs().at(-1).querySelector(".demo-msg-texto").textContent, /movi os arquivos/);
  assert.match(p.palco.querySelector("[data-palco-acao]").textContent, /Executando/);
});

teste("pergunta sem tópico deixa o avatar curioso", () => {
  const p = partes(montar());
  p.enviar("xyz qualquer coisa");
  assert.equal(p.palco.dataset.humor, "curioso");
});

teste("com voz: a resposta é falada com a voz do assistente e a boca sincroniza", async () => {
  let sintese;
  const p = partes(montar((w) => { sintese = vozFalsa(w); }));
  const botao = p.demo.querySelector("[data-voz-toggle]");
  assert.equal(botao.hidden, false);
  assert.equal(botao.getAttribute("aria-pressed"), "true");

  p.escolha("maya").click();
  p.enviar("Acende a luz da sala");
  assert.equal(p.palco.dataset.estado, "pensando");
  await esperar(() => sintese.faladas.length === 1);
  const fala = sintese.faladas[0];
  assert.equal(fala.lang, "pt-BR");
  assert.match(fala.voice.name, /Francisca/);
  assert.ok(fala.pitch > 1, "Maya tem tom mais agudo");
  assert.match(fala.text, /23 graus/);
  assert.doesNotMatch(fala.text, /°/);

  await esperar(() => p.palco.dataset.estado === "falando");
  assert.ok(p.palco.classList.contains("sincronizado"));
  await esperar(() => p.palco.dataset.estado === "ocioso");
  assert.ok(!p.palco.classList.contains("sincronizado"));
  assert.match(p.msgs().at(-1).querySelector(".demo-msg-texto").textContent, /23 °C/);
});

teste("com voz: Xavier e Gabriel usam vozes masculinas diferentes", async () => {
  let sintese;
  const p = partes(montar((w) => { sintese = vozFalsa(w, { duracao: 30 }); }));
  p.enviar("oi");
  await esperar(() => p.palco.dataset.estado === "ocioso" && sintese.faladas.length === 1);
  p.escolha("gabriel").click();
  p.enviar("oi");
  await esperar(() => sintese.faladas.length === 2);
  assert.match(sintese.faladas[0].voice.name, /Antonio/);
  assert.match(sintese.faladas[1].voice.name, /Daniel/);
});

teste("desligar a voz no meio da fala cancela e mostra o texto completo", async () => {
  let sintese;
  const dom = montar((w) => { sintese = vozFalsa(w, { duracao: 5000 }); });
  const p = partes(dom);
  p.enviar("Organize meus arquivos");
  await esperar(() => p.palco.dataset.estado === "falando");
  const cancelados = sintese.cancelados;
  p.demo.querySelector("[data-voz-toggle]").click();
  assert.ok(sintese.cancelados > cancelados);
  assert.equal(p.palco.dataset.estado, "ocioso");
  assert.match(p.msgs().at(-1).querySelector(".demo-msg-texto").textContent, /37 arquivos/);
  assert.equal(p.demo.querySelector("[data-voz-toggle]").getAttribute("aria-pressed"), "false");
  assert.equal(dom.window.localStorage.getItem("demo-voz"), "0");
});

teste("se a voz não começar, a resposta cai na digitação", async () => {
  const p = partes(montar((w) => { vozFalsa(w, { comecar: false }); }));
  p.enviar("Leia meu WhatsApp");
  await esperar(() => p.palco.dataset.estado === "falando", 4000);
  await esperar(() => p.palco.dataset.estado === "ocioso");
  assert.match(p.msgs().at(-1).querySelector(".demo-msg-texto").textContent, /4 conversas/);
});

teste("microfone: ouve, mostra o texto parcial, envia e volta a ouvir depois de responder", async () => {
  let instancias;
  const p = partes(montar((w) => { vozFalsa(w, { duracao: 40 }); instancias = micFalso(w); }));
  const mic = p.demo.querySelector(".demo-mic");
  mic.click();
  assert.equal(instancias.length, 1);
  const rec = instancias[0];
  assert.ok(rec.iniciado);
  assert.equal(rec.lang, "pt-BR");
  assert.equal(p.palco.dataset.estado, "ouvindo");
  assert.ok(mic.classList.contains("ouvindo"));
  assert.equal(mic.getAttribute("aria-pressed"), "true");

  rec.onresult(resultado("que horas", false));
  assert.equal(p.campo.value, "que horas");
  rec.onresult(resultado("que horas são", true));
  rec.onend();
  assert.ok(!mic.classList.contains("ouvindo"));
  assert.equal(p.msgs().at(-2).querySelector(".demo-msg-texto").textContent, "que horas são");
  assert.match(p.palco.querySelector("[data-palco-acao]").textContent, /relógio/);

  // Modo conversa: terminada a resposta falada, o microfone abre sozinho de novo.
  await esperar(() => instancias.length === 2);
  assert.equal(p.palco.dataset.estado, "ouvindo");
  instancias[1].onerror({ error: "no-speech" });
  instancias[1].onend();
  assert.equal(p.palco.dataset.estado, "ocioso");
  assert.equal(p.demo.querySelector(".demo-dica").hidden, true, "silêncio no modo conversa não gera aviso");
});

teste("microfone bloqueado mostra como liberar", () => {
  let instancias;
  const p = partes(montar((w) => { instancias = micFalso(w); }));
  p.demo.querySelector(".demo-mic").click();
  instancias[0].onerror({ error: "not-allowed" });
  instancias[0].onend();
  const dica = p.demo.querySelector(".demo-dica");
  assert.equal(dica.hidden, false);
  assert.match(dica.textContent, /bloqueado/);
  assert.equal(p.palco.dataset.estado, "ocioso");
});

teste("segundo toque no microfone envia o que já foi ouvido; trocar de assistente cancela a escuta", () => {
  let instancias;
  const p = partes(montar((w) => { instancias = micFalso(w); }));
  const mic = p.demo.querySelector(".demo-mic");
  mic.click();
  instancias[0].onresult(resultado("organize meus arquivos", false));
  mic.click();
  assert.equal(p.msgs().at(-2).querySelector(".demo-msg-texto").textContent, "organize meus arquivos");

  mic.click();
  assert.equal(instancias.length, 2);
  p.escolha("maya").click();
  assert.ok(instancias[1].abortado);
  assert.equal(p.palco.dataset.estado, "ocioso");
  assert.ok(!mic.classList.contains("ouvindo"));
});

teste("Esc interrompe a fala", async () => {
  const p = partes(montar((w) => { vozFalsa(w, { duracao: 5000 }); }));
  p.enviar("oi");
  await esperar(() => p.palco.dataset.estado === "falando");
  p.campo.dispatchEvent(new p.doc.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(p.palco.dataset.estado, "ocioso");
});

teste("foto do grupo: AVIF/WebP -> PNG -> FAMILIA IA.png -> SVG", () => {
  const dom = montar();
  const img = dom.window.document.querySelector(".hero-familia img");
  assert.equal(img.getAttribute("src"), "img/FAMILIA-IA.png");
  assert.equal(img.parentNode.querySelectorAll("source").length, 2);
  img.dispatchEvent(new dom.window.Event("error"));
  // 1ª falha: tira as versões leves e o navegador volta ao PNG do src
  assert.equal(img.parentNode.querySelectorAll("source").length, 0);
  assert.equal(img.getAttribute("src"), "img/FAMILIA-IA.png");
  img.dispatchEvent(new dom.window.Event("error"));
  assert.equal(img.getAttribute("src"), "img/FAMILIA%20IA.png");
  img.dispatchEvent(new dom.window.Event("error"));
  assert.equal(img.getAttribute("src"), "assets/img/familia.svg");
});

(async () => {
  let falhas = 0;
  for (const { nome, fn } of testes) {
    try {
      await fn();
      console.log(`ok   ${nome}`);
    } catch (erro) {
      falhas++;
      console.log(`FALHA ${nome}\n  ${erro.stack}`);
    }
  }
  console.log(`\n${testes.length - falhas}/${testes.length} testes de DOM passaram`);
  process.exit(falhas ? 1 : 0);
})();
