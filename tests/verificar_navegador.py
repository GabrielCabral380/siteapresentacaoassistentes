"""Confere o site num navegador real (Playwright): layout sem galeria e avatar do Demo Interativo.

Uso: python tests/verificar_navegador.py   (prints em tests/prints/)
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
PRINTS = Path(__file__).resolve().parent / "prints"
URL = (RAIZ / "index.html").as_uri()


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

            info = pagina.evaluate("""() => ({
                secoes: [...document.querySelectorAll('main section[id]')].map(s => s.id),
                largura: document.documentElement.scrollWidth,
                altura: document.documentElement.scrollHeight,
                rodape: !!document.querySelector('footer'),
                imgs: [...document.images].map(i => [i.getAttribute('src'), i.naturalWidth]),
                menu: [...document.querySelectorAll('.menu a')].map(a => a.getAttribute('href')),
            })""")
            checar("última seção é a demo de voz", info["secoes"][-1] == "demo-assistentes", falhas, info["secoes"][-1])
            checar("galeria/contato/rodapé ausentes",
                   not ({"galeria", "contato"} & set(info["secoes"])) and not info["rodape"], falhas)
            # Halos e orbes decorativos passam da borda no celular (já era assim antes da remoção da galeria);
            # o body com overflow-x: hidden é o que impede o arrasto lateral.
            corta = pagina.evaluate("getComputedStyle(document.body).overflowX") == "hidden"
            checar("excesso lateral cortado pelo body", info["largura"] <= largura or corta, falhas,
                   f"conteúdo {info['largura']}px / tela {largura}px")
            checar("menu sem links para seções removidas",
                   not ({"#galeria", "#contato"} & set(info["menu"])), falhas, ", ".join(info["menu"]))
            # Imagens com lazy loading só carregam perto da tela: rola a página inteira aos poucos.
            for y in range(0, info["altura"] + altura, altura // 2):
                pagina.evaluate(f"window.scrollTo(0, {y})")
                pagina.wait_for_timeout(120)
            pagina.wait_for_timeout(800)
            quebradas = pagina.evaluate("[...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src)")
            checar("todas as imagens carregaram", not quebradas, falhas, ", ".join(quebradas))
            fim = pagina.evaluate("""() => {
                const s = document.getElementById('demo-assistentes').getBoundingClientRect();
                return [Math.round(s.bottom + scrollY), document.documentElement.scrollHeight];
            }""")
            checar("página termina logo após a demo de voz", abs(fim[0] - fim[1]) <= 2, falhas, f"{fim}")
            pagina.screenshot(path=str(PRINTS / f"{rotulo}-fim-da-pagina.png"))

            # ----- Avatar do Demo Interativo -----
            demo = pagina.locator("#demo")
            demo.scroll_into_view_if_needed()
            pagina.wait_for_timeout(900)
            palco = pagina.locator("[data-palco]")
            checar("avatar começa ocioso", palco.get_attribute("data-estado") == "ocioso", falhas)
            caixa = palco.bounding_box()
            checar("palco do avatar visível e com tamanho", caixa and caixa["width"] > 150 and caixa["height"] > 150,
                   falhas, json.dumps({k: round(v) for k, v in (caixa or {}).items()}))

            if rotulo == "desktop":
                # O olhar segue o ponteiro (só dentro da caixa da demo).
                area = pagina.locator("[data-demo]").bounding_box()
                meio_y = caixa["y"] + caixa["height"] / 2
                pagina.mouse.move(area["x"] + area["width"] - 10, meio_y)
                pagina.wait_for_timeout(400)
                olhar_dir = pagina.evaluate("getComputedStyle(document.querySelector('[data-palco]')).getPropertyValue('--olhar-x')")
                pagina.mouse.move(area["x"] + 10, meio_y, steps=5)
                pagina.wait_for_timeout(400)
                olhar_esq = pagina.evaluate("getComputedStyle(document.querySelector('[data-palco]')).getPropertyValue('--olhar-x')")
                checar("olhar do avatar segue o mouse", olhar_dir.strip() != olhar_esq.strip(), falhas,
                       f"direita={olhar_dir.strip()!r} esquerda={olhar_esq.strip()!r}")

            # Troca de assistente.
            pagina.locator(".demo-escolha[data-assistente='maya']").click()
            pagina.wait_for_timeout(300)
            checar("trocar para Maya atualiza o palco",
                   pagina.locator("[data-palco-nome]").inner_text().strip() == "Maya"
                   and "tema-maya" in pagina.locator("[data-demo]").get_attribute("class"), falhas)

            # Envia mensagem e acompanha os estados do avatar.
            pagina.evaluate("""() => {
                window.__estados = [];
                const palco = document.querySelector('[data-palco]');
                new MutationObserver(() => window.__estados.push(palco.dataset.estado))
                    .observe(palco, { attributes: true, attributeFilter: ['data-estado'] });
            }""")
            pagina.fill("#demo-pergunta", "Acende a luz da sala")
            pagina.locator(".demo-enviar").click()
            pagina.wait_for_timeout(700)
            pagina.screenshot(path=str(PRINTS / f"{rotulo}-avatar-respondendo.png"))
            pagina.wait_for_function("document.querySelector('[data-palco]').dataset.estado === 'ocioso'", timeout=20000)
            estados = pagina.evaluate("window.__estados")
            checar("avatar passa por pensando e falando e volta a ocioso",
                   "pensando" in estados and "falando" in estados and estados[-1] == "ocioso", falhas, " → ".join(estados))
            resposta = pagina.locator(".demo-msg.demo-assistente .demo-msg-texto").last.inner_text()
            checar("resposta da Maya aparece no chat", "23" in resposta, falhas, resposta[:60])
            demo.screenshot(path=str(PRINTS / f"{rotulo}-demo-avatar.png"))
            checar("sem erros de JavaScript", not erros, falhas, " | ".join(erros))
            pagina.close()
        navegador.close()
    print(f"\n{'TUDO OK' if not falhas else str(len(falhas)) + ' falha(s): ' + ', '.join(falhas)}")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
