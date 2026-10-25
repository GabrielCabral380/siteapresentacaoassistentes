"""Move as imagens dos assistentes de Downloads/IA para a pasta img/ do projeto.

Uso:
    python importar_imagens.py                 # procura em ~/Downloads/IA
    python importar_imagens.py --origem PASTA  # procura numa pasta específica
    python importar_imagens.py --copiar        # copia em vez de mover

Arquivos cujo nome contém "xavier", "maya", "gabriel" ou "familia" (sem
diferenciar maiúsculas/acentos) são salvos em img/ com os nomes usados pelo
index.html: XAVIER.png, MAYA.png, GABRIEL.png e FAMILIA-IA.png (sem espaço no
nome, para o caminho funcionar em qualquer servidor). A foto do grupo também é
copiada para "FAMILIA IA.png", a reserva que o HTML tenta se a primeira falhar.
Imagens que não são PNG são convertidas com o Pillow (se instalado); senão, o
arquivo é apenas renomeado (navegadores detectam o formato pelo conteúdo).
"""
import argparse
import shutil
import sys
import unicodedata
from pathlib import Path

ARQUIVOS = {
    "xavier": "XAVIER.png",
    "maya": "MAYA.png",
    "gabriel": "GABRIEL.png",
    "familia": "FAMILIA-IA.png",
}
# Cópias extras gravadas ao lado do arquivo principal.
COPIAS = {"familia": ["FAMILIA IA.png"]}
EXTENSOES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
PASTA_PROJETO = Path(__file__).resolve().parent
DESTINO_PADRAO = PASTA_PROJETO / "img"


def normalizar(texto):
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return sem_acento.lower()


def pastas_origem_padrao():
    home = Path.home()
    candidatas = [
        home / "Downloads" / "IA",
        home / "OneDrive" / "Downloads" / "IA",
    ]
    return [p for p in candidatas if p.is_dir()]


def encontrar_imagens(pastas):
    """Retorna {chave: Path} com a imagem mais recente de cada chave de ARQUIVOS."""
    achadas = {}
    for pasta in pastas:
        for arquivo in Path(pasta).iterdir():
            if not arquivo.is_file() or arquivo.suffix.lower() not in EXTENSOES:
                continue
            nome = normalizar(arquivo.stem)
            for chave in ARQUIVOS:
                if chave in nome:
                    atual = achadas.get(chave)
                    if atual is None or arquivo.stat().st_mtime > atual.stat().st_mtime:
                        achadas[chave] = arquivo
                    break
    return achadas


def salvar_como_png(origem, destino, mover=True):
    destino.parent.mkdir(parents=True, exist_ok=True)
    if origem.suffix.lower() != ".png":
        try:
            from PIL import Image

            with Image.open(origem) as img:
                img.save(destino, "PNG")
            if mover:
                origem.unlink()
            return destino
        except ImportError:
            pass
    if mover:
        shutil.move(str(origem), str(destino))
    else:
        shutil.copy2(origem, destino)
    return destino


def importar(pastas, destino=DESTINO_PADRAO, mover=True):
    achadas = encontrar_imagens(pastas)
    resultado = {}
    for chave, origem in achadas.items():
        salvo = salvar_como_png(origem, Path(destino) / ARQUIVOS[chave], mover)
        for extra in COPIAS.get(chave, []):
            shutil.copy2(salvo, Path(destino) / extra)
        resultado[chave] = salvo
    return resultado


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--origem", action="append", help="pasta onde procurar (pode repetir)")
    parser.add_argument("--destino", default=str(DESTINO_PADRAO))
    parser.add_argument("--copiar", action="store_true", help="copia em vez de mover")
    args = parser.parse_args(argv)

    pastas = [Path(p) for p in args.origem] if args.origem else pastas_origem_padrao()
    if not pastas:
        print("Pasta Downloads/IA não encontrada. Use --origem PASTA.")
        return 1

    resultado = importar(pastas, Path(args.destino), mover=not args.copiar)
    for chave, nome in ARQUIVOS.items():
        if chave in resultado:
            print(f"OK  {nome}: {resultado[chave]}")
        else:
            print(f"--  {nome}: imagem não encontrada (o site usa o avatar SVG de reserva)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
