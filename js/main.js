/* Interações do site: animação de entrada, menu, contador e Demo Interativo.
   O site funciona sem JS; este arquivo só adiciona refinamentos. */
(function () {
  "use strict";

  // Demo Interativo: respostas fictícias escolhidas por palavras-chave.
  // Não há IA real aqui — é só uma simulação. Os três têm as mesmas capacidades;
  // o que muda entre as respostas é o estilo de cada assistente.
  var NOMES = { xavier: "Xavier", maya: "Maya", gabriel: "Gabriel" };

  var PAPEIS = {
    xavier: "Estrategista · todas as capacidades",
    maya: "Organizada · todas as capacidades",
    gabriel: "Mão na massa · todas as capacidades"
  };

  // Atalhos de pergunta exibidos abaixo da conversa; cada um cai num tópico conhecido.
  var SUGESTOES = {
    xavier: ["Organize meus arquivos", "O que tenho na agenda amanhã?", "Leia meu WhatsApp"],
    maya: ["Acende as luzes da sala", "Como está o sistema?", "Crie uma rotina de briefing"],
    gabriel: ["Crie um projeto novo", "Tem um bug no meu código", "Olha esse print de erro"]
  };

  // ", Ana" quando o nome do visitante já é conhecido; vazio caso contrário.
  function vocativo(ctx) {
    return ctx && ctx.nome ? ", " + ctx.nome : "";
  }

  var DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  function horaAtual(ctx) {
    var d = (ctx && ctx.agora) || new Date();
    return d.getHours() + "h" + String(d.getMinutes()).padStart(2, "0");
  }

  function dataAtual(ctx) {
    var d = (ctx && ctx.agora) || new Date();
    return DIAS[d.getDay()] + ", " + d.getDate() + " de " + MESES[d.getMonth()];
  }

  // Respostas podem ser texto fixo ou função (ctx) => texto, para usar nome, hora e data.
  var TOPICOS = [
    {
      id: "saudacao",
      rotulo: "👋 Cumprimentando",
      humor: "feliz",
      chaves: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "e ai", "hey"],
      respostas: {
        xavier: function (c) { return "Olá" + vocativo(c) + "! Sou o Xavier. Posso organizar seus arquivos, pilotar o navegador ou cuidar da sua agenda. Por onde começamos?"; },
        maya: function (c) { return "Oi" + vocativo(c) + "! Aqui é a Maya. Suas rotinas estão em dia e a casa está tranquila. Em que posso ajudar?"; },
        gabriel: function (c) { return "E aí" + vocativo(c) + "! Gabriel na área. Tem algum projeto em mente? Descreva em uma frase e eu monto o plano."; }
      }
    },
    {
      id: "quem-sou",
      rotulo: "🧠 Consultando a memória",
      chaves: ["qual e meu nome", "qual meu nome", "sabe meu nome", "quem sou eu", "lembra de mim"],
      respostas: {
        xavier: function (c) { return c && c.nome ? "Claro: você é " + c.nome + ". Está guardado na memória da equipe." : "Ainda não sei o seu nome. Diga “meu nome é…” e eu guardo."; },
        maya: function (c) { return c && c.nome ? "Você é " + c.nome + "! Anotei na memória compartilhada assim que você me contou." : "Hmm, ainda não sei. Me conta: “meu nome é…” e eu anoto."; },
        gabriel: function (c) { return c && c.nome ? "Fácil: " + c.nome + ". Memória da equipe nunca falha." : "Ainda não sei! Manda um “meu nome é…” que eu salvo."; }
      }
    },
    {
      id: "horas",
      rotulo: "🕒 Conferindo o relógio",
      chaves: ["que horas", "horas sao", "que dia", "dia e hoje", "data de hoje", "dia hoje"],
      respostas: {
        xavier: function (c) { return "Agora são " + horaAtual(c) + " de " + dataAtual(c) + ". Quer que eu confira sua agenda para hoje?"; },
        maya: function (c) { return "São " + horaAtual(c) + ", " + dataAtual(c) + ". Seu próximo lembrete já está programado."; },
        gabriel: function (c) { return horaAtual(c) + " em ponto de " + dataAtual(c) + ". Dá tempo de terminar mais uma tarefa!"; }
      }
    },
    {
      id: "apresentacao",
      rotulo: "🪪 Apresentação",
      chaves: ["quem e voce", "quem e vc", "se apresente", "o que voce faz", "o que vc faz", "ajuda", "pode fazer"],
      respostas: {
        xavier: "Sou o Xavier, um dos três assistentes da equipe. Faço tudo o que a plataforma oferece: arquivos, navegador, agenda, WhatsApp, casa, visão, rotinas e código — com um jeito estrategista.",
        maya: "Sou a Maya. Tenho as mesmas capacidades do Xavier e do Gabriel — automação, agenda, casa, visão, código — e cuido de tudo com um olhar organizado e atento.",
        gabriel: "Sou o Gabriel. Compartilho o mesmo núcleo de capacidades da equipe: do WhatsApp à casa conectada, da agenda ao código. Meu estilo é direto e mão na massa."
      }
    },
    {
      id: "arquivos",
      rotulo: "📁 Organizando arquivos",
      chaves: ["arquivo", "pasta", "download", "documento", "pdf", "organiz"],
      respostas: {
        xavier: "Encontrei 37 arquivos soltos em Downloads. Separei em Documentos, Imagens e Instaladores — quer que eu mova agora?",
        maya: "Posso agendar uma rotina para organizar suas pastas toda sexta às 18h. Ativo para você?",
        gabriel: "Li a estrutura das pastas do projeto e sugeri uma organização melhor, com src/, tests/ e docs/."
      }
    },
    {
      id: "navegador",
      rotulo: "🌐 Pilotando o navegador",
      chaves: ["navegador", "site", "pesquis", "busca", "google", "internet", "web"],
      respostas: {
        xavier: "Abri o navegador, pesquisei em cinco fontes e resumi o resultado em três pontos principais. Quer ver os links?",
        maya: "Deixei uma página em monitoramento: aviso no celular assim que algo mudar.",
        gabriel: "Abri o app no navegador e conferi o layout — está tudo funcionando, inclusive no celular."
      }
    },
    {
      id: "agenda",
      rotulo: "📅 Consultando a agenda",
      chaves: ["agenda", "reuniao", "compromisso", "lembr", "alarme", "evento", "amanha"],
      respostas: {
        xavier: "Você tem duas reuniões amanhã: 9h com o time e 15h com o cliente. Quer um lembrete 15 minutos antes de cada uma?",
        maya: "Incluí a agenda de amanhã no seu briefing das 7h, junto com o clima e as notícias.",
        gabriel: "Agenda conferida: duas reuniões amanhã, às 9h e às 15h. Já deixei os lembretes prontos e exportei tudo para uma planilha."
      }
    },
    {
      id: "whatsapp",
      rotulo: "💬 Abrindo o WhatsApp",
      chaves: ["whatsapp", "zap", "mensagem", "mensagens", "contato"],
      respostas: {
        xavier: "Você tem 4 conversas não lidas. A mais urgente é do grupo do trabalho. Quer que eu leia o resumo?",
        maya: "Posso te mandar o relatório das rotinas pelo WhatsApp todo fim de tarde. Ativo?",
        gabriel: "Consigo montar um bot de WhatsApp que avisa quando os testes do seu projeto falharem."
      }
    },
    {
      id: "casa",
      rotulo: "🏠 Controlando a casa",
      chaves: ["luz", "luzes", "casa", "ar condicionado", "temperatura", "home assistant", "tomada", "lampada"],
      respostas: {
        xavier: "Feito: luzes da sala acesas em 60% e a porta da frente trancada. Quer que eu ajuste o clima também?",
        maya: "Pronto: luzes da sala acesas em tom quente e ar-condicionado em 23 °C. Quer ativar o modo cinema?",
        gabriel: "Luzes da sala acesas. Aproveitei e criei uma cena nova no Home Assistant para você usar à noite."
      }
    },
    {
      id: "visao",
      rotulo: "👁️ Analisando a imagem",
      chaves: ["tela", "print", "imagem", "foto", "camera", "ver", "olha"],
      respostas: {
        xavier: "Olhei a tela: há um erro de permissão na janela aberta. Posso clicar em \"Tentar novamente\" para você.",
        maya: "Analisei as câmeras: nenhuma movimentação estranha nas últimas horas.",
        gabriel: "Li o print do erro: falta uma dependência. Já sei qual é e como instalar."
      }
    },
    {
      id: "codigo",
      rotulo: "💻 Escrevendo código",
      chaves: ["codigo", "programa", "projeto", "app", "aplicativo", "teste", "bug", "erro", "script", "api"],
      respostas: {
        xavier: "Abri o projeto, encontrei a causa do erro e já corrigi. Rodei os testes de novo — tudo verde.",
        maya: "Corrigi o código e rodei a suíte completa. Te aviso pelo celular se algum teste voltar a falhar.",
        gabriel: "Planejei em 4 etapas: estrutura, código, testes e README. Rodei os testes — 12 de 12 passando."
      }
    },
    {
      id: "rotinas",
      rotulo: "⏱️ Criando uma rotina",
      chaves: ["rotina", "automat", "agend", "briefing", "todo dia", "toda manha"],
      respostas: {
        xavier: "Rotina criada: toda manhã às 7h eu organizo os Downloads e te mando o resumo do dia.",
        maya: "Rotina criada: todo dia às 7h eu envio o briefing com agenda, clima e status do sistema.",
        gabriel: "Escrevi a automação, testei e já deixei agendada para rodar todo dia às 7h."
      }
    },
    {
      id: "sistema",
      rotulo: "🩺 Checando o sistema",
      chaves: ["sistema", "computador", "pc", "memoria ram", "cpu", "disco", "lento", "travando"],
      respostas: {
        xavier: "Fechei dois programas que estavam consumindo muita memória. O PC deve ficar mais leve agora.",
        maya: "Saúde do sistema: CPU em 18%, memória em 54%, disco com 120 GB livres. Tudo em ordem.",
        gabriel: "Analisei os processos e encontrei um vazamento de memória em um script antigo. Quer que eu corrija?"
      }
    },
    {
      id: "agradecimento",
      rotulo: "🤝 Sempre às ordens",
      humor: "feliz",
      chaves: ["obrigad", "valeu", "vlw", "show", "perfeito"],
      respostas: {
        xavier: function (c) { return "Por nada" + vocativo(c) + "! É só chamar."; },
        maya: function (c) { return "Sempre às ordens" + vocativo(c) + ". Continuo de olho em tudo por aqui."; },
        gabriel: function (c) { return "Tamo junto" + vocativo(c) + "! Qualquer novo projeto, me chama."; }
      }
    }
  ];

  // Quando o visitante diz o próprio nome. A memória é da equipe: os três passam a usá-lo.
  var RESPOSTAS_NOME = {
    xavier: function (c) { return "Prazer" + vocativo(c) + "! Guardei seu nome na memória da equipe — a Maya e o Gabriel também vão lembrar."; },
    maya: function (c) { return "Que bom te conhecer" + vocativo(c) + "! Anotei seu nome na memória compartilhada."; },
    gabriel: function (c) { return "Fechou" + vocativo(c) + "! Nome salvo na memória da equipe. Bora trabalhar?"; }
  };

  // O que o assistente faz quando o visitante responde "sim" à pergunta anterior.
  var ACOES = {
    arquivos: "movi os arquivos para as pastas certas",
    navegador: "abri os links numa aba nova para você",
    agenda: "deixei os lembretes ativos",
    whatsapp: "li o resumo das conversas e marquei tudo como lido",
    casa: "ativei a cena e ajustei o clima",
    visao: "resolvi o que estava na tela",
    codigo: "salvei a correção e deixei os testes rodando",
    rotinas: "ativei a rotina",
    sistema: "apliquei o ajuste e o sistema ficou mais leve",
    horas: "conferi a agenda: nada urgente nas próximas horas"
  };

  var CONFIRMAR = {
    xavier: function (acao, c) { return "Feito" + vocativo(c) + ". Já " + acao + ". Mais alguma coisa?"; },
    maya: function (acao, c) { return "Prontinho" + vocativo(c) + "! Já " + acao + " e registrei no seu histórico."; },
    gabriel: function (acao, c) { return "Bora! Já " + acao + ". Qual é o próximo?"; }
  };

  var RECUSAR = {
    xavier: "Tudo bem, deixo como está. Se mudar de ideia, é só pedir.",
    maya: "Sem problemas, fica anotado para depois.",
    gabriel: "Beleza, deixa quieto. Me chama quando quiser."
  };

  var SIM = /^(sim|s|pode|quero|claro|ok|okay|isso|ativa|ative|ativar|manda|bora|faz|faca|beleza|com certeza|por favor|move|mova|confere|confira|leia|le)\b/;
  var NAO = /^(nao|n|agora nao|deixa|melhor nao|depois|nem)\b/;

  var PADRAO = {
    xavier: "Entendi. Nesta demonstração eu só simulo respostas, mas na versão real eu executaria isso no seu computador. Tente perguntar sobre arquivos, agenda ou WhatsApp.",
    maya: "Anotado. Nesta demo as respostas são simuladas — experimente perguntar sobre a casa, rotinas ou a saúde do sistema.",
    gabriel: "Boa pergunta. Aqui as respostas são simuladas — pergunte sobre código, testes ou um projeto que você quer criar."
  };

  // Minúsculas, sem acentos e sem pontuação, para comparar palavras-chave.
  function normalizarTexto(texto) {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Chaves curtas ("oi", "ver") só contam como palavra inteira; as demais também como prefixo.
  function contemChave(texto, chave) {
    var palavras = " " + texto + " ";
    if (chave.length <= 3) return palavras.indexOf(" " + chave + " ") !== -1;
    return palavras.indexOf(" " + chave) !== -1;
  }

  // "meu nome é ana" / "me chamo Ana" / "pode me chamar de Ana" → "Ana". Sem nome → "".
  function extrairNome(texto) {
    var achado = (texto || "").match(/(?:meu nome (?:é|e)|me chamo|pode me chamar de)\s+([a-zà-öø-ÿ]{2,20})/i);
    if (!achado) return "";
    var nome = achado[1].toLowerCase();
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  }

  function topicoDoTexto(texto) {
    for (var i = 0; i < TOPICOS.length; i++) {
      for (var j = 0; j < TOPICOS[i].chaves.length; j++) {
        if (contemChave(texto, TOPICOS[i].chaves[j])) return TOPICOS[i];
      }
    }
    return null;
  }

  // Descobre o tópico da pergunta: { topico, rotulo, resposta, humor } (+ nome, se o visitante se apresentou).
  // `contexto` é opcional: { nome, ultimoTopico } — permite responder "sim"/"não" à pergunta anterior
  // e chamar o visitante pelo nome.
  function analisarPergunta(pergunta, assistente, contexto) {
    if (!NOMES[assistente]) assistente = "xavier";
    var ctx = contexto || {};
    var texto = normalizarTexto(pergunta);
    if (!texto) return { topico: "vazio", rotulo: "✍️ Aguardando", resposta: "Pode digitar sua pergunta — estou ouvindo.", humor: "neutro" };

    var nome = extrairNome(pergunta);
    if (nome) {
      return { topico: "nome", rotulo: "🧠 Guardando na memória", humor: "feliz", nome: nome,
               resposta: RESPOSTAS_NOME[assistente]({ nome: nome }) };
    }

    var topico = topicoDoTexto(texto);
    var curto = texto.split(" ").length <= 6;
    var mesmoAssunto = !topico || topico.id === ctx.ultimoTopico;
    if (ACOES[ctx.ultimoTopico] && curto && mesmoAssunto) {
      if (NAO.test(texto)) return { topico: "recusar", rotulo: "👌 Tudo bem", resposta: RECUSAR[assistente], humor: "neutro" };
      if (SIM.test(texto)) {
        return { topico: "confirmar", rotulo: "✅ Executando", humor: "feliz",
                 resposta: CONFIRMAR[assistente](ACOES[ctx.ultimoTopico], ctx) };
      }
    }

    if (topico) {
      var resposta = topico.respostas[assistente];
      return { topico: topico.id, rotulo: topico.rotulo, humor: topico.humor || "neutro",
               resposta: typeof resposta === "function" ? resposta(ctx) : resposta };
    }
    return { topico: "padrao", rotulo: "💡 Simulação", resposta: PADRAO[assistente], humor: "curioso" };
  }

  // ---------- Voz ----------
  // Tom e velocidade da síntese de fala de cada assistente (Web Speech API, nativa do navegador).
  var PERFIS_VOZ = {
    xavier: { tom: 0.9, velocidade: 1, genero: "m" },
    maya: { tom: 1.12, velocidade: 1.04, genero: "f" },
    gabriel: { tom: 1.05, velocidade: 1.12, genero: "m" }
  };

  var VOZES_FEMININAS = /francisca|thalita|maria|luciana|vit[oó]ria|helena|raquel|fernanda|leila|yara|brenda|giovanna|manuela|elza|joana|female|feminin|mulher/i;
  var VOZES_MASCULINAS = /ant[oô]nio|daniel|felipe|donato|f[aá]bio|j[uú]lio|nicolau|val[eé]rio|humberto|duarte|cristiano|male|masculin|homem/i;

  // Vozes "naturais"/neurais soam muito melhor; depois as do Google; depois o resto.
  function qualidadeVoz(voz) {
    var nome = voz.name || "";
    if (/natural|neural/i.test(nome)) return 0;
    if (/google/i.test(nome)) return 1;
    return 2;
  }

  // Escolhe a voz em português (de preferência pt-BR) que combina com o assistente.
  // Xavier e Gabriel ficam com vozes masculinas diferentes quando houver mais de uma.
  function escolherVoz(vozes, assistente) {
    var perfil = PERFIS_VOZ[assistente] || PERFIS_VOZ.xavier;
    var lingua = function (v) { return String(v.lang || "").replace("_", "-").toLowerCase(); };
    var pt = Array.prototype.filter.call(vozes || [], function (v) { return lingua(v).indexOf("pt") === 0; });
    if (!pt.length) return null;
    var br = pt.filter(function (v) { return lingua(v) === "pt-br"; });
    var lista = (br.length ? br : pt).slice().sort(function (a, b) { return qualidadeVoz(a) - qualidadeVoz(b); });
    var femininas = lista.filter(function (v) { return VOZES_FEMININAS.test(v.name); });
    var masculinas = lista.filter(function (v) { return VOZES_MASCULINAS.test(v.name) && !VOZES_FEMININAS.test(v.name); });
    if (perfil.genero === "f") return femininas[0] || lista[0];
    if (assistente === "gabriel" && masculinas.length > 1) return masculinas[1];
    return masculinas[0] || lista[0];
  }

  // Texto que vai para a síntese de fala: sem emojis e com abreviações lidas por extenso.
  function textoParaFala(texto) {
    return (texto || "")
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
      .replace(/\s*°\s*C\b/g, " graus")
      .replace(/(\d+)h(\d{2})\b/g, "$1 horas e $2")
      .replace(/(\d+)\s*h\b/g, "$1 horas")
      .replace(/(\d+)\s*%/g, "$1 por cento")
      .replace(/(\d+)\s*GB\b/g, "$1 gigas")
      .replace(/[“”"]/g, "")
      .replace(/(\w)\/(?=[\s,.;:!?)]|$)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Quanto a boca abre (0 a 1) em cada letra: vogais abertas abrem mais, m/b/p fecham os lábios.
  function aberturaBoca(caractere) {
    var c = normalizarTexto(caractere || "");
    if (!c) return 0;
    if (c === "a") return 1;
    if (c === "e" || c === "o") return 0.75;
    if (c === "i" || c === "u") return 0.5;
    if (c === "m" || c === "b" || c === "p") return 0.05;
    return 0.35;
  }

  function responderDemo(pergunta, assistente) {
    return analisarPergunta(pergunta, assistente).resposta;
  }

  function sugestoesDemo(assistente) {
    return (SUGESTOES[assistente] || SUGESTOES.xavier).slice();
  }

  function placeholderDemo(assistente) {
    if (!NOMES[assistente]) assistente = "xavier";
    return "Pergunte algo para " + (assistente === "maya" ? "a " : "o ") + NOMES[assistente] + "…";
  }

  // Quadros do efeito de digitação: prefixos crescentes do texto, `porQuadro` caracteres por vez.
  // Usa Array.from para não partir emojis ao meio.
  function etapasDigitacao(texto, porQuadro) {
    var letras = Array.from(texto || "");
    var passo = Math.max(1, Math.floor(porQuadro) || 1);
    var quadros = [];
    for (var i = passo; i < letras.length; i += passo) quadros.push(letras.slice(0, i).join(""));
    if (letras.length) quadros.push(letras.join(""));
    return quadros;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      normalizarTexto: normalizarTexto,
      analisarPergunta: analisarPergunta,
      responderDemo: responderDemo,
      sugestoesDemo: sugestoesDemo,
      placeholderDemo: placeholderDemo,
      etapasDigitacao: etapasDigitacao,
      extrairNome: extrairNome,
      escolherVoz: escolherVoz,
      textoParaFala: textoParaFala,
      aberturaBoca: aberturaBoca,
      NOMES: NOMES,
      PAPEIS: PAPEIS,
      PERFIS_VOZ: PERFIS_VOZ
    };
    return;
  }

  var doc = document;
  doc.documentElement.classList.add("js");

  // Menu: topo opaco ao rolar e fecha o menu móvel ao escolher um link.
  var topo = doc.querySelector(".topo");
  var toggle = doc.getElementById("menu-toggle");
  window.addEventListener("scroll", function () {
    topo.classList.toggle("rolado", window.scrollY > 20);
  }, { passive: true });
  doc.querySelectorAll(".menu a").forEach(function (link) {
    link.addEventListener("click", function () { toggle.checked = false; });
  });

  // Contador de capacidades: soma os itens da seção de capacidades compartilhadas.
  var contador = doc.querySelector("[data-contador]");
  if (contador) contador.textContent = doc.querySelectorAll(".capacidade li").length + "+";

  // Animação de entrada e destaque da seção ativa no menu.
  if ("IntersectionObserver" in window) {
    var revelar = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visivel");
          revelar.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    doc.querySelectorAll(".revelar").forEach(function (el) { revelar.observe(el); });

    var linksMenu = doc.querySelectorAll(".menu a[href^='#']");
    var secoes = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        linksMenu.forEach(function (a) {
          a.classList.toggle("ativo", a.getAttribute("href") === "#" + e.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    doc.querySelectorAll("main section[id]").forEach(function (s) { secoes.observe(s); });
  } else {
    doc.querySelectorAll(".revelar").forEach(function (el) { el.classList.add("visivel"); });
  }

  // Demo Interativo: avatar vivo (olhar, expressões, boca sincronizada), conversa com memória,
  // voz de saída (speechSynthesis) e de entrada (SpeechRecognition), tudo nativo do navegador.
  // Sem suporte a voz, a demo continua igual: digitação animada e aviso no microfone.
  var demo = doc.querySelector("[data-demo]");
  if (demo) {
    var form = demo.querySelector(".demo-form");
    var campo = demo.querySelector(".demo-campo");
    var log = demo.querySelector(".demo-log");
    var mic = demo.querySelector(".demo-mic");
    var dica = demo.querySelector(".demo-dica");
    var escolhas = demo.querySelectorAll(".demo-escolha");
    var sugestoes = demo.querySelector(".demo-sugestoes");
    var palco = demo.querySelector("[data-palco]");
    var palcoAvatar = palco.querySelector(".avatar-svg");
    var palcoNome = palco.querySelector("[data-palco-nome]");
    var palcoPapel = palco.querySelector("[data-palco-papel]");
    var palcoStatus = palco.querySelector("[data-palco-status]");
    var palcoAcao = palco.querySelector("[data-palco-acao]");
    var vozBotao = demo.querySelector("[data-voz-toggle]");
    var vozRotulo = demo.querySelector("[data-voz-rotulo]");
    var semAnimacao = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var sintese = window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null;
    var Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    var STATUS = {
      ocioso: "Online · pronto para ajudar",
      pensando: "Pensando…",
      falando: "Respondendo…",
      ouvindo: "Ouvindo você…"
    };
    var ACAO_INICIAL = "💡 Escolha um atalho, digite ou fale";
    var atual = "xavier";
    var pendente = null;
    var contexto = { nome: "", ultimoTopico: "" }; // memória compartilhada pelos três
    var vozLigada = false;
    var vozes = [];
    var ouvinte = null;        // reconhecimento de voz em andamento
    var modoConversa = false;  // a última pergunta foi falada: volta a ouvir depois da resposta

    var avatarDe = function (nome) {
      return demo.querySelector('.demo-escolha[data-assistente="' + nome + '"] .avatar-svg');
    };

    var definirEstado = function (estado, rotulo) {
      palco.dataset.estado = estado;
      palcoStatus.textContent = STATUS[estado];
      if (rotulo) palcoAcao.textContent = rotulo;
    };

    var avisar = function (texto) {
      dica.textContent = texto || "";
      dica.hidden = !texto;
    };

    var rolar = function () { log.scrollTop = log.scrollHeight; };

    // Boca: o alvo muda a cada letra falada/digitada e um laço suaviza o movimento.
    var boca = { alvo: 0, atual: 0, laco: 0 };
    var animarBoca = function () {
      boca.atual += (boca.alvo - boca.atual) * 0.45;
      palco.style.setProperty("--boca", boca.atual.toFixed(3));
      boca.laco = requestAnimationFrame(animarBoca);
    };
    var iniciarBoca = function () {
      if (semAnimacao || boca.laco || !window.requestAnimationFrame) return;
      palco.classList.add("sincronizado");
      boca.laco = requestAnimationFrame(animarBoca);
    };
    var pararBoca = function () {
      if (boca.laco) cancelAnimationFrame(boca.laco);
      boca.laco = 0;
      boca.alvo = boca.atual = 0;
      palco.style.setProperty("--boca", "0");
      palco.classList.remove("sincronizado");
    };

    // Mensagem: [avatar] balão com nome e texto. Retorna o elemento do texto.
    var adicionar = function (autor, texto, classe, quem) {
      var msg = doc.createElement("div");
      msg.className = "demo-msg " + classe;
      if (quem) {
        var mini = doc.createElement("span");
        mini.className = "demo-msg-avatar";
        mini.appendChild(avatarDe(quem).cloneNode(true));
        msg.appendChild(mini);
      }
      var balao = doc.createElement("p");
      balao.className = "demo-msg-balao";
      var nome = doc.createElement("strong");
      nome.textContent = autor;
      var corpo = doc.createElement("span");
      corpo.className = "demo-msg-texto";
      corpo.textContent = texto;
      balao.appendChild(nome);
      balao.appendChild(corpo);
      msg.appendChild(balao);
      log.appendChild(msg);
      rolar();
      return corpo;
    };

    // Solta os eventos da fala antes de cancelar, para que um "end" atrasado não encerre a próxima resposta.
    var calarFala = function (tarefa) {
      if (!tarefa.fala) return;
      tarefa.fala.onstart = tarefa.fala.onend = tarefa.fala.onerror = tarefa.fala.onboundary = null;
      tarefa.fala = null;
      sintese.cancel();
    };

    // Encerra a resposta em andamento mostrando o texto completo.
    var concluir = function () {
      if (!pendente) return;
      var tarefa = pendente;
      pendente = null;
      clearTimeout(tarefa.timer);
      clearInterval(tarefa.intervalo);
      calarFala(tarefa);
      pararBoca();
      tarefa.corpo.textContent = tarefa.resposta;
      tarefa.corpo.closest(".demo-msg").classList.remove("digitando");
      log.setAttribute("aria-busy", "false");
      definirEstado("ocioso");
      rolar();
    };

    // Resposta só em texto: digitação letra a letra com a boca acompanhando.
    var digitar = function (tarefa) {
      definirEstado("falando");
      tarefa.corpo.closest(".demo-msg").classList.remove("digitando");
      iniciarBoca();
      var letras = Array.from(tarefa.resposta);
      var quadros = etapasDigitacao(tarefa.resposta, 2);
      var i = 0;
      tarefa.intervalo = setInterval(function () {
        var quadro = quadros[i++];
        tarefa.corpo.textContent = quadro;
        boca.alvo = aberturaBoca(letras[Array.from(quadro).length - 1]);
        rolar();
        if (i >= quadros.length) concluir();
      }, 24);
    };

    // Resposta falada: o texto aparece no ritmo da voz e a boca segue a letra que está sendo dita.
    // O evento "boundary" (palavra a palavra) corrige a estimativa quando o navegador o envia.
    var falar = function (tarefa) {
      var falado = textoParaFala(tarefa.resposta);
      var perfil = PERFIS_VOZ[tarefa.quem];
      var fala = new window.SpeechSynthesisUtterance(falado);
      fala.lang = "pt-BR";
      fala.pitch = perfil.tom;
      fala.rate = perfil.velocidade;
      var voz = escolherVoz(vozes, tarefa.quem);
      if (voz) fala.voice = voz;

      var letras = Array.from(tarefa.resposta);
      var letrasPorSegundo = 14 * perfil.velocidade;
      var base = 0;
      var inicio = 0;
      var mostradas = 0;
      var acompanhar = function () {
        var pos = base + (Date.now() - inicio) / 1000 * letrasPorSegundo;
        var n = semAnimacao ? letras.length : Math.round(letras.length * Math.min(1, pos / Math.max(1, falado.length)));
        if (n > mostradas) {
          mostradas = n;
          tarefa.corpo.textContent = letras.slice(0, Math.max(1, n)).join("");
          rolar();
        }
        // Se a estimativa terminou antes da voz, a boca continua num ritmo genérico até o "end".
        boca.alvo = pos < falado.length ? aberturaBoca(falado.charAt(Math.floor(pos))) * (0.75 + Math.random() * 0.25)
                                        : 0.2 + Math.random() * 0.5;
      };

      fala.onstart = function () {
        if (pendente !== tarefa) return;
        clearTimeout(tarefa.timer);
        inicio = Date.now();
        definirEstado("falando");
        tarefa.corpo.closest(".demo-msg").classList.remove("digitando");
        iniciarBoca();
        acompanhar();
        tarefa.intervalo = setInterval(acompanhar, 50);
      };
      fala.onboundary = function (e) {
        if (pendente !== tarefa || typeof e.charIndex !== "number") return;
        base = e.charIndex;
        inicio = Date.now();
      };
      fala.onend = function () {
        if (pendente !== tarefa) return;
        concluir();
        continuarConversa();
      };
      fala.onerror = function () {
        if (pendente !== tarefa) return;
        clearTimeout(tarefa.timer);
        clearInterval(tarefa.intervalo);
        calarFala(tarefa);
        digitar(tarefa);
      };

      tarefa.fala = fala;
      sintese.cancel();
      sintese.speak(fala);
      // Se a voz não começar (sem vozes instaladas, aba em segundo plano), cai na digitação.
      tarefa.timer = setTimeout(function () {
        if (pendente !== tarefa || palco.dataset.estado === "falando") return;
        calarFala(tarefa);
        digitar(tarefa);
      }, 2500);
    };

    var montarSugestoes = function (nome) {
      sugestoes.textContent = "";
      sugestoesDemo(nome).forEach(function (texto) {
        var botao = doc.createElement("button");
        botao.type = "button";
        botao.className = "demo-sugestao";
        botao.textContent = texto;
        botao.addEventListener("click", function () { enviar(texto); });
        sugestoes.appendChild(botao);
      });
    };

    var selecionar = function (nome) {
      pararDeOuvir();
      concluir();
      modoConversa = false;
      atual = nome;
      contexto.ultimoTopico = "";
      escolhas.forEach(function (b) {
        var ativo = b.dataset.assistente === nome;
        b.classList.toggle("ativo", ativo);
        b.setAttribute("aria-pressed", String(ativo));
      });
      demo.className = demo.className.replace(/\btema-\w+/, "tema-" + nome);
      palcoAvatar.innerHTML = avatarDe(nome).innerHTML;
      palcoNome.textContent = NOMES[nome];
      palcoPapel.textContent = PAPEIS[nome];
      palco.dataset.humor = "neutro";
      campo.placeholder = placeholderDemo(nome);
      definirEstado("ocioso", ACAO_INICIAL);
      montarSugestoes(nome);
      palco.classList.remove("trocando");
      void palco.offsetWidth; // reinicia a animação de entrada
      palco.classList.add("trocando");
    };

    var enviar = function (pergunta, porVoz) {
      pergunta = (pergunta || "").trim();
      if (!pergunta) { campo.focus(); return; }
      if (!porVoz) { modoConversa = false; pararDeOuvir(); }
      concluir();
      avisar("");
      adicionar("Você", pergunta, "demo-usuario");
      campo.value = "";
      var quem = atual;
      var analise = analisarPergunta(pergunta, quem, contexto);
      if (analise.nome) contexto.nome = analise.nome;
      contexto.ultimoTopico = analise.topico;
      var corpo = adicionar(NOMES[quem], "digitando…", "demo-assistente digitando tema-" + quem, quem);
      var tarefa = { corpo: corpo, resposta: analise.resposta, quem: quem, timer: null, intervalo: null, fala: null };
      pendente = tarefa;
      log.setAttribute("aria-busy", "true");
      palco.dataset.humor = analise.humor || "neutro";
      definirEstado("pensando", analise.rotulo);

      if (vozLigada) {
        tarefa.timer = setTimeout(function () { falar(tarefa); }, semAnimacao ? 0 : 700);
        return;
      }
      if (semAnimacao) { concluir(); return; }
      tarefa.timer = setTimeout(function () { digitar(tarefa); }, 700);
    };

    // ---------- Voz de saída ----------
    var carregarVozes = function () { vozes = sintese.getVoices() || []; };

    var ajustarVoz = function (ligada) {
      vozLigada = !!(ligada && sintese);
      if (!vozLigada && pendente && pendente.fala) concluir();
      if (!vozLigada) modoConversa = false;
      vozBotao.setAttribute("aria-pressed", String(vozLigada));
      vozBotao.classList.toggle("ativo", vozLigada);
      vozRotulo.textContent = vozLigada ? "Voz ligada" : "Voz desligada";
      try { window.localStorage.setItem("demo-voz", vozLigada ? "1" : "0"); } catch (e) { /* modo privado */ }
    };

    if (sintese) {
      carregarVozes();
      if (sintese.addEventListener) sintese.addEventListener("voiceschanged", carregarVozes);
      vozBotao.hidden = false;
      var salvo = null;
      try { salvo = window.localStorage.getItem("demo-voz"); } catch (e) { /* modo privado */ }
      ajustarVoz(salvo !== "0");
      vozBotao.addEventListener("click", function () { ajustarVoz(!vozLigada); });
    }

    // ---------- Voz de entrada ----------
    var ERROS_MIC = {
      "not-allowed": "🎙️ O microfone foi bloqueado. Libere o acesso nas permissões do navegador (o site precisa estar em https ou localhost).",
      "service-not-allowed": "🎙️ O navegador não liberou o reconhecimento de voz nesta página. Abra o site em https ou localhost.",
      "audio-capture": "🎙️ Nenhum microfone encontrado. Conecte um e tente de novo.",
      "network": "🎙️ O reconhecimento de voz deste navegador precisa de internet.",
      "no-speech": "🎙️ Não ouvi nada. Toque no microfone e fale de novo."
    };

    var marcarMic = function (ativo) {
      mic.classList.toggle("ouvindo", ativo);
      mic.setAttribute("aria-pressed", String(ativo));
    };

    function pararDeOuvir() {
      if (!ouvinte) return;
      var rec = ouvinte;
      ouvinte = null;
      rec.onresult = rec.onerror = rec.onend = null;
      try { rec.abort(); } catch (e) { /* já parado */ }
      marcarMic(false);
      if (palco.dataset.estado === "ouvindo") definirEstado("ocioso", ACAO_INICIAL);
    }

    var ouvir = function (automatico) {
      pararDeOuvir();
      concluir();
      var rec = new Reconhecimento();
      rec.lang = "pt-BR";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      var falado = "";
      var parcial = "";
      var erro = "";
      rec.onresult = function (e) {
        parcial = "";
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) falado += e.results[i][0].transcript;
          else parcial += e.results[i][0].transcript;
        }
        campo.value = (falado + parcial).trim();
      };
      rec.onerror = function (e) {
        // Em modo conversa, silêncio só encerra a escuta, sem aviso.
        erro = automatico && e.error === "no-speech" ? "" : (ERROS_MIC[e.error] || "🎙️ Não consegui ouvir agora. Tente de novo ou digite.");
      };
      rec.onend = function () {
        if (ouvinte !== rec) return;
        ouvinte = null;
        marcarMic(false);
        var texto = (falado || parcial).trim();
        if (texto) {
          modoConversa = true;
          enviar(texto, true);
        } else {
          modoConversa = false;
          campo.value = "";
          definirEstado("ocioso", ACAO_INICIAL);
          avisar(erro);
        }
      };
      ouvinte = rec;
      modoConversa = false;
      campo.value = "";
      avisar("");
      marcarMic(true);
      palco.dataset.humor = "neutro";
      definirEstado("ouvindo", "🎙️ Pode falar, estou ouvindo");
      try {
        rec.start();
      } catch (e) {
        ouvinte = null;
        marcarMic(false);
        definirEstado("ocioso", ACAO_INICIAL);
        avisar("🎙️ Não consegui abrir o microfone agora. Tente de novo.");
      }
    };

    // Conversa mãos-livres: depois de responder em voz alta a uma pergunta falada, volta a ouvir.
    function continuarConversa() {
      if (modoConversa && Reconhecimento && vozLigada) ouvir(true);
    }

    mic.addEventListener("click", function () {
      if (!Reconhecimento) {
        avisar("🎙️ Este navegador não reconhece voz (funciona no Chrome e no Edge). Digite sua mensagem" +
               (sintese ? " — a resposta continua sendo falada." : "."));
        mic.classList.add("ouvindo");
        setTimeout(function () { mic.classList.remove("ouvindo"); }, 1600);
        return;
      }
      if (ouvinte) { ouvinte.stop(); return; } // segundo toque: envia o que já foi ouvido
      ouvir(false);
    });

    // ---------- Olhar e expressões ----------
    var olhar = function (x, y) {
      palco.style.setProperty("--olhar-x", x.toFixed(2) + "px");
      palco.style.setProperty("--olhar-y", y.toFixed(2) + "px");
    };
    var limitar = function (v) { return Math.max(-1, Math.min(1, v)); };
    var ponteiro = { x: 0, y: 0, quando: 0, quadro: 0 };

    if (!semAnimacao && window.requestAnimationFrame) {
      // Os olhos do avatar acompanham o ponteiro dentro da demo.
      demo.addEventListener("pointermove", function (e) {
        ponteiro.x = e.clientX;
        ponteiro.y = e.clientY;
        ponteiro.quando = Date.now();
        if (ponteiro.quadro) return;
        ponteiro.quadro = requestAnimationFrame(function () {
          ponteiro.quadro = 0;
          var r = palcoAvatar.getBoundingClientRect();
          olhar(limitar((ponteiro.x - r.left - r.width / 2) / 280) * 4,
                limitar((ponteiro.y - r.top - r.height / 2) / 280) * 3);
        });
      });
      demo.addEventListener("pointerleave", function () { olhar(0, 0); });
      // Parado, o avatar dá uma olhada ao redor de vez em quando.
      setInterval(function () {
        if (Date.now() - ponteiro.quando < 4000 || palco.dataset.estado !== "ocioso") return;
        olhar((Math.random() * 2 - 1) * 3, (Math.random() * 2 - 1) * 2);
      }, 3200);
    }

    escolhas.forEach(function (botao) {
      botao.addEventListener("click", function () { selecionar(botao.dataset.assistente); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      enviar(campo.value);
    });

    // Esc interrompe a fala ou a escuta.
    demo.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      modoConversa = false;
      pararDeOuvir();
      concluir();
    });

    selecionar(atual);
    palco.classList.remove("trocando");
  }
})();
