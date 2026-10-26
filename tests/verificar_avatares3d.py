"""Confere os avatares 3D (js/avatares3d.js) num navegador real (Playwright).

Uso: python tests/verificar_avatares3d.py   (prints em tests/prints/avatar3d-*.png)
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
PRINTS = Path(__file__).resolve().parent / "prints"
URL = (RAIZ / "index.html").as_uri()

# Fração de pixels não transparentes no canvas 2D do avatar (0 = canvas vazio).
PIXELS_DESENHADOS = """(el) => {
    const c = el.querySelector('canvas.avatar3d-canvas');
    if (!c || !c.width) return 0;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let cheios = 0;
    for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 10) cheios++;
    return cheios / (d.length / (4 * 7));
}"""

ESTADO = """(chave_modo) => {
    const [chave, modo] = chave_modo;
    const v = window.Avatares3D.vistas.find(v => v.chave === chave && v.modo === modo && v.visivel);
    return v ? window.Avatares3D.estado(v) : null;
}"""


def abrir(p):
    for canal in ("msedge", "chrome", None):
        try:
            return p.chromium.launch(channel=canal) if canal else p.chromium.launch()
        except Exception:
            continue
    raise SystemExit("Nenhum navegador Chromium disponível para o Playwright.")


def checar(nome, cond, falhas, detalhe=""):
    print(("ok   " if cond else "FALHA ") + nome + (f" ({detalhe})" if detalhe else ""))
    if not cond:
        falhas.append(nome)


def desempenho(navegador, falhas):
    """Carregamento leve: Three.js fora do caminho crítico, fotos em AVIF no tamanho certo, Save-Data respeitado."""
    print("--- desempenho")
    for rotulo, largura, altura in (("desktop", 1366, 860), ("celular", 390, 844)):
        pagina = navegador.new_page(viewport={"width": largura, "height": altura},
                                    device_scale_factor=2 if rotulo == "celular" else 1)
        pedidos = []
        pagina.on("requestfinished", lambda r: pedidos.append(r))
        # Na hora em que o HTML fica pronto (DOMContentLoaded) o Three.js ainda não pode ter sido executado.
        pagina.add_init_script("document.addEventListener('DOMContentLoaded', () => {"
                               " window.__noDCL = {three: !!window.THREE, estado: document.documentElement.dataset.avatares3d}; })")
        pagina.goto(URL)
        pagina.wait_for_load_state("load")
        pagina.wait_for_function("document.documentElement.dataset.avatares3d === 'ativo'", timeout=30000)
        # (file:// não gera Resource Timing; confere pelo estado no DOMContentLoaded e pelo <script> injetado.)
        info = pagina.evaluate("""() => {
            const s = [...document.scripts].filter(e => e.src.includes('three.min.js'));
            return {dcl: window.__noDCL, scripts: s.length, injetado: s.length === 1 && s[0].async && s[0].parentNode === document.head};
        }""")
        checar(f"{rotulo}: Three.js fora do caminho crítico (baixado depois, sem bloquear)",
               info == {"dcl": {"three": False, "estado": "carregando"}, "scripts": 1, "injetado": True}, falhas, str(info))
        imagens = [r for r in pedidos if r.resource_type == "image" and "/img/" in r.url]
        pngs = [r.url.rsplit("/", 1)[-1] for r in imagens if r.url.endswith(".png")]
        checar(f"{rotulo}: fotos chegam em AVIF (nenhum PNG pesado)", imagens and not pngs, falhas,
               ", ".join(sorted({r.url.rsplit('/', 1)[-1] for r in imagens})))
        total = sum(len(r.response().body()) for r in imagens if r.response())
        checar(f"{rotulo}: fotos da primeira tela somam menos de 200 KB", total < 200_000, falhas, f"{total // 1024} KB")
        hero = pagina.evaluate("document.querySelector('.hero-familia img').currentSrc.split('/').pop()")
        checar(f"{rotulo}: foto principal no tamanho certo", hero.endswith(".avif"), falhas, hero)
        pagina.close()

    # Economia de dados: fica só com as fotos leves e não baixa o Three.js.
    pagina = navegador.new_page(viewport={"width": 390, "height": 844})
    pagina.add_init_script("Object.defineProperty(navigator, 'connection', {value: {saveData: true, effectiveType: '3g'}})")
    pedidos = []
    pagina.on("request", lambda r: pedidos.append(r.url))
    pagina.goto(URL)
    pagina.wait_for_load_state("load")
    pagina.mouse.wheel(0, 3000)
    pagina.wait_for_timeout(1500)
    info = pagina.evaluate("({estado: document.documentElement.dataset.avatares3d, aviso: !!document.querySelector('.avatar3d-aviso'),"
                           " opacidade: getComputedStyle(document.querySelector('#maya img')).opacity})")
    checar("Save-Data: fotos leves, sem aviso e sem baixar Three.js",
           info == {"estado": "economia-dados", "aviso": False, "opacidade": "1"}
           and not any("three.min.js" in u for u in pedidos), falhas, str(info))
    pagina.close()

    # ?avatares3d=1 força o 3D mesmo com economia de dados.
    pagina = navegador.new_page(viewport={"width": 1366, "height": 860})
    pagina.add_init_script("Object.defineProperty(navigator, 'connection', {value: {saveData: true}})")
    pagina.goto(URL + "?avatares3d=1")
    pagina.wait_for_function("document.documentElement.dataset.avatares3d === 'ativo'", timeout=30000)
    checar("?avatares3d=1 força o 3D", True, falhas)
    pagina.close()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    PRINTS.mkdir(exist_ok=True)
    falhas = []
    with sync_playwright() as p:
        navegador = abrir(p)
        print("navegador:", navegador.browser_type.name, navegador.version)
        for rotulo, largura, altura in (("desktop", 1366, 860), ("celular", 390, 844)):
            pagina = navegador.new_page(viewport={"width": largura, "height": altura})
            erros = []
            pagina.on("pageerror", lambda e: erros.append(str(e)))
            pagina.on("console", lambda m: m.type == "error" and erros.append(m.text))
            pagina.goto(URL)
            pagina.wait_for_load_state("load")
            print(f"--- {rotulo} {largura}x{altura}")
            # O Three.js chega sob demanda (avatar perto da tela ou navegador ocioso).
            pagina.wait_for_function("document.documentElement.dataset.avatares3d === 'ativo'", timeout=30000)
            pagina.wait_for_timeout(300)

            api = pagina.evaluate("({ativo: Avatares3D.ativo, motivo: Avatares3D.motivo, n: Avatares3D.vistas.length})")
            checar("Avatares3D ativo com 9 avatares", api["ativo"] and api["n"] == 9, falhas, str(api))
            marca = pagina.evaluate("[document.documentElement.dataset.avatares3d, !!document.querySelector('.avatar3d-aviso')]")
            checar("<html data-avatares3d=ativo> e sem aviso de falha", marca == ["ativo", False], falhas, str(marca))
            ativos = pagina.evaluate("document.querySelectorAll('[data-avatar3d].avatar3d-ativo canvas.avatar3d-canvas').length")
            checar("cada ponto de avatar ganhou canvas", ativos == 9, falhas, str(ativos))

            # Cartões do hero (rosto), abaixo da foto do grupo: só desenham quando aparecem na tela.
            pagina.locator(".hero-cartoes").scroll_into_view_if_needed()
            pagina.wait_for_timeout(500)
            pagina.locator(".hero-cartoes").screenshot(path=str(PRINTS / f"avatar3d-{rotulo}-hero.png"))
            for el in pagina.query_selector_all(".hero-avatar[data-avatar3d]"):
                fr = el.evaluate(PIXELS_DESENHADOS)
                checar(f"hero {el.get_attribute('data-avatar3d')} desenhado", fr > 0.2, falhas, f"{fr:.2f}")

            for nome in ("xavier", "maya", "gabriel"):
                palco = pagina.locator(f"#{nome} [data-avatar3d]")
                palco.scroll_into_view_if_needed()
                pagina.wait_for_timeout(900)  # dá tempo da saudação começar
                fr = palco.evaluate(PIXELS_DESENHADOS)
                checar(f"{nome}: busto desenhado no canvas", fr > 0.15, falhas, f"{fr:.2f}")
                estado = pagina.evaluate(ESTADO, [nome, "busto"])
                checar(f"{nome}: acena ao aparecer", estado and estado["ombro"] > 1.0, falhas, str(estado))
                foto_oculta = palco.evaluate("el => getComputedStyle(el.querySelector('img')).opacity")
                checar(f"{nome}: foto antiga substituída (fica só como reserva)", foto_oculta == "0", falhas)
                pagina.screenshot(path=str(PRINTS / f"avatar3d-{rotulo}-{nome}.png"))

                if rotulo == "desktop":
                    caixa = palco.bounding_box()
                    pagina.wait_for_timeout(2600)  # termina a saudação
                    pagina.mouse.move(5, caixa["y"] + caixa["height"] * 0.3)
                    pagina.wait_for_timeout(700)
                    esq = pagina.evaluate(ESTADO, [nome, "busto"])["cabecaY"]
                    pagina.mouse.move(largura - 5, caixa["y"] + caixa["height"] * 0.3, steps=6)
                    pagina.wait_for_timeout(700)
                    dir_ = pagina.evaluate(ESTADO, [nome, "busto"])["cabecaY"]
                    checar(f"{nome}: cabeça segue o mouse", dir_ - esq > 0.3, falhas, f"esq={esq:.2f} dir={dir_:.2f}")
                    # Ao cruzar a tela o mouse pode ter passado sobre o avatar (aceno + 3 s de intervalo).
                    pagina.mouse.move(largura - 5, 5)
                    pagina.wait_for_timeout(3100)
                    pagina.mouse.move(caixa["x"] + caixa["width"] / 2, caixa["y"] + caixa["height"] / 2, steps=4)
                    pagina.wait_for_timeout(600)
                    ombro = pagina.evaluate(ESTADO, [nome, "busto"])["ombro"]
                    checar(f"{nome}: acena ao passar o mouse", ombro > 1.0, falhas, f"ombro={ombro:.2f}")
                    palco.screenshot(path=str(PRINTS / f"avatar3d-{nome}-acenando.png"))
                else:
                    pagina.wait_for_timeout(2600)
                    palco.click()
                    pagina.wait_for_timeout(600)
                    ombro = pagina.evaluate(ESTADO, [nome, "busto"])["ombro"]
                    checar(f"{nome}: acena ao tocar", ombro > 1.0, falhas, f"ombro={ombro:.2f}")

            # Cartões de voz: rosto 3D com a boca falando.
            pagina.locator("#demo-assistentes .voz-grade").scroll_into_view_if_needed()
            pagina.wait_for_timeout(800)
            for nome in ("xavier", "maya", "gabriel"):
                el = pagina.locator(f".voz-cartao.tema-{nome} [data-avatar3d]")
                # O cartão levita (animação CSS), então rola por JS em vez de esperar ele "parar".
                el.evaluate("e => e.scrollIntoView({block: 'center'})")
                pagina.wait_for_timeout(300)
                fr = el.evaluate(PIXELS_DESENHADOS)
                checar(f"voz {nome}: rosto desenhado", fr > 0.2, falhas, f"{fr:.2f}")
                bocas = []
                for _ in range(40):  # ~3,6 s: cobre uma frase inteira e a pausa
                    bocas.append(pagina.evaluate(ESTADO, [nome, "rosto"])["boca"])
                    pagina.wait_for_timeout(90)
                checar(f"voz {nome}: boca mexe falando", max(bocas) - min(bocas) > 0.15, falhas,
                       f"{min(bocas):.2f}..{max(bocas):.2f}")
            pagina.screenshot(path=str(PRINTS / f"avatar3d-{rotulo}-voz.png"))
            checar("sem erros de JavaScript", not erros, falhas, " | ".join(erros))
            pagina.close()

        # Sem WebGL: as fotos continuam no lugar.
        pagina = navegador.new_page(viewport={"width": 1366, "height": 860})
        pagina.add_init_script("HTMLCanvasElement.prototype.getContext = (function (orig) {"
                               " return function (tipo, o) { return /webgl/.test(tipo) ? null : orig.call(this, tipo, o); };"
                               "})(HTMLCanvasElement.prototype.getContext);")
        erros = []
        pagina.on("pageerror", lambda e: erros.append(str(e)))
        pagina.goto(URL)
        pagina.wait_for_load_state("load")
        pagina.wait_for_timeout(300)
        info = pagina.evaluate("({ativo: Avatares3D.ativo, motivo: Avatares3D.motivo,"
                               " ativos: document.querySelectorAll('.avatar3d-ativo').length,"
                               " opacidade: getComputedStyle(document.querySelector('#maya img')).opacity})")
        checar("sem WebGL: fotos originais ficam visíveis", not info["ativo"] and info["ativos"] == 0
               and info["opacidade"] == "1", falhas, str(info))
        checar("sem WebGL: nenhum erro de JavaScript", not erros, falhas, " | ".join(erros))
        aviso = pagina.evaluate("({estado: document.documentElement.dataset.avatares3d,"
                                " texto: (document.querySelector('.avatar3d-aviso') || {}).textContent || ''})")
        checar("sem WebGL: aviso visível explica o motivo", aviso["estado"] == "sem-webgl"
               and "WebGL" in aviso["texto"] and pagina.is_visible(".avatar3d-aviso"), falhas, str(aviso))
        pagina.screenshot(path=str(PRINTS / "avatar3d-sem-webgl-aviso.png"))
        pagina.click(".avatar3d-aviso button")
        checar("sem WebGL: aviso fecha no ×", pagina.locator(".avatar3d-aviso").count() == 0, falhas)
        pagina.close()

        # Three.js ausente (arquivo não carregou): também avisa em vez de ficar igual a antes.
        pagina = navegador.new_page(viewport={"width": 1366, "height": 860})
        pagina.route("**/three.min.js*", lambda r: r.abort())
        pagina.goto(URL)
        pagina.wait_for_load_state("load")
        try:
            pagina.wait_for_function("document.documentElement.dataset.avatares3d === 'sem-three'", timeout=10000)
        except Exception:
            pass
        info = pagina.evaluate("({motivo: Avatares3D.motivo, aviso: !!document.querySelector('.avatar3d-aviso')})")
        checar("sem three.min.js: aviso aparece", info["motivo"] == "sem-three" and info["aviso"], falhas, str(info))
        pagina.close()

        desempenho(navegador, falhas)
        navegador.close()
    print(f"\n{'TUDO OK' if not falhas else str(len(falhas)) + ' falha(s): ' + ', '.join(falhas)}")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
