/* Avatares 3D de Xavier, Maya e Gabriel (Three.js, js/vendor/three.min.js).
 *
 * Cada elemento [data-avatar3d="xavier|maya|gabriel"] ganha um <canvas> com o personagem modelado
 * em 3D. Um único WebGLRenderer desenha todas as cenas e copia cada quadro para o canvas do avatar,
 * então a página usa só um contexto WebGL, por mais avatares que existam.
 *
 * Animações: respiração, piscar, cabeça e olhos seguindo o mouse (ou o último toque), aceno ao
 * aparecer na tela, ao passar o mouse e ao clicar/tocar, e boca falando nos cartões [data-avatar3d-fala].
 * data-avatar3d-modo="busto" mostra do peito para cima (com o braço acenando); "rosto" enquadra a cabeça.
 *
 * Carregamento sob demanda: este arquivo é pequeno e não bloqueia a página. O Three.js (~670 KB, ~170 KB
 * comprimido pelo servidor) só é baixado quando um avatar chega perto da tela (IntersectionObserver com
 * margem) ou, em conexões rápidas, quando o navegador fica ocioso depois do "load". Antes disso um teste
 * de WebGL de 1 px evita baixar o Three.js em navegadores que não conseguiriam usá-lo. Com "economia de
 * dados" ligada (Save-Data / prefers-reduced-data) ficam as fotos leves (AVIF/WebP); ?avatares3d=1 força o 3D
 * e ?avatares3d=0 desliga.
 *
 * Visual: iluminação de estúdio por ambiente (PMREM gerado na hora, sem arquivos HDR), materiais físicos
 * (pele com sheen, olhos com verniz), tone mapping ACES e resolução adaptativa que baixa a densidade de
 * pixels se o aparelho não sustentar a animação fluida e volta a subir quando sobra folga.
 *
 * Sem Three.js ou sem WebGL as fotos originais (<img> dentro do elemento) continuam visíveis e um aviso
 * discreto explica o motivo, para a troca silenciosa não parecer "nada mudou".
 * <html data-avatares3d="carregando|ativo|motivo"> mostra o estado (também em window.Avatares3D).
 */
(function () {
  "use strict";

  var api = { ativo: false, motivo: "", vistas: [], acenar: function () { return false; } };
  window.Avatares3D = api;

  var elementos = document.querySelectorAll("[data-avatar3d]");
  if (!elementos.length) { api.motivo = "sem-elementos"; return; }

  var VERSAO_THREE = "0.159.0";
  var scriptAtual = document.currentScript;
  var urlThree = (scriptAtual && scriptAtual.src
    ? scriptAtual.src.replace(/avatares3d\.js(\?.*)?$/, "")
    : "js/") + "vendor/three.min.js?v=" + VERSAO_THREE;

  var preferencia = (location.search.match(/[?&]avatares3d=(\w+)/) || [])[1];
  var conexao = navigator.connection || {};
  if (preferencia === "0") { naoUsar("desligado"); return; }
  if (preferencia !== "1" && (conexao.saveData ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-data: reduce)").matches))) {
    naoUsar("economia-dados");
    return;
  }
  if (!window.THREE && !temWebGL()) { falhar("sem-webgl"); return; }

  /* Escolha consciente (não é falha): só marca o estado e deixa as fotos, sem aviso. */
  function naoUsar(motivo) {
    api.motivo = motivo;
    document.documentElement.setAttribute("data-avatares3d", motivo);
  }

  /* Teste de WebGL num canvas de 1 px, liberado em seguida (não ocupa contexto de GPU). */
  function temWebGL() {
    try {
      var c = document.createElement("canvas");
      c.width = c.height = 1;
      var gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) return false;
      var perder = gl.getExtension("WEBGL_lose_context");
      if (perder) perder.loseContext();
      return true;
    } catch (erro) {
      return false;
    }
  }

  /* ---------------- Carregamento sob demanda do Three.js ---------------- */
  var pedido = false;
  function carregarThree() {
    if (pedido) return;
    pedido = true;
    if (vigia) vigia.disconnect();
    if (window.THREE) { iniciar(); return; }
    var s = document.createElement("script");
    s.src = urlThree;
    s.async = true;
    s.onload = function () { if (window.THREE) iniciar(); else falhar("sem-three"); };
    s.onerror = function () { falhar("sem-three"); };
    document.head.appendChild(s);
  }

  api.motivo = "aguardando";
  document.documentElement.setAttribute("data-avatares3d", "carregando");
  api.carregar = carregarThree;

  var vigia = null;
  if (window.THREE) {
    carregarThree();
  } else if ("IntersectionObserver" in window) {
    // Começa a baixar um pouco antes de o avatar entrar na tela, para ele já aparecer pronto.
    vigia = new IntersectionObserver(function (entradas) {
      if (entradas.some(function (e) { return e.isIntersecting; })) carregarThree();
    }, { rootMargin: "600px 0px" });
    Array.prototype.forEach.call(elementos, function (el) { vigia.observe(el); });
    // Conexão rápida: aproveita o tempo ocioso após o "load" para deixar tudo pronto antes da rolagem.
    if (!conexao.effectiveType || conexao.effectiveType === "4g") {
      var quandoOcioso = function () {
        if (window.requestIdleCallback) requestIdleCallback(carregarThree, { timeout: 4000 });
        else setTimeout(carregarThree, 1500);
      };
      if (document.readyState === "complete") quandoOcioso();
      else window.addEventListener("load", quandoOcioso, { once: true });
    }
  } else {
    carregarThree();
  }

  function falhar(motivo) {
    api.ativo = false;
    api.motivo = motivo;
    document.documentElement.setAttribute("data-avatares3d", motivo);
    if (window.console) console.warn("Avatares 3D desativados (" + motivo + "); exibindo as fotos.");
    if (document.querySelector(".avatar3d-aviso")) return;
    var textos = {
      "sem-three": "não foi possível carregar js/vendor/three.min.js",
      "sem-webgl": "este navegador está sem WebGL (ative a aceleração de hardware)",
      "contexto-perdido": "a placa de vídeo interrompeu o WebGL; recarregue a página",
      "erro-montagem": "erro ao montar os personagens"
    };
    var aviso = document.createElement("div");
    aviso.className = "avatar3d-aviso";
    aviso.setAttribute("role", "status");
    aviso.textContent = "Avatares 3D indisponíveis: " + (textos[motivo] || motivo) + ". Mostrando as fotos.";
    var fechar = document.createElement("button");
    fechar.type = "button";
    fechar.setAttribute("aria-label", "Fechar aviso");
    fechar.textContent = "×";
    fechar.addEventListener("click", function () { aviso.remove(); });
    aviso.appendChild(fechar);
    document.body.appendChild(aviso);
  }

  /* ---------------- Montagem (roda quando o Three.js chega) ---------------- */
  function iniciar() {
    var THREE = window.THREE;
    var renderizador;
    try {
      renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch (erro) {
      falhar("sem-webgl");
      return;
    }
    renderizador.setPixelRatio(1);
    renderizador.setClearColor(0x000000, 0);
    renderizador.setScissorTest(true);
    renderizador.outputColorSpace = THREE.SRGBColorSpace;
    renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    renderizador.toneMappingExposure = 1.0;

    var movimentoReduzido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------------- Aparência de cada assistente ---------------- */
    var PERFIS = {
      xavier: {
        nome: "Xavier", artigo: "o", pele: 0xf0c3a4, cabelo: 0xb4532a, iris: 0x4f86b3, labios: 0xc9776a,
        camisa: { cor: 0xf4f5f7 }, manga: { cor: 0xf4f5f7 }, rim: 0x7c5cff
      },
      maya: {
        nome: "Maya", artigo: "a", pele: 0xf4cdb6, cabelo: 0xe6c27a, iris: 0x5f8f80, labios: 0xd06a72,
        camisa: { cor: 0x141418 }, manga: { cor: 0x141418 }, rim: 0x22d3ee
      },
      gabriel: {
        nome: "Gabriel", artigo: "o", pele: 0xd39a76, cabelo: 0x2b1d16, iris: 0x4b3020, labios: 0xa8624f,
        camisa: { textura: "floral" }, manga: { textura: "floral" }, rim: 0xf472b6
      }
    };

    /* ---------------- Texturas desenhadas em canvas (sem arquivos extras) ---------------- */
    function texturaCanvas(largura, altura, desenhar, repetir) {
      var c = document.createElement("canvas");
      c.width = largura;
      c.height = altura;
      desenhar(c.getContext("2d"), largura, altura);
      var t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      if (repetir) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repetir[0], repetir[1]);
      }
      return t;
    }

    var texturas = {};
    function textura(nome) {
      if (texturas[nome]) return texturas[nome];
      if (nome === "floral") {
        // Camisa havaiana do Gabriel: fundo azul com flores coloridas.
        texturas[nome] = texturaCanvas(256, 256, function (g, w, h) {
          g.fillStyle = "#1f73b7";
          g.fillRect(0, 0, w, h);
          var cores = ["#ffffff", "#f9a8d4", "#fde047", "#fb7185", "#fdba74"];
          var flores = [[30, 40], [120, 20], [205, 60], [70, 130], [170, 140], [240, 200], [20, 215], [110, 220], [200, 245]];
          flores.forEach(function (p, i) {
            g.fillStyle = "#2f9e5b";
            g.beginPath();
            g.ellipse(p[0] + 14, p[1] + 12, 14, 6, 0.6, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = cores[i % cores.length];
            for (var k = 0; k < 5; k++) {
              var a = (k / 5) * Math.PI * 2 + i;
              g.beginPath();
              g.arc(p[0] + Math.cos(a) * 10, p[1] + Math.sin(a) * 10, 9, 0, Math.PI * 2);
              g.fill();
            }
            g.fillStyle = "#facc15";
            g.beginPath();
            g.arc(p[0], p[1], 5, 0, Math.PI * 2);
            g.fill();
          });
        }, [2, 2]);
      } else if (nome === "gravata") {
        // Gravata listrada do Xavier.
        texturas[nome] = texturaCanvas(64, 256, function (g, w, h) {
          g.fillStyle = "#1e2a5a";
          g.fillRect(0, 0, w, h);
          g.strokeStyle = "#9db8e8";
          g.lineWidth = 7;
          for (var y = -w; y < h + w; y += 30) {
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(w, y + w * 0.7);
            g.stroke();
          }
        });
      }
      return texturas[nome];
    }

    /* Materiais físicos: o ambiente de estúdio (criarAmbiente) dá reflexos suaves; sheen imita a luz
       espalhada na pele, no cabelo e no tecido; clearcoat dá o brilho úmido dos olhos. */
    function material(def, extra) {
      var opcoes = { roughness: 0.7, metalness: 0, envMapIntensity: 0.55 };
      if (typeof def === "number") opcoes.color = def;
      else if (def.textura) opcoes.map = textura(def.textura);
      else opcoes.color = def.cor;
      for (var k in extra) opcoes[k] = extra[k];
      return new THREE.MeshPhysicalMaterial(opcoes);
    }

    var PELE = { roughness: 0.5, sheen: 0.25, sheenRoughness: 0.55, sheenColor: 0xff9f80, clearcoat: 0.08, clearcoatRoughness: 0.6 };
    var CABELO = { roughness: 0.5, sheen: 0.7, sheenRoughness: 0.35 };
    var TECIDO = { roughness: 0.75, sheen: 0.5, sheenRoughness: 0.8 };
    var OLHO = { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 };
    function com(base, extra) {
      var o = {};
      for (var k in base) o[k] = base[k];
      for (var j in extra) o[j] = extra[j];
      return o;
    }
    /* Brilho do tecido na própria cor (um pouco mais clara): branco acinzentaria a roupa escura. */
    function tecido(def) {
      var cor = new THREE.Color(def.cor !== undefined ? def.cor : 0x5aa0e0);
      return com(TECIDO, { sheenColor: cor.lerp(new THREE.Color(0xffffff), 0.3) });
    }

    function malha(geometria, mat, x, y, z) {
      var m = new THREE.Mesh(geometria, mat);
      m.position.set(x || 0, y || 0, z || 0);
      return m;
    }

    /* Calota de esfera voltada para a frente (+z): usada em barba e franja. */
    function calotaFrontal(raio, aberturaLateral, inicioTheta, alturaTheta) {
      return new THREE.SphereGeometry(raio, 28, 18,
        Math.PI / 2 - aberturaLateral, aberturaLateral * 2, inicioTheta, alturaTheta);
    }

    /* ---------------- Montagem do personagem ---------------- */
    function construirPersonagem(chave) {
      var p = PERFIS[chave];
      var mPele = material(p.pele, PELE);
      var mCabelo = material(p.cabelo, com(CABELO, { sheenColor: new THREE.Color(p.cabelo).lerp(new THREE.Color(0xffffff), 0.45) }));
      var mCamisa = material(p.camisa, tecido(p.camisa));
      var mManga = p.manga.textura === p.camisa.textura && p.manga.cor === p.camisa.cor ? mCamisa : material(p.manga, tecido(p.manga));
      var mOlho = material(0xf6f3ee, OLHO);
      var mIris = material(p.iris, com(OLHO, { roughness: 0.3 }));
      var mPupila = material(0x0b0b10, OLHO);
      var mLabios = material(p.labios, { roughness: 0.5 });
      var mBocaAberta = material(0x3a1418, { roughness: 0.9 });

      var raiz = new THREE.Group();
      var corpo = new THREE.Group();
      raiz.add(corpo);

      // Tronco e pescoço
      var tronco = malha(new THREE.CapsuleGeometry(0.6, 0.85, 8, 24), mCamisa, 0, -1.35, 0);
      tronco.scale.set(1, 1, 0.62);
      corpo.add(tronco);
      corpo.add(malha(new THREE.CylinderGeometry(0.15, 0.17, 0.4, 16), mPele, 0, -0.3, 0));

      if (chave === "xavier") {
        // Gola em V e gravata listrada
        var gola = malha(new THREE.ConeGeometry(0.2, 0.32, 3), mPele, 0, -0.5, 0.22);
        gola.rotation.set(Math.PI - 0.5, 0, 0);
        gola.scale.set(1, 1, 0.35);
        corpo.add(gola);
        var gravata = malha(new THREE.BoxGeometry(0.13, 0.78, 0.035), material({ textura: "gravata" }), 0, -0.98, 0.37);
        gravata.rotation.x = -0.1;
        corpo.add(gravata);
        corpo.add(malha(new THREE.BoxGeometry(0.15, 0.1, 0.06), material(0x1e2a5a), 0, -0.56, 0.32));
      } else if (chave === "maya") {
        // Jaqueta preta aberta sobre camisa vermelha
        var camisaVermelha = malha(new THREE.CapsuleGeometry(0.6, 0.85, 8, 24), material(0xc81e3a, { roughness: 0.55 }), 0, -1.35, 0);
        camisaVermelha.scale.set(0.42, 1, 0.7);
        corpo.add(camisaVermelha);
        [-1, 1].forEach(function (lado) {
          var lapela = malha(new THREE.BoxGeometry(0.06, 0.7, 0.04), material(0x1d1d22, { roughness: 0.4 }), lado * 0.17, -0.95, 0.39);
          lapela.rotation.set(-0.15, 0, lado * 0.32);
          corpo.add(lapela);
        });
      } else {
        // Gola da camisa havaiana
        var golaG = malha(new THREE.ConeGeometry(0.19, 0.3, 3), mPele, 0, -0.5, 0.22);
        golaG.rotation.set(Math.PI - 0.5, 0, 0);
        golaG.scale.set(1, 1, 0.35);
        corpo.add(golaG);
      }

      // Braços: ombro (pivô) → braço → cotovelo (pivô) → antebraço → mão
      function braco(lado) {
        var ombro = new THREE.Group();
        ombro.position.set(lado * 0.55, -0.62, 0);
        ombro.add(malha(new THREE.CapsuleGeometry(0.155, 0.5, 6, 14), mManga, 0, -0.3, 0));
        var cotovelo = new THREE.Group();
        cotovelo.position.y = -0.6;
        ombro.add(cotovelo);
        var mAntebraco = chave === "gabriel" ? mPele : mManga;
        cotovelo.add(malha(new THREE.CapsuleGeometry(0.135, 0.42, 6, 14), mAntebraco, 0, -0.27, 0));
        var mao = malha(new THREE.SphereGeometry(0.15, 16, 12), mPele, 0, -0.6, 0);
        mao.scale.set(0.95, 1.15, 0.65);
        cotovelo.add(mao);
        var polegar = malha(new THREE.CapsuleGeometry(0.045, 0.1, 4, 8), mPele, -lado * 0.12, -0.55, 0.03);
        polegar.rotation.z = lado * 0.7;
        cotovelo.add(polegar);
        ombro.rotation.z = lado * 0.16;
        corpo.add(ombro);
        return { ombro: ombro, cotovelo: cotovelo, lado: lado };
      }
      var bracoAceno = braco(1);
      var bracoParado = braco(-1);

      // Cabeça (pivô no pescoço, conteúdo centrado em "cabeca")
      var pivoCabeca = new THREE.Group();
      pivoCabeca.position.y = -0.25;
      corpo.add(pivoCabeca);
      var cabeca = new THREE.Group();
      cabeca.position.y = 0.42;
      pivoCabeca.add(cabeca);

      var cranio = malha(new THREE.SphereGeometry(0.5, 40, 30), mPele);
      cranio.scale.set(0.92, 1.05, 0.95);
      cabeca.add(cranio);
      [-1, 1].forEach(function (lado) {
        var orelha = malha(new THREE.SphereGeometry(0.09, 14, 10), mPele, lado * 0.45, 0.02, -0.02);
        orelha.scale.set(0.6, 1, 0.8);
        cabeca.add(orelha);
      });
      var nariz = malha(new THREE.SphereGeometry(0.065, 16, 12), mPele, 0, -0.02, 0.47);
      nariz.scale.set(0.85, 1.1, 1);
      cabeca.add(nariz);

      // Olhos com íris móvel e pálpebra (piscar = escala vertical)
      var olhos = [];
      [-1, 1].forEach(function (lado) {
        var olho = new THREE.Group();
        olho.position.set(lado * 0.165, 0.1, 0.4);
        var branco = malha(new THREE.SphereGeometry(0.085, 20, 14), mOlho);
        branco.scale.set(1.1, 1, 0.6);
        olho.add(branco);
        var iris = new THREE.Group();
        iris.position.z = 0.045;
        var irisMalha = malha(new THREE.SphereGeometry(0.048, 16, 12), mIris);
        irisMalha.scale.z = 0.4;
        iris.add(irisMalha);
        var pupila = malha(new THREE.SphereGeometry(0.024, 12, 10), mPupila, 0, 0, 0.012);
        pupila.scale.z = 0.4;
        iris.add(pupila);
        iris.add(malha(new THREE.SphereGeometry(0.009, 8, 6), mOlho, 0.014, 0.016, 0.022));
        olho.add(iris);
        cabeca.add(olho);
        var sobrancelha = malha(new THREE.CapsuleGeometry(0.018, 0.13, 4, 8), mCabelo, lado * 0.17, 0.235, 0.43);
        sobrancelha.rotation.z = Math.PI / 2 + lado * 0.12;
        cabeca.add(sobrancelha);
        olhos.push({ grupo: olho, iris: iris, sobrancelha: sobrancelha, lado: lado });
      });

      // Boca: sorriso (arco) + interior que abre ao falar
      var boca = new THREE.Group();
      boca.position.set(0, -0.19, 0.47);
      var sorriso = malha(new THREE.TorusGeometry(0.085, 0.017, 8, 20, Math.PI), mLabios);
      sorriso.rotation.z = Math.PI;
      boca.add(sorriso);
      var interior = malha(new THREE.SphereGeometry(0.07, 16, 10), mBocaAberta, 0, -0.035, -0.01);
      interior.scale.set(1, 0.05, 0.4);
      boca.add(interior);
      cabeca.add(boca);

      // Cabelo e detalhes de cada um
      if (chave === "xavier") {
        var topo = malha(new THREE.SphereGeometry(0.535, 36, 20, 0, Math.PI * 2, 0, 1.2), mCabelo, 0, 0.03, -0.02);
        topo.rotation.x = -0.28;
        topo.scale.set(0.95, 1.05, 1);
        cabeca.add(topo);
        var topete = malha(new THREE.SphereGeometry(0.2, 20, 14), mCabelo, 0.03, 0.47, 0.2);
        topete.scale.set(1.6, 0.65, 1.1);
        topete.rotation.z = -0.15;
        cabeca.add(topete);
        [-1, 1].forEach(function (lado) {
          var costeleta = malha(new THREE.CapsuleGeometry(0.05, 0.12, 4, 8), mCabelo, lado * 0.43, 0.1, 0.1);
          cabeca.add(costeleta);
        });
        // Barba rala ruiva
        var barbaRala = malha(calotaFrontal(0.505, 1.25, 1.75, 1.15),
          material(p.cabelo, { transparent: true, opacity: 0.28, depthWrite: false }));
        barbaRala.scale.set(0.92, 1.05, 0.95);
        cabeca.add(barbaRala);
      } else if (chave === "maya") {
        var topoM = malha(new THREE.SphereGeometry(0.55, 36, 22, 0, Math.PI * 2, 0, 1.4), mCabelo, 0, 0.02, -0.03);
        topoM.rotation.x = -0.12;
        topoM.scale.set(1, 1.06, 1.02);
        cabeca.add(topoM);
        var volume = malha(new THREE.SphereGeometry(0.52, 30, 22), mCabelo, 0, -0.3, -0.16);
        volume.scale.set(1.18, 1.55, 0.82);
        cabeca.add(volume);
        [-1, 1].forEach(function (lado) {
          var mecha = malha(new THREE.CapsuleGeometry(0.15, 0.8, 6, 12), mCabelo, lado * 0.44, -0.52, 0.06);
          mecha.rotation.z = lado * 0.14;
          cabeca.add(mecha);
          var cacho = malha(new THREE.SphereGeometry(0.17, 14, 10), mCabelo, lado * 0.52, -0.95, 0.04);
          cacho.scale.set(1, 0.8, 0.9);
          cabeca.add(cacho);
        });
        var franja = malha(calotaFrontal(0.56, 0.95, 0.35, 0.55), mCabelo, 0.02, 0.02, 0);
        franja.rotation.z = 0.32;
        cabeca.add(franja);
      } else {
        var topoG = malha(new THREE.SphereGeometry(0.53, 36, 20, 0, Math.PI * 2, 0, 1.1), mCabelo, 0, 0.04, -0.03);
        topoG.rotation.x = -0.35;
        topoG.scale.set(0.95, 1.02, 1);
        cabeca.add(topoG);
        // Barba cheia e bigode
        var barba = malha(calotaFrontal(0.515, 1.4, 1.5, 1.45), mCabelo);
        barba.scale.set(0.93, 1.07, 0.97);
        cabeca.add(barba);
        var bigode = malha(new THREE.CapsuleGeometry(0.035, 0.16, 4, 8), mCabelo, 0, -0.12, 0.5);
        bigode.rotation.z = Math.PI / 2;
        cabeca.add(bigode);
        boca.position.z = 0.505;
        // Óculos de armação fina
        var mArmacao = material(0x9aa3ad, { metalness: 0.6, roughness: 0.3 });
        [-1, 1].forEach(function (lado) {
          cabeca.add(malha(new THREE.TorusGeometry(0.105, 0.012, 8, 28), mArmacao, lado * 0.165, 0.1, 0.5));
          var haste = malha(new THREE.BoxGeometry(0.012, 0.012, 0.42), mArmacao, lado * 0.29, 0.12, 0.29);
          haste.rotation.y = lado * -0.25;
          cabeca.add(haste);
        });
        var ponte = malha(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6), mArmacao, 0, 0.12, 0.52);
        ponte.rotation.z = Math.PI / 2;
        cabeca.add(ponte);
      }

      return {
        raiz: raiz, corpo: corpo, tronco: tronco, pivoCabeca: pivoCabeca, cabeca: cabeca,
        olhos: olhos, boca: boca, interiorBoca: interior, sorriso: sorriso,
        bracoAceno: bracoAceno, bracoParado: bracoParado
      };
    }

    /* ---------------- Cena e câmera de cada avatar ---------------- */
    /* Estúdio virtual (um por assistente, reaproveitado pelas vistas): domo em degradê, duas softboxes
       brancas na frente e uma faixa na cor do tema atrás, convertidos em mapa de ambiente filtrado (PMREM).
       Gerado uma vez na GPU, sem baixar HDR. */
    var ambientes = {};
    var pmrem = null;
    function criarAmbiente(chave) {
      if (ambientes[chave]) return ambientes[chave];
      if (!pmrem) pmrem = new THREE.PMREMGenerator(renderizador);
      var estudio = new THREE.Scene();
      var domo = new THREE.SphereGeometry(10, 32, 16);
      var cores = [];
      var pos = domo.attributes.position;
      var alto = new THREE.Color(0x8f97b8), baixo = new THREE.Color(0x14121f), c = new THREE.Color();
      for (var i = 0; i < pos.count; i++) {
        c.copy(baixo).lerp(alto, Math.pow((pos.getY(i) / 10 + 1) / 2, 1.6));
        cores.push(c.r, c.g, c.b);
      }
      domo.setAttribute("color", new THREE.Float32BufferAttribute(cores, 3));
      estudio.add(new THREE.Mesh(domo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      function painel(cor, intensidade, largura, altura, x, y, z) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(intensidade), side: THREE.DoubleSide }));
        m.position.set(x, y, z);
        m.lookAt(0, 0, 0);
        estudio.add(m);
      }
      painel(0xffffff, 6, 4, 4, -4, 4, 5);          // softbox principal
      painel(0xe6ecff, 2.2, 3, 5, 5, 0.5, 4);       // preenchimento
      painel(PERFIS[chave].rim, 5, 6, 1.6, 0, 3, -6); // contorno na cor do tema
      ambientes[chave] = pmrem.fromScene(estudio, 0.04).texture;
      estudio.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      return ambientes[chave];
    }

    function criarCena(chave) {
      var cena = new THREE.Scene();
      cena.environment = criarAmbiente(chave);
      cena.add(new THREE.HemisphereLight(0xe8ecff, 0x2a2240, 0.6));
      var chaveLuz = new THREE.DirectionalLight(0xffffff, 1.9);
      chaveLuz.position.set(-2, 3, 4);
      cena.add(chaveLuz);
      var preenchimento = new THREE.DirectionalLight(0xdfe7ff, 0.7);
      preenchimento.position.set(3, 0.5, 3);
      cena.add(preenchimento);
      var contorno = new THREE.DirectionalLight(PERFIS[chave].rim, 3.2);
      contorno.position.set(0.5, 2, -4);
      cena.add(contorno);
      return cena;
    }

    var ENQUADRAMENTO = {
      // Câmera um pouco à direita para caber a mão do aceno no quadro.
      busto: { fov: 28, pos: [0.14, -0.4, 7.4], alvo: [0.14, -0.48, 0] },
      rosto: { fov: 28, pos: [0, 0.14, 2.75], alvo: [0, 0.12, 0] }
    };

    /* ---------------- Ponteiro global (mouse ou último toque) ---------------- */
    var ponteiro = { x: innerWidth / 2, y: innerHeight / 2, ultimo: -1e9 };
    function registrarPonteiro(e) {
      ponteiro.x = e.clientX;
      ponteiro.y = e.clientY;
      ponteiro.ultimo = performance.now();
    }
    window.addEventListener("pointermove", registrarPonteiro, { passive: true });
    window.addEventListener("pointerdown", registrarPonteiro, { passive: true });

    /* ---------------- Vistas ---------------- */
    var vistas = [];
    var DURACAO_ACENO = 2.4;

    function criarVista(el) {
      var chave = (el.getAttribute("data-avatar3d") || "").toLowerCase();
      if (!PERFIS[chave]) return null;
      var modo = el.getAttribute("data-avatar3d-modo") === "busto" ? "busto" : "rosto";
      var canvas = document.createElement("canvas");
      canvas.className = "avatar3d-canvas";
      canvas.setAttribute("aria-hidden", "true");
      el.appendChild(canvas);

      var enq = ENQUADRAMENTO[modo];
      var camera = new THREE.PerspectiveCamera(enq.fov, 1, 0.1, 50);
      camera.position.fromArray(enq.pos);
      camera.lookAt(new THREE.Vector3().fromArray(enq.alvo));

      var cena = criarCena(chave);
      var personagem = construirPersonagem(chave);
      cena.add(personagem.raiz);

      var vista = {
        el: el, chave: chave, modo: modo, canvas: canvas, ctx: canvas.getContext("2d"),
        cena: cena, camera: camera, p: personagem,
        fala: el.hasAttribute("data-avatar3d-fala"),
        visivel: false, jaSaudou: false,
        fase: Math.random() * 10,
        olhar: { x: 0, y: 0 },
        acenoInicio: -1e9, ultimoAceno: -1e9,
        proximaPiscada: 1 + Math.random() * 3, piscadaInicio: -1,
        larguraPx: 0, alturaPx: 0
      };

      el.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "mouse") acenar(vista);
      });
      el.addEventListener("click", function () { acenar(vista); });
      return vista;
    }

    var relogio = new THREE.Clock();
    function agora() { return relogio.getElapsedTime(); }

    function acenar(vista, forcar) {
      var t = agora();
      if (!forcar && t - vista.ultimoAceno < DURACAO_ACENO + 0.6) return false;
      vista.acenoInicio = t;
      vista.ultimoAceno = t;
      return true;
    }

    function suave(x) { return x * x * (3 - 2 * x); }
    function limitar(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function aproximar(atual, alvo, dt, velocidade) { return atual + (alvo - atual) * (1 - Math.exp(-velocidade * dt)); }

    /* Intensidade do aceno: sobe, mantém e desce ao longo de DURACAO_ACENO. */
    function intensidadeAceno(vista, t) {
      var d = t - vista.acenoInicio;
      if (d < 0 || d > DURACAO_ACENO) return 0;
      if (d < 0.35) return suave(d / 0.35);
      if (d > DURACAO_ACENO - 0.45) return suave((DURACAO_ACENO - d) / 0.45);
      return 1;
    }

    function animar(vista, t, dt, retangulo) {
      var p = vista.p;
      var lento = movimentoReduzido ? 0.25 : 1;

      // Para onde olhar: o ponteiro (se mexeu nos últimos 5 s) ou um passeio suave do olhar.
      var alvoX, alvoY;
      if (performance.now() - ponteiro.ultimo < 5000 || movimentoReduzido) {
        var cx = retangulo.left + retangulo.width / 2;
        var cy = retangulo.top + retangulo.height * (vista.modo === "busto" ? 0.3 : 0.45);
        alvoX = limitar((ponteiro.x - cx) / (innerWidth * 0.45), -1, 1);
        alvoY = limitar((ponteiro.y - cy) / (innerHeight * 0.45), -1, 1);
      } else {
        alvoX = Math.sin(t * 0.35 + vista.fase) * 0.45;
        alvoY = Math.sin(t * 0.23 + vista.fase * 2) * 0.2;
      }
      vista.olhar.x = aproximar(vista.olhar.x, alvoX, dt, 5);
      vista.olhar.y = aproximar(vista.olhar.y, alvoY, dt, 5);

      var aceno = intensidadeAceno(vista, t);

      // Cabeça segue o olhar; durante o aceno inclina de leve.
      p.pivoCabeca.rotation.y = vista.olhar.x * 0.6;
      p.pivoCabeca.rotation.x = vista.olhar.y * 0.32 - aceno * 0.05;
      p.pivoCabeca.rotation.z = -vista.olhar.x * 0.06 + aceno * 0.12 * Math.sin(t * 3);
      p.corpo.rotation.y = vista.olhar.x * 0.18;

      // Olhos acompanham um pouco mais que a cabeça.
      p.olhos.forEach(function (o) {
        o.iris.position.x = vista.olhar.x * 0.03;
        o.iris.position.y = -vista.olhar.y * 0.022;
        o.sobrancelha.position.y = 0.235 + aceno * 0.035;
      });

      // Piscar
      if (vista.piscadaInicio < 0 && t >= vista.proximaPiscada) vista.piscadaInicio = t;
      var abertura = 1;
      if (vista.piscadaInicio >= 0) {
        var dp = (t - vista.piscadaInicio) / 0.16;
        if (dp >= 1) {
          vista.piscadaInicio = -1;
          vista.proximaPiscada = t + 2 + Math.random() * 3.5;
        } else {
          abertura = Math.abs(dp * 2 - 1);
        }
      }
      p.olhos.forEach(function (o) { o.grupo.scale.y = 0.08 + 0.92 * abertura; });

      // Respiração
      var resp = Math.sin(t * 1.6 * lento + vista.fase);
      p.tronco.scale.set(1 + resp * 0.012, 1 + resp * 0.018, 0.62);
      p.raiz.position.y = resp * 0.012;

      // Braços: um acena, o outro balança de leve
      var bA = p.bracoAceno;
      bA.ombro.rotation.z = 0.16 + aceno * 2.1;
      bA.ombro.rotation.x = -aceno * 0.3;
      bA.cotovelo.rotation.z = aceno * (0.7 + 0.4 * Math.sin((t - vista.acenoInicio) * 11));
      p.bracoParado.ombro.rotation.z = -0.16 - resp * 0.015;
      if (vista.modo === "rosto") {
        // No recorte do rosto o braço não aparece: o "oi" vira um balanço de cabeça.
        p.pivoCabeca.rotation.z += aceno * 0.15 * Math.sin((t - vista.acenoInicio) * 6);
      }

      // Boca: sorriso maior no aceno; fala nos cartões de voz (frases de 2,6 s com pausas)
      var falando = 0;
      if (vista.fala && !movimentoReduzido) {
        var ciclo = (t + vista.fase) % 3.6;
        if (ciclo < 2.6) falando = Math.max(0, Math.sin(t * 13 + vista.fase) * 0.5 + Math.sin(t * 7.7) * 0.5);
      }
      var abreBoca = Math.max(falando, aceno * 0.35);
      p.interiorBoca.scale.y = 0.05 + abreBoca * 0.75;
      p.sorriso.scale.set(1 + aceno * 0.15, 1 + aceno * 0.25, 1);
    }

    /* ---------------- Laço de desenho ---------------- */
    var bufferL = 0, bufferA = 0;
    var tAnterior = 0;

    /* Resolução adaptativa: mede quanto cada quadro custa (inclui a espera pela GPU, pois a cópia para o
       canvas 2D sincroniza) e ajusta a fração da densidade de pixels usada, entre 0,5 e 1. */
    var qualidade = { escala: 1, custoMedio: 0, proximoAjuste: 0 };
    function ajustarQualidade(custo, t) {
      qualidade.custoMedio += (custo - qualidade.custoMedio) * 0.1;
      if (t < qualidade.proximoAjuste) return;
      if (qualidade.custoMedio > 12 && qualidade.escala > 0.5) {
        qualidade.escala = Math.max(0.5, qualidade.escala * 0.85);
        qualidade.proximoAjuste = t + 1;
      } else if (qualidade.custoMedio < 5 && qualidade.escala < 1) {
        qualidade.escala = Math.min(1, qualidade.escala * 1.1);
        qualidade.proximoAjuste = t + 3;
      }
    }

    function desenhar(vista, retangulo) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2) * qualidade.escala;
      var l = Math.max(1, Math.round(retangulo.width * dpr));
      var a = Math.max(1, Math.round(retangulo.height * dpr));
      if (l !== vista.larguraPx || a !== vista.alturaPx) {
        vista.larguraPx = vista.canvas.width = l;
        vista.alturaPx = vista.canvas.height = a;
        vista.camera.aspect = l / a;
        vista.camera.updateProjectionMatrix();
      }
      if (l > bufferL || a > bufferA) {
        bufferL = Math.max(bufferL, l);
        bufferA = Math.max(bufferA, a);
        renderizador.setSize(bufferL, bufferA, false);
      }
      renderizador.setViewport(0, 0, l, a);
      renderizador.setScissor(0, 0, l, a);
      renderizador.render(vista.cena, vista.camera);
      // O WebGL desenha a partir do canto inferior esquerdo: copia a faixa de baixo do buffer.
      vista.ctx.clearRect(0, 0, l, a);
      vista.ctx.drawImage(renderizador.domElement, 0, bufferA - a, l, a, 0, 0, l, a);
    }

    function quadro() {
      requestAnimationFrame(quadro);
      var t = agora();
      var dt = Math.min(0.05, t - tAnterior);
      tAnterior = t;
      var inicio = performance.now(), desenhados = 0;
      for (var i = 0; i < vistas.length; i++) {
        var v = vistas[i];
        if (!v.visivel) continue;
        var r = v.el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        animar(v, t, dt, r);
        desenhar(v, r);
        desenhados++;
      }
      if (desenhados) ajustarQualidade(performance.now() - inicio, t);
    }

    function desativarTudo(motivo) {
      vistas.forEach(function (v) {
        v.el.classList.remove("avatar3d-ativo");
        if (v.canvas.parentNode) v.canvas.parentNode.removeChild(v.canvas);
      });
      vistas.length = 0;
      falhar(motivo);
    }

    /* ---------------- Início ---------------- */
    try {
      Array.prototype.forEach.call(elementos, function (el) {
        var v = criarVista(el);
        if (v) vistas.push(v);
      });
    } catch (erro) {
      if (window.console) console.warn("Avatares 3D:", erro);
      desativarTudo("erro-montagem");
      return;
    }
    if (!vistas.length) { api.motivo = "sem-elementos"; return; }

    renderizador.domElement.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      desativarTudo("contexto-perdido");
    });

    var observador = "IntersectionObserver" in window ? new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        var v = vistas.filter(function (x) { return x.el === entrada.target; })[0];
        if (!v) return;
        v.visivel = entrada.isIntersecting;
        // Ao aparecer pela primeira vez, o avatar de corpo inteiro dá oi.
        if (v.visivel && !v.jaSaudou && v.modo === "busto" && entrada.intersectionRatio >= 0.5) {
          v.jaSaudou = true;
          if (!movimentoReduzido) setTimeout(function () { acenar(v); }, 350);
        }
      });
    }, { threshold: [0, 0.5] }) : null;

    function ativar() {
      if (!vistas.length) return; // contexto perdido durante a compilação
      vistas.forEach(function (v) {
        v.el.classList.add("avatar3d-ativo");
        if (observador) observador.observe(v.el);
        else v.visivel = true;
      });
      api.ativo = true;
      api.motivo = "";
      document.documentElement.setAttribute("data-avatares3d", "ativo");
      requestAnimationFrame(quadro);
    }

    api.vistas = vistas;
    api.qualidade = qualidade;
    api.acenar = function (alvo) {
      var lista = vistas.filter(function (v) { return v.el === alvo || v.chave === alvo; });
      return lista.map(function (v) { return acenar(v, true); }).some(Boolean);
    };
    api.estado = function (v) {
      return {
        chave: v.chave, modo: v.modo, visivel: v.visivel,
        cabecaY: v.p.pivoCabeca.rotation.y, ombro: v.p.bracoAceno.ombro.rotation.z,
        boca: v.p.interiorBoca.scale.y
      };
    };

    // Compila os shaders antes de trocar as fotos pelo 3D (em paralelo quando o navegador permite),
    // para o primeiro quadro não engasgar a rolagem. Uma cena por assistente basta: as demais reaproveitam.
    var umaPorAssistente = vistas.filter(function (v, i) {
      return vistas.findIndex(function (x) { return x.chave === v.chave; }) === i;
    });
    var compilando = null;
    try {
      if (renderizador.compileAsync) {
        compilando = Promise.all(umaPorAssistente.map(function (v) { return renderizador.compileAsync(v.cena, v.camera); }));
      }
    } catch (erro) {
      compilando = null;
    }
    if (compilando) compilando.then(ativar, ativar);
    else ativar();
  }
})();
