import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import importar_imagens  # noqa: E402

ASSISTENTES = ("xavier", "maya", "gabriel")


class Coletor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.ids = set()
        self.textos = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if "id" in attrs:
            self.ids.add(attrs["id"])

    def handle_data(self, data):
        self.textos.append(data)


def carregar_html():
    coletor = Coletor()
    coletor.feed((RAIZ / "index.html").read_text(encoding="utf-8"))
    return coletor


def secao(conteudo, id_secao):
    return re.search(rf'<section id="{id_secao}".*?</section>', conteudo, re.S).group(0)


def capacidades_da_secao(bloco):
    return re.findall(r'<article class="capacidade[^"]*"[^>]*data-capacidade="([^"]+)"', bloco)


class TestHTML(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = carregar_html()
        cls.texto = " ".join(cls.html.textos)

    def test_meta_responsiva_e_idioma(self):
        metas = [a for t, a in self.html.tags if t == "meta"]
        self.assertTrue(any(m.get("name") == "viewport" for m in metas))
        html_tag = next(a for t, a in self.html.tags if t == "html")
        self.assertEqual(html_tag.get("lang"), "pt-BR")

    def test_secao_para_cada_assistente(self):
        secoes = {a.get("id") for t, a in self.html.tags if t == "section"}
        for nome in ASSISTENTES:
            self.assertIn(nome, secoes)
        for nome in ("Xavier", "Maya", "Gabriel"):
            self.assertIn(nome, self.texto)

    def test_assistentes_nao_repetem_listas_de_funcoes(self):
        # As capacidades ficam numa seção única; as seções individuais só apresentam o assistente.
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        for nome in ASSISTENTES:
            bloco = secao(conteudo, nome)
            self.assertNotIn('class="capacidade', bloco, nome)
            self.assertNotIn("<li><strong>", bloco, nome)
            self.assertIn("qualquer uma das capacidades da equipe", bloco, nome)

    def test_links_internos_validos(self):
        for tag, attrs in self.html.tags:
            href = attrs.get("href", "")
            if tag == "a" and href.startswith("#"):
                self.assertIn(href[1:], self.html.ids, f"âncora quebrada: {href}")

    def test_imagens_com_alt_e_fallback_existente(self):
        imgs = [a for t, a in self.html.tags if t == "img"]
        self.assertGreaterEqual(len(imgs), 7)
        for img in imgs:
            self.assertTrue(img.get("alt"))
            fallback = re.search(r"this\.src='([^']+)'", img.get("onerror", ""))
            self.assertIsNotNone(fallback, img)
            self.assertTrue((RAIZ / fallback.group(1)).is_file())
            self.assertTrue(img["src"].startswith("img/"), img["src"])

    def test_imagens_apontam_para_arquivos_da_pasta_img(self):
        for tag, attrs in self.html.tags:
            if tag == "img":
                caminho = RAIZ / unquote(attrs["src"])
                self.assertTrue(caminho.is_file(), f"imagem ausente: {caminho}")

    def test_caminhos_exatos_das_quatro_imagens(self):
        srcs = {a["src"] for t, a in self.html.tags if t == "img"}
        self.assertEqual(srcs, {"img/XAVIER.png", "img/MAYA.png", "img/GABRIEL.png", "img/FAMILIA-IA.png"})
        for src in srcs:
            self.assertNotIn(" ", src)
            self.assertTrue((RAIZ / src).is_file(), src)

    def test_foto_do_grupo_tem_reserva_valida(self):
        from PIL import Image

        familia = next(a for t, a in self.html.tags if t == "img" and "FAMILIA" in a["src"])
        reserva = RAIZ / unquote(familia["data-reserva"])
        self.assertEqual(reserva.name, "FAMILIA IA.png")
        self.assertTrue(reserva.is_file())
        self.assertIn("this.dataset.reserva", familia["onerror"])
        self.assertIn("assets/img/familia.svg", familia["onerror"])
        for arquivo in (RAIZ / familia["src"], reserva):
            with Image.open(arquivo) as img:
                self.assertEqual(img.format, "PNG")
                self.assertEqual(img.size, (int(familia["width"]), int(familia["height"])))

    def test_cada_secao_usa_a_foto_do_assistente(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        for nome in ASSISTENTES:
            self.assertIn(f'src="img/{nome.upper()}.png"', secao(conteudo, nome))

    def test_hero_usa_foto_do_grupo(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        hero = secao(conteudo, "inicio")
        self.assertIn('class="hero-familia"', hero)
        self.assertIn('src="img/FAMILIA-IA.png"', hero)
        self.assertIn('data-reserva="img/FAMILIA%20IA.png"', hero)
        for nome in ASSISTENTES:
            self.assertIn(f'src="img/{nome.upper()}.png"', hero)

    def test_css_linkado_existe(self):
        links = [a for t, a in self.html.tags if t == "link" and a.get("rel") == "stylesheet"]
        self.assertTrue(links)
        for link in links:
            self.assertTrue((RAIZ / link["href"].split("?")[0]).is_file())

    def test_scripts_existem(self):
        scripts = [a for t, a in self.html.tags if t == "script" and a.get("src")]
        self.assertTrue(scripts)
        for script in scripts:
            self.assertTrue((RAIZ / script["src"].split("?")[0]).is_file())

    def test_secao_unica_de_capacidades_vem_antes_dos_assistentes(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        bloco = secao(conteudo, "capacidades")
        chaves = capacidades_da_secao(bloco)
        self.assertGreaterEqual(len(chaves), 10)
        self.assertEqual(len(chaves), len(set(chaves)))
        self.assertGreaterEqual(bloco.count("<li><strong>"), 60)
        self.assertEqual(len(re.findall(r'<article class="capacidade\b', conteudo)), len(chaves))
        posicao = conteudo.index('<section id="capacidades"')
        for nome in ASSISTENTES:
            self.assertLess(posicao, conteudo.index(f'<section id="{nome}"'))
            self.assertIn(nome.capitalize(), bloco)

    def test_cada_assistente_esta_pronto_para_todas_as_capacidades(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        todas = set(capacidades_da_secao(secao(conteudo, "capacidades")))
        for nome in ASSISTENTES:
            pronto = re.search(r'<ul class="pronto"[^>]*>(.*?)</ul>', secao(conteudo, nome), re.S)
            self.assertIsNotNone(pronto, nome)
            self.assertEqual(set(re.findall(r'data-capacidade="([^"]+)"', pronto.group(1))), todas, nome)

    def test_secao_equipe_apresenta_os_tres(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        bloco = secao(conteudo, "equipe")
        self.assertIn("equipe unificada", bloco)
        self.assertIn('href="#capacidades"', bloco)
        for nome in ("Xavier", "Maya", "Gabriel"):
            self.assertIn(nome, bloco)

    def test_comparativo_mostra_capacidades_iguais(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        bloco = secao(conteudo, "comparativo")
        linhas = re.findall(r'<tr><th scope="row">[^<]+</th>(.*?)</tr>', bloco)
        self.assertGreaterEqual(len(linhas), 10)
        for linha in linhas:
            self.assertEqual(linha.count('class="sim"'), 3, linha)
        self.assertNotIn('class="parcial"', bloco)
        self.assertNotIn('class="nao"', bloco)

    def test_capacidades_pedidas_estao_presentes(self):
        texto = self.texto.lower()
        for termo in ("controle de arquivos", "automação de navegador", "home assistant",
                      "agenda", "whatsapp", "análise visual", "rotinas e automação"):
            self.assertIn(termo, texto)

    def test_ids_unicos(self):
        ids = [a["id"] for t, a in self.html.tags if "id" in a]
        self.assertEqual(len(ids), len(set(ids)))


class TestSemGaleria(unittest.TestCase):
    """A galeria (e o que vinha abaixo dela) saiu: a página termina na demo de voz."""

    @classmethod
    def setUpClass(cls):
        cls.html = carregar_html()
        cls.conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        cls.css = (RAIZ / "css" / "style.css").read_text(encoding="utf-8")
        cls.js = (RAIZ / "js" / "main.js").read_text(encoding="utf-8")

    def test_secoes_removidas(self):
        for id_secao in ("galeria", "contato"):
            self.assertNotIn(id_secao, self.html.ids)
            self.assertNotIn(f'href="#{id_secao}"', self.conteudo)
        self.assertNotIn("Galeria de Conteúdo", self.conteudo)
        self.assertNotIn("<footer", self.conteudo)

    def test_sem_videos_em_breve(self):
        self.assertNotIn("em breve", self.conteudo.lower())
        self.assertNotIn("video-slot", self.conteudo)
        self.assertNotIn("data-filtro", self.conteudo)

    def test_ultima_secao_e_a_demo_de_voz(self):
        ids = [a["id"] for t, a in self.html.tags if t == "section"]
        self.assertEqual(ids[-1], "demo-assistentes")
        self.assertRegex(self.conteudo, r"</section>\s*</main>\s*</body>\s*</html>\s*$")

    def test_sem_estilos_e_scripts_orfaos(self):
        for seletor in (".galeria", ".filtro", ".video", ".contato", ".rodape"):
            self.assertNotIn(seletor, self.css)
        for trecho in ("resolverVideo", ".filtro", ".video-slot"):
            self.assertNotIn(trecho, self.js)


class TestDemo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = carregar_html()
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        cls.bloco = re.search(r'<section id="demo".*?</section>', conteudo, re.S).group(0)
        cls.css = (RAIZ / "css" / "style.css").read_text(encoding="utf-8")

    def _classes(self, nome):
        return [a for t, a in self.html.tags if nome in a.get("class", "").split()]

    def test_secao_no_menu(self):
        self.assertIn("#demo", [a.get("href") for t, a in self.html.tags if t == "a"])
        self.assertIn("Demo Interativo", self.bloco)

    def test_cada_escolha_tem_avatar_svg_com_tema(self):
        botoes = re.findall(r'<button type="button" class="demo-escolha[^"]*"[^>]*>.*?</button>', self.bloco, re.S)
        self.assertEqual(len(botoes), 3)
        for nome, botao in zip(ASSISTENTES, botoes):
            self.assertIn(f'data-assistente="{nome}"', botao)
            self.assertIn(f"tema-{nome}", botao)
            self.assertIn('class="avatar-svg"', botao)
            self.assertIn('aria-hidden="true"', botao)
            for parte in ("av-cabeca", "av-olhos", "av-boca", "av-pensando"):
                self.assertIn(parte, botao, (nome, parte))
            self.assertIn(nome.capitalize(), botao)
        # Os três avatares são desenhos diferentes.
        desenhos = {re.search(r"<svg.*?</svg>", b, re.S).group(0) for b in botoes}
        self.assertEqual(len(desenhos), 3)

    def test_palco_do_avatar_selecionado(self):
        palco = re.search(r'<div class="demo-palco".*?data-palco-acao[^<]*</p>', self.bloco, re.S)
        self.assertIsNotNone(palco)
        palco = palco.group(0)
        self.assertIn('data-estado="ocioso"', palco)
        self.assertIn('class="avatar-svg"', palco)
        for atributo in ("data-palco-nome", "data-palco-papel", "data-palco-status", "data-palco-acao"):
            self.assertIn(atributo, palco)
        self.assertIn(">Xavier<", palco)

    def test_sugestoes_de_mensagem(self):
        self.assertGreaterEqual(len(self._classes("demo-sugestao")), 3)
        self.assertEqual(len(self._classes("demo-sugestoes")), 1)

    def test_estilos_dos_avatares_e_estados(self):
        for seletor in (".avatar-svg", ".av-olhos", ".av-boca", ".demo-palco", ".demo-escolha.ativo",
                        '[data-estado="pensando"]', '[data-estado="falando"]', ".demo-sugestao",
                        "@keyframes falar", "@keyframes piscar"):
            self.assertIn(seletor, self.css)
        self.assertRegex(self.css, r"@media \(max-width: 900px\)[^@]*\.demo-grade")

    def test_formulario_com_campo_rotulado(self):
        campo = next(a for t, a in self.html.tags if t == "input" and a.get("id") == "demo-pergunta")
        self.assertIn("demo-campo", campo["class"])
        self.assertTrue(campo.get("placeholder"))
        rotulos = [a for t, a in self.html.tags if t == "label" and a.get("for") == "demo-pergunta"]
        self.assertEqual(len(rotulos), 1)
        envio = [a for t, a in self.html.tags if t == "button" and a.get("type") == "submit"]
        self.assertTrue(any("demo-enviar" in a.get("class", "") for a in envio))

    def test_log_acessivel_com_mensagem_inicial(self):
        log = self._classes("demo-log")
        self.assertEqual(len(log), 1)
        self.assertEqual(log[0].get("role"), "log")
        self.assertEqual(log[0].get("aria-live"), "polite")
        self.assertGreaterEqual(len(self._classes("demo-assistente")), 1)

    def test_microfone_placeholder(self):
        mic = self._classes("demo-mic")
        self.assertEqual(len(mic), 1)
        botoes = [a for t, a in self.html.tags
                  if t == "button" and "demo-mic" in a.get("class", "").split()]
        self.assertEqual(len(botoes), 1)
        self.assertEqual(botoes[0].get("type"), "button")
        self.assertIn("voz", botoes[0].get("aria-label", "").lower())
        self.assertIn("<svg", self.bloco)
        self.assertIn("demo-dica", self.bloco)
        self.assertEqual(botoes[0].get("aria-pressed"), "false")
        self.assertNotIn("em breve", botoes[0].get("aria-label", "").lower())

    def test_controles_de_voz_e_ondas(self):
        voz = self._classes("demo-voz-toggle")
        self.assertEqual(len(voz), 1)
        self.assertIn("data-voz-toggle", voz[0])
        self.assertIn("hidden", voz[0], "só aparece quando o navegador tem síntese de fala")
        self.assertIn("demo-palco-ondas", self.bloco)
        for seletor in ("--olhar-x", "--boca", '[data-humor="feliz"]', '[data-estado="ouvindo"]',
                        ".demo-palco.sincronizado", "@keyframes onda-ouvindo", ".demo-voz-toggle"):
            self.assertIn(seletor, self.css)

    def test_sem_secao_duplicada_nem_texto_corrompido(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        self.assertEqual(conteudo.count('<section id="demo"'), 1)
        self.assertNotIn("`n", conteudo)
        self.assertNotIn('\\"', conteudo)
        self.assertNotIn("nova-interface", conteudo)

    def test_escolha_dos_tres_assistentes(self):
        escolhas = {a["data-assistente"] for a in self._classes("demo-escolha")}
        self.assertEqual(escolhas, set(ASSISTENTES))
        self.assertIn("tema-xavier", self._classes("demo-caixa")[0]["class"])

    def test_estilos_da_demo(self):
        for seletor in (".demo-caixa", ".demo-log", ".demo-msg", ".demo-form", ".demo-mic", ".sr-only"):
            self.assertIn(seletor, self.css)


@unittest.skipUnless(shutil.which("node"), "Node.js não instalado")
class TestDemoVoz(unittest.TestCase):
    """Seção #demo-assistentes: 3 cartões com avatar e barras de voz, só com o CSS do site."""

    @classmethod
    def setUpClass(cls):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        cls.bloco = re.search(r'<section id="demo-assistentes".*?</section>', conteudo, re.S).group(0)
        cls.css = (RAIZ / "css" / "style.css").read_text(encoding="utf-8")

    def test_tres_cartoes_com_tema_avatar_e_onda(self):
        cartoes = re.findall(r'<li class="voz-cartao tema-(\w+)[^"]*">(.*?)</li>', self.bloco, re.S)
        self.assertEqual([nome for nome, _ in cartoes], list(ASSISTENTES))
        for nome, cartao in cartoes:
            self.assertIn(f'src="img/{nome.upper()}.png"', cartao)
            self.assertIn(f"assets/img/{nome}.svg", cartao)
            self.assertIn("voz-online", cartao)
            self.assertIn(f">{nome.capitalize()}</h3>", cartao)
            self.assertEqual(len(re.findall(r'<span class="voz-onda".*?</span></span>', cartao, re.S)), 1)
            self.assertGreaterEqual(cartao.count("<span></span>"), 8)
            self.assertIn('role="img"', cartao)

    def test_sem_tailwind_nem_estilos_improvisados(self):
        for utilitario in ("bg-gray", "text-gray", "rounded-full", "flex-col", "grid-cols", "animate-pulse", "mx-auto"):
            self.assertNotIn(utilitario, self.bloco)
        # Só a variável de recorte do rosto pode vir inline.
        for estilo in re.findall(r'style="([^"]*)"', self.bloco):
            self.assertRegex(estilo, r"^--foco: [\d.]+% [\d.]+%$")
        for emprestada in ("pilares", "demo-palco", "demo-form", "demo-campo", "demo-mic", "av-boca"):
            self.assertNotIn(emprestada, self.bloco)

    def test_estilos_da_secao(self):
        for seletor in (".voz-grade", ".voz-cartao", ".voz-avatar", ".voz-onda span", "@keyframes onda-voz"):
            self.assertIn(seletor, self.css)
        self.assertRegex(self.css, r"\.voz-grade \{[^}]*grid-template-columns: repeat\(3, 1fr\)")
        self.assertRegex(self.css, r"@media \(max-width: 900px\)[^@]*\.voz-grade")


class TestJS(unittest.TestCase):
    def _node(self, codigo, *args):
        saida = subprocess.run(
            ["node", "-e", codigo, str(RAIZ / "js" / "main.js"), *args],
            capture_output=True, text=True, check=True, encoding="utf-8",
        ).stdout
        return json.loads(saida)

    def _responder(self, pergunta, assistente):
        return self._node(
            "const {responderDemo}=require(process.argv[1]);"
            "console.log(JSON.stringify(responderDemo(process.argv[2], process.argv[3])));",
            pergunta, assistente,
        )

    def test_normalizar_texto(self):
        saida = self._node(
            "const {normalizarTexto}=require(process.argv[1]);"
            "console.log(JSON.stringify(normalizarTexto(process.argv[2])));",
            "  Olá, REUNIÃO amanhã!  ",
        )
        self.assertEqual(saida, "ola reuniao amanha")

    def test_respostas_por_topico(self):
        self.assertIn("Downloads", self._responder("Organize meus arquivos", "xavier"))
        self.assertIn("23 °C", self._responder("Acende a luz da sala", "maya"))
        self.assertIn("testes", self._responder("Tem um bug no meu código", "gabriel"))
        self.assertIn("reuniões", self._responder("O que tenho na agenda?", "xavier"))
        self.assertIn("Maya", self._responder("oi", "maya"))

    def test_cada_assistente_responde_diferente(self):
        respostas = {self._responder("Manda mensagem no WhatsApp", nome) for nome in ASSISTENTES}
        self.assertEqual(len(respostas), 3)

    def test_chave_curta_exige_palavra_inteira(self):
        # "oi" não deve casar com "noite"; "ver" não deve casar com "verdade".
        padrao = self._responder("xyz qualquer coisa", "xavier")
        self.assertEqual(self._responder("verdade", "xavier"), padrao)
        self.assertNotEqual(self._responder("boa noite", "xavier"), padrao)

    def test_resposta_padrao_vazia_e_assistente_invalido(self):
        self.assertIn("simul", self._responder("xyz qualquer coisa", "gabriel"))
        self.assertIn("digitar", self._responder("   ", "maya"))
        self.assertEqual(self._responder("oi", "desconhecido"), self._responder("oi", "xavier"))

    def _chamar(self, funcao, *args):
        return self._node(
            f"const m=require(process.argv[1]);"
            f"console.log(JSON.stringify(m.{funcao}(...process.argv.slice(2))));",
            *args,
        )

    def test_analisar_pergunta_devolve_topico_e_rotulo(self):
        analise = self._chamar("analisarPergunta", "Acende a luz da sala", "maya")
        self.assertEqual(analise["topico"], "casa")
        self.assertIn("casa", analise["rotulo"])
        self.assertEqual(analise["resposta"], self._responder("Acende a luz da sala", "maya"))
        self.assertEqual(self._chamar("analisarPergunta", "xyz", "gabriel")["topico"], "padrao")
        self.assertEqual(self._chamar("analisarPergunta", "  ", "xavier")["topico"], "vazio")

    def test_sugestoes_caem_em_topicos_conhecidos(self):
        for nome in ASSISTENTES:
            sugestoes = self._chamar("sugestoesDemo", nome)
            self.assertEqual(len(sugestoes), 3, nome)
            for texto in sugestoes:
                topico = self._chamar("analisarPergunta", texto, nome)["topico"]
                self.assertNotIn(topico, ("padrao", "vazio"), texto)
        self.assertEqual(self._chamar("sugestoesDemo", "outro"), self._chamar("sugestoesDemo", "xavier"))

    def test_sugestoes_do_html_sao_as_do_xavier(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        html = re.findall(r'class="demo-sugestao">([^<]+)<', conteudo)
        self.assertEqual(html, self._chamar("sugestoesDemo", "xavier"))

    def test_placeholder_com_artigo(self):
        self.assertEqual(self._chamar("placeholderDemo", "maya"), "Pergunte algo para a Maya…")
        self.assertEqual(self._chamar("placeholderDemo", "gabriel"), "Pergunte algo para o Gabriel…")
        self.assertEqual(self._chamar("placeholderDemo", "?"), "Pergunte algo para o Xavier…")

    def test_etapas_digitacao(self):
        etapas = self._node(
            "const {etapasDigitacao}=require(process.argv[1]);"
            "console.log(JSON.stringify(etapasDigitacao(process.argv[2], 2)));",
            "Oi 👋!",
        )
        self.assertEqual(etapas, ["Oi", "Oi 👋", "Oi 👋!"])
        vazio = self._node("const {etapasDigitacao}=require(process.argv[1]);"
                           "console.log(JSON.stringify(etapasDigitacao('', 3)));")
        self.assertEqual(vazio, [])

    def test_extrair_nome(self):
        self.assertEqual(self._chamar("extrairNome", "Oi, meu nome é ANA"), "Ana")
        self.assertEqual(self._chamar("extrairNome", "pode me chamar de joão"), "João")
        self.assertEqual(self._chamar("extrairNome", "organize meus arquivos"), "")

    def _analisar_com_contexto(self, pergunta, assistente, contexto):
        return self._node(
            "const {analisarPergunta}=require(process.argv[1]);"
            "console.log(JSON.stringify(analisarPergunta(process.argv[2], process.argv[3], JSON.parse(process.argv[4]))));",
            pergunta, assistente, json.dumps(contexto),
        )

    def test_contexto_nome_e_confirmacao(self):
        nome = self._chamar("analisarPergunta", "meu nome é Ana", "maya")
        self.assertEqual((nome["topico"], nome["nome"]), ("nome", "Ana"))
        self.assertIn("Ana", nome["resposta"])
        self.assertIn("Ana", self._analisar_com_contexto("oi", "xavier", {"nome": "Ana"})["resposta"])
        self.assertIn("Ana", self._analisar_com_contexto("qual é meu nome?", "gabriel", {"nome": "Ana"})["resposta"])

        sim = self._analisar_com_contexto("sim, pode", "xavier", {"ultimoTopico": "arquivos"})
        self.assertEqual(sim["topico"], "confirmar")
        self.assertIn("movi os arquivos", sim["resposta"])
        nao = self._analisar_com_contexto("não, deixa", "maya", {"ultimoTopico": "casa"})
        self.assertEqual(nao["topico"], "recusar")
        # Outro assunto vence a confirmação; sem pergunta anterior, "sim" não confirma nada.
        self.assertEqual(self._analisar_com_contexto("Leia meu WhatsApp", "xavier", {"ultimoTopico": "arquivos"})["topico"], "whatsapp")
        self.assertEqual(self._analisar_com_contexto("sim", "xavier", {})["topico"], "padrao")

    def test_horas_e_humor(self):
        horas = self._chamar("analisarPergunta", "que horas são?", "xavier")
        self.assertEqual(horas["topico"], "horas")
        self.assertRegex(horas["resposta"], r"\d{1,2}h\d{2}")
        self.assertEqual(self._chamar("analisarPergunta", "obrigado", "maya")["humor"], "feliz")
        self.assertEqual(self._chamar("analisarPergunta", "xyz", "maya")["humor"], "curioso")

    def test_texto_para_fala(self):
        falado = self._chamar("textoParaFala", "🏠 Ar em 23 °C às 9h e 21h05, CPU em 18%, 120 GB — src/ e “docs/”.")
        self.assertEqual(falado, "Ar em 23 graus às 9 horas e 21 horas e 05, CPU em 18 por cento, 120 gigas — src e docs.")

    def test_abertura_da_boca(self):
        aberturas = [self._chamar("aberturaBoca", c) for c in ("a", "Á", "o", "i", "m", "t", " ", ".")]
        self.assertEqual(aberturas, [1, 1, 0.75, 0.5, 0.05, 0.35, 0, 0])

    def test_escolher_voz(self):
        vozes = [
            {"name": "Microsoft Maria - Portuguese (Brazil)", "lang": "pt-BR"},
            {"name": "Microsoft Daniel - Portuguese (Brazil)", "lang": "pt-BR"},
            {"name": "Microsoft Antonio Online (Natural) - Portuguese (Brazil)", "lang": "pt-BR"},
            {"name": "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", "lang": "pt-BR"},
            {"name": "Joana", "lang": "pt_PT"},
            {"name": "Google US English", "lang": "en-US"},
        ]
        codigo = ("const {escolherVoz}=require(process.argv[1]);const v=JSON.parse(process.argv[2]);"
                  "const n=(x)=>x&&x.name;"
                  "console.log(JSON.stringify(['xavier','maya','gabriel'].map(a=>n(escolherVoz(v,a)))"
                  ".concat([escolherVoz([{name:'Alex',lang:'en-US'}],'maya'), n(escolherVoz([{name:'Joana',lang:'pt_PT'}],'xavier'))])));")
        self.assertEqual(self._node(codigo, json.dumps(vozes)), [
            "Microsoft Antonio Online (Natural) - Portuguese (Brazil)",
            "Microsoft Francisca Online (Natural) - Portuguese (Brazil)",
            "Microsoft Daniel - Portuguese (Brazil)",
            None,
            "Joana",
        ])

    def test_perfis_de_voz_distintos(self):
        perfis = self._node("const {PERFIS_VOZ}=require(process.argv[1]);console.log(JSON.stringify(PERFIS_VOZ));")
        self.assertEqual(set(perfis), set(ASSISTENTES))
        self.assertEqual(len({(p["tom"], p["velocidade"]) for p in perfis.values()}), 3)

    def test_papeis_para_os_tres(self):
        papeis = self._node("const {PAPEIS}=require(process.argv[1]);console.log(JSON.stringify(PAPEIS));")
        self.assertEqual(set(papeis), set(ASSISTENTES))

    def test_sintaxe(self):
        subprocess.run(["node", "--check", str(RAIZ / "js" / "main.js")], check=True)


@unittest.skipUnless(shutil.which("node") and (RAIZ / "node_modules" / "jsdom").is_dir(),
                     "jsdom não instalado (rode npm install)")
class TestDemoNoNavegador(unittest.TestCase):
    """Roda tests/demo_dom.test.js: interação real com o Demo Interativo num DOM simulado."""

    def test_interacao_completa(self):
        saida = subprocess.run(
            ["node", str(RAIZ / "tests" / "demo_dom.test.js")],
            capture_output=True, text=True, encoding="utf-8", cwd=RAIZ,
        )
        self.assertEqual(saida.returncode, 0, saida.stdout + saida.stderr)
        self.assertIn("testes de DOM passaram", saida.stdout)


class TestMensagemDeEquipe(unittest.TestCase):
    """Nenhuma resposta da demo pode empurrar a tarefa para outro assistente."""

    def test_respostas_da_demo_sem_delegacao(self):
        js = (RAIZ / "js" / "main.js").read_text(encoding="utf-8").lower()
        for trecho in ("deleg", "é com o", "é com a", "especialidade dela", "especialista em código",
                       "passe para ela", "pode agendar a execução"):
            self.assertNotIn(trecho, js)

    def test_html_sem_especialidades_exclusivas(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8").lower()
        for trecho in ("principais funções", "especialidade principal", "indica suporte"):
            self.assertNotIn(trecho, conteudo)


class TestCSS(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.css = (RAIZ / "css" / "style.css").read_text(encoding="utf-8")

    def test_media_queries(self):
        self.assertGreaterEqual(len(re.findall(r"@media\s*\(max-width", self.css)), 2)

    def test_chaves_balanceadas(self):
        self.assertEqual(self.css.count("{"), self.css.count("}"))

    def test_temas_dos_assistentes(self):
        for nome in ASSISTENTES:
            self.assertIn(f".tema-{nome}", self.css)


class TestAvatares3D(unittest.TestCase):
    """Avatares 3D (js/avatares3d.js) no lugar das fotos, com a foto mantida como reserva."""

    @classmethod
    def setUpClass(cls):
        cls.conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        cls.html = carregar_html()
        cls.css = (RAIZ / "css" / "style.css").read_text(encoding="utf-8")

    def test_three_local_carregado_sob_demanda(self):
        scripts = [a["src"].split("?")[0] for t, a in self.html.tags if t == "script" and a.get("src")]
        self.assertIn("js/avatares3d.js", scripts)
        # O Three.js (~670 KB) não bloqueia a página: avatares3d.js o injeta quando precisa.
        self.assertNotIn("js/vendor/three.min.js", scripts)
        self.assertNotIn("http", " ".join(scripts))
        js = (RAIZ / "js" / "avatares3d.js").read_text(encoding="utf-8")
        self.assertIn('"vendor/three.min.js?v="', js)
        self.assertIn("IntersectionObserver", js)
        self.assertIn("requestIdleCallback", js)
        self.assertIn("saveData", js)
        self.assertTrue((RAIZ / "js" / "vendor" / "three.min.js").is_file())

    def test_fotos_em_picture_com_avif_webp_responsivos(self):
        picture = re.findall(r"<picture>(.*?)</picture>", self.conteudo, re.S)
        self.assertEqual(len(picture), 10)
        for bloco in picture:
            tipos = re.findall(r'<source type="image/(\w+)" srcset="([^"]+)" sizes="[^"]+">', bloco)
            self.assertEqual([t for t, _ in tipos], ["avif", "webp"], bloco[:120])
            for _, srcset in tipos:
                for item in srcset.split(", "):
                    arquivo, largura = item.split(" ")
                    self.assertTrue((RAIZ / arquivo).is_file(), arquivo)
                    self.assertRegex(largura, r"^\d+w$")
            self.assertIn("if(soltarFontes(this))return;", bloco)
            self.assertIn('src="img/', bloco)  # PNG original continua como reserva
        self.assertIn("function soltarFontes(img)", self.conteudo)

    def test_versoes_otimizadas_sao_bem_menores(self):
        for png, nome in (("FAMILIA-IA.png", "familia"), ("XAVIER.png", "xavier"),
                          ("MAYA.png", "maya"), ("GABRIEL.png", "gabriel")):
            original = (RAIZ / "img" / png).stat().st_size
            for formato in ("avif", "webp"):
                maior = (RAIZ / "img" / "otimizadas" / f"{nome}-1440.{formato}").stat().st_size
                self.assertLess(maior * 10, original, f"{nome}-1440.{formato}")

    def test_foto_principal_pre_carregada_no_tamanho_certo(self):
        preload = next(a for t, a in self.html.tags if t == "link" and a.get("rel") == "preload")
        self.assertEqual(preload["as"], "image")
        familia = re.search(r'<source type="image/avif" srcset="([^"]+)" sizes="([^"]+)">\s*<source[^>]*>\s*<img[^>]*FAMILIA',
                            self.conteudo)
        self.assertEqual(preload["imagesrcset"], familia.group(1))
        self.assertEqual(preload["imagesizes"], familia.group(2))

    def test_cada_secao_tem_busto_3d_com_foto_de_reserva(self):
        for nome in ASSISTENTES:
            bloco = secao(self.conteudo, nome)
            palco = re.search(rf'<div class="avatar3d-busto" data-avatar3d="{nome}" data-avatar3d-modo="busto">(.*?)</div>',
                              bloco, re.S)
            self.assertIsNotNone(palco, nome)
            self.assertIn(f'src="img/{nome.upper()}.png"', palco.group(1))
            self.assertIn("avatar3d-dica", palco.group(1))

    def test_hero_e_cartoes_de_voz_com_rosto_3d(self):
        hero = re.findall(r'<span class="hero-avatar" data-avatar3d="(\w+)" data-avatar3d-modo="rosto"', self.conteudo)
        voz = re.findall(r'<span class="voz-foto" data-avatar3d="(\w+)" data-avatar3d-modo="rosto" data-avatar3d-fala',
                         self.conteudo)
        self.assertEqual(hero, list(ASSISTENTES))
        self.assertEqual(voz, list(ASSISTENTES))

    def test_estilos_dos_avatares_3d(self):
        for seletor in (".avatar3d-canvas", ".avatar3d-ativo > img", ".avatar3d-busto", ".avatar3d-dica"):
            self.assertIn(seletor, self.css)

    def test_sintaxe(self):
        subprocess.run(["node", "--check", str(RAIZ / "js" / "avatares3d.js")], check=True)

    @unittest.skipUnless(shutil.which("node") and (RAIZ / "node_modules" / "jsdom").is_dir(), "jsdom não instalado")
    def test_sem_three_ou_webgl_mantem_as_fotos(self):
        codigo = r"""
const fs = require('fs'); const {JSDOM} = require('jsdom');
const [html, script, three] = process.argv.slice(1).map(f => fs.readFileSync(f, 'utf-8'));
const resultado = {};
for (const comThree of [false, true]) {
  const dom = new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true});
  const erros = [];
  dom.window.addEventListener('error', e => erros.push(String(e.message)));
  dom.virtualConsole.on('jsdomError', e => erros.push(String(e.message)));
  if (comThree) dom.window.eval(three);
  dom.window.eval(script);
  const a = dom.window.Avatares3D;
  resultado[comThree ? 'comThree' : 'semThree'] = {ativo: a.ativo, motivo: a.motivo,
    ativos: dom.window.document.querySelectorAll('.avatar3d-ativo, canvas.avatar3d-canvas').length,
    erros: erros.filter(e => !/getContext|WebGL/i.test(e))};
}
console.log(JSON.stringify(resultado));
"""
        saida = subprocess.run(
            ["node", "-e", codigo, str(RAIZ / "index.html"), str(RAIZ / "js" / "avatares3d.js"),
             str(RAIZ / "js" / "vendor" / "three.min.js")],
            capture_output=True, text=True, encoding="utf-8", cwd=RAIZ, check=True,
        ).stdout
        resultado = json.loads(saida.strip().splitlines()[-1])
        # Sem Three.js na página: o jsdom não tem WebGL, então nem chega a baixar o three.min.js.
        self.assertEqual(resultado["semThree"], {"ativo": False, "motivo": "sem-webgl", "ativos": 0, "erros": []})
        self.assertEqual(resultado["comThree"], {"ativo": False, "motivo": "sem-webgl", "ativos": 0, "erros": []})


class TestImportarImagens(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.origem = base / "Downloads"
        self.destino = base / "img"
        self.origem.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def _criar_imagem(self, nome, formato="JPEG"):
        from PIL import Image

        caminho = self.origem / nome
        Image.new("RGB", (10, 10), "red").save(caminho, formato)
        return caminho

    def test_normalizar(self):
        self.assertEqual(importar_imagens.normalizar("Gábriel FOTO"), "gabriel foto")

    def test_move_os_quatro_arquivos_com_nomes_do_site(self):
        from PIL import Image

        for nome in ("XAVIER.png", "MAYA.png", "GABRIEL.png", "FAMILIA IA.png"):
            self._criar_imagem(nome, "PNG")
        (self.origem / "outro.png").write_bytes(b"x")

        resultado = importar_imagens.importar([self.origem], self.destino)

        self.assertEqual(set(resultado), {*ASSISTENTES, "familia"})
        for nome in importar_imagens.ARQUIVOS.values():
            arquivo = self.destino / nome
            self.assertTrue(arquivo.is_file(), nome)
            self.assertFalse((self.origem / nome).exists(), nome)
            with Image.open(arquivo) as img:
                self.assertEqual(img.format, "PNG")
        self.assertTrue((self.destino / "FAMILIA IA.png").is_file())
        self.assertFalse((self.origem / "FAMILIA IA.png").exists())
        self.assertTrue((self.origem / "outro.png").exists())

    def test_converte_outros_formatos_para_png(self):
        from PIL import Image

        self._criar_imagem("Foto_Xavier.jpg")
        (self.origem / "xavier.txt").write_text("não é imagem")
        importar_imagens.importar([self.origem], self.destino)
        with Image.open(self.destino / "XAVIER.png") as img:
            self.assertEqual(img.format, "PNG")
        self.assertFalse((self.origem / "Foto_Xavier.jpg").exists())
        self.assertTrue((self.origem / "xavier.txt").exists())

    def test_nomes_batem_com_o_html(self):
        conteudo = (RAIZ / "index.html").read_text(encoding="utf-8")
        for nome in importar_imagens.ARQUIVOS.values():
            self.assertIn(f'src="img/{nome}"', conteudo)
        for copias in importar_imagens.COPIAS.values():
            for nome in copias:
                self.assertIn(f'data-reserva="img/{nome.replace(" ", "%20")}"', conteudo)

    def test_copiar_mantem_original(self):
        self._criar_imagem("maya.jpg")
        importar_imagens.importar([self.origem], self.destino, mover=False)
        self.assertTrue((self.origem / "maya.jpg").exists())
        self.assertTrue((self.destino / "MAYA.png").exists())

    def test_main_sem_imagens(self):
        codigo = importar_imagens.main(["--origem", str(self.origem), "--destino", str(self.destino)])
        self.assertEqual(codigo, 0)
        self.assertFalse(self.destino.exists() and any(self.destino.iterdir()))


if __name__ == "__main__":
    unittest.main()
