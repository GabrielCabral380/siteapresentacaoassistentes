# Status verificado em 24/10/2026

- index.html estava corrompido (bytes UTF-8 inválidos no bloco `#nova-interface`, linha do menu com `` `n `` literal e uma segunda `<section id="demo">` em Tailwind, que o site não carrega). Os três trechos foram removidos; cópias dos arquivos originais estão em `backup/*.antes-avatar-20261024`.
- Demo Interativo (#demo) ganhou avatar vivo (olhar, expressões, estado "ouvindo", boca sincronizada), voz de saída (speechSynthesis), voz de entrada (SpeechRecognition) com modo conversa, memória do nome e respostas a "sim"/"não". Detalhes no README.
- A análise dos arquivos atuais confirmou que a galeria, os vídeos “em breve”, o contato e o rodapé já estavam removidos. O menu não aponta para seções removidas; CSS e JavaScript não contêm os antigos filtros e players. A página termina em `#demo-assistentes`. Não foi necessário alterar novamente HTML, CSS ou JavaScript.
- Nova execução: `python -m unittest discover -s tests -v` → 75 testes OK, incluindo a suíte de interação no jsdom, com síntese e reconhecimento de voz simulados.
- `python tests/verificar_navegador.py` → TUDO OK no Chromium 156, em 1366×860 e 390×844. Imagens carregadas, término da página sem espaço residual e nenhum erro de JavaScript. Capturas atualizadas em `tests/prints/`; conferidas visualmente as demos em desktop/celular e o final da página no celular.
- Avatar confirmado no navegador: visível, troca para Maya, olhar seguindo o mouse no desktop, resposta no chat e estados pensando → falando → ocioso. O layout móvel mantém o corte de elementos decorativos laterais já existente.
## Avatares 3D (25/10/2026)

- As fotos de Xavier, Maya e Gabriel nas seções `#xavier`, `#maya` e `#gabriel` (busto), nos cartões do hero (rosto) e nos cartões de `#demo-assistentes` (rosto falando) agora são personagens 3D em Three.js 0.159 local (`js/vendor/three.min.js`, script clássico porque o site abre via `file://`). Código em `js/avatares3d.js`; estilos no bloco "Avatares 3D" de `css/style.css`.
- Animações: respiração, piscar, cabeça e olhos seguindo o mouse/toque, aceno ao aparecer na tela, ao passar o mouse e ao clicar/tocar; boca falando nos cartões de voz. Um único contexto WebGL desenha os 9 avatares; só renderiza os visíveis.
- As `<img>` continuam no HTML como reserva: sem Three.js ou WebGL, as fotos aparecem como antes. Backup: `backup/*.antes-3d-20261025`.
- Testes: `python -m unittest discover -s tests` → 81 OK (6 novos em `TestAvatares3D`); `python tests/verificar_navegador.py` → TUDO OK; `python tests/verificar_avatares3d.py` → TUDO OK no Chromium 156 (desktop e celular, incluindo o caso sem WebGL). Prints em `tests/prints/avatar3d-*.png`.

## Correção "nada mudou" (25/10/2026)

- Conferido: `js/avatares3d.js` e `js/vendor/three.min.js` estão nas pastas certas, o `index.html` os carrega e os 9 pontos `data-avatar3d` (hero, seções, cartões de voz) existem. Só há uma cópia do site no Desktop. No Edge 156 e Chrome 155 instalados (janela visível, também com `--disable-gpu`) o 3D ativa com 9 canvas.
- Causas prováveis do "nada mudou": aba antiga sem recarregar / HTML em cache, ou falha silenciosa do 3D (as fotos de reserva ficavam iguais a antes).
- Corrigido: metas no-cache no `index.html` e `?v=20261025-2` em CSS/JS; se o 3D não ativar, aparece um aviso visível com o motivo (sem WebGL, three.min.js não carregou etc.) e `<html data-avatares3d>` mostra o estado. Backup: `backup/*.antes-correcao3d-20261025`.
- Testes: `verificar_avatares3d.py` TUDO OK (4 checagens novas: marca "ativo", aviso sem WebGL, fechar aviso, aviso sem three.min.js); `verificar_navegador.py` TUDO OK; unittest 81 OK.

- Limite da verificação: não houve escuta humana do áudio nem entrada de voz por microfone físico; esses fluxos foram cobertos com APIs simuladas nos testes de DOM.

## Avatares 3D: qualidade e desempenho (25/10/2026)

- Fotos: `tools/otimizar_imagens.py` gera AVIF e WebP em 240/480/960/1440 px (`img/otimizadas/`). As 10 fotos estão em `<picture>` com `srcset`/`sizes`; o PNG original continua como reserva no `src` (cadeia: AVIF/WebP → PNG → SVG, via `soltarFontes` no `<head>`). A foto principal tem `preload` no tamanho certo. Na primeira tela as fotos baixadas somam 38 KB (desktop) e 55 KB (celular), contra cerca de 8 MB de PNG antes.
- Three.js sob demanda: saiu do `<head>`. `js/avatares3d.js` testa WebGL antes e injeta `js/vendor/three.min.js` quando um avatar chega a 600 px da tela, ou no tempo ocioso depois do `load` em conexão 4G. Com Save-Data ou `prefers-reduced-data`, ficam só as fotos leves. `?avatares3d=1` força o 3D; `?avatares3d=0` desliga.
- Visual: estúdio virtual por assistente (PMREM gerado na hora, sem arquivo HDR), materiais físicos (pele/cabelo/tecido com sheen, olhos com verniz), tone mapping ACES, shaders compilados antes da troca (`compileAsync`) e fade-in da foto para o 3D.
- Desempenho: a resolução se adapta entre 50% e 100% da densidade de pixels conforme o custo do quadro. Medido: 1,00 com CPU normal (8 ms/quadro) e 0,50 com CPU 6× mais lenta.
- Backup: `backup/*.antes-otimizacao-20261025`.
- Testes: unittest 84 OK (novos: picture/AVIF, tamanhos, preload, Three.js sob demanda); `node tests/demo_dom.test.js` 20/20; `verificar_navegador.py` TUDO OK; `verificar_avatares3d.py` TUDO OK, com 10 checagens novas de desempenho (Three.js fora do caminho crítico, só AVIF, bytes, Save-Data, `?avatares3d=1`).
