"""Gera versões leves (AVIF e WebP, em várias larguras) das fotos de img/ para o <picture> do site.

Uso: python tools/otimizar_imagens.py        (saída em img/otimizadas/<nome>-<largura>.avif|webp)

Os PNG originais continuam em img/ e são a reserva do <img src> para navegadores sem AVIF/WebP.
Rodar de novo depois de trocar uma foto (importar_imagens.py); só regrava o que mudou.
"""
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "img"
DESTINO = ORIGEM / "otimizadas"

FOTOS = {"FAMILIA-IA.png": "familia", "XAVIER.png": "xavier", "MAYA.png": "maya", "GABRIEL.png": "gabriel"}
LARGURAS = (240, 480, 960, 1440)
QUALIDADE = {"avif": 52, "webp": 80}


def gerar(origem: Path, nome: str) -> list[Path]:
    feitos = []
    with Image.open(origem) as foto:
        foto = foto.convert("RGB")  # as fotos não têm transparência útil; RGB comprime melhor
        for largura in LARGURAS:
            largura = min(largura, foto.width)
            altura = round(foto.height * largura / foto.width)
            reduzida = foto.resize((largura, altura), Image.LANCZOS) if largura != foto.width else foto
            for formato, qualidade in QUALIDADE.items():
                saida = DESTINO / f"{nome}-{largura}.{formato}"
                if saida.exists() and saida.stat().st_mtime >= origem.stat().st_mtime:
                    feitos.append(saida)
                    continue
                opcoes = {"quality": qualidade}
                opcoes["method" if formato == "webp" else "speed"] = 6
                reduzida.save(saida, formato.upper(), **opcoes)
                feitos.append(saida)
    return feitos


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    DESTINO.mkdir(exist_ok=True)
    total_png = total_novo = 0
    for arquivo, nome in FOTOS.items():
        origem = ORIGEM / arquivo
        if not origem.exists():
            print(f"faltando: {origem}")
            return 1
        feitos = gerar(origem, nome)
        total_png += origem.stat().st_size
        maior = max((f for f in feitos if f.suffix == ".avif"), key=lambda f: f.stat().st_size)
        total_novo += maior.stat().st_size
        print(f"{arquivo}: {origem.stat().st_size // 1024} KB -> maior AVIF {maior.name} {maior.stat().st_size // 1024} KB")
    print(f"PNG originais: {total_png // 1024} KB | maiores AVIF: {total_novo // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
