# Marcadores de taça — bordado (Barudan)

Gera um arquivo **.DST** (formato Tajima, que as Barudan leem) por convidado,
com o nome ou as iniciais em fonte cursiva já digitalizada para bordado
(fontes do [Ink/Stitch](https://inkstitch.org), em ponto *satin*).

> A lista de convidados **não** vai para o git (ver `.gitignore`). Crie
> `bordado/convidados.txt` localmente, um nome por linha (`Ana|Beatriz` quebra
> em duas linhas).

## Preparar (uma vez)

```sh
pip install inkex --no-deps
pip install tinycss2 cssselect lxml networkx shapely numpy platformdirs jinja2 \
            tomli colormath2 flask trimesh diskcache pystitch fonttools pillow
git clone --depth 1 https://github.com/inkstitch/inkstitch /tmp/inkstitch
rmdir /tmp/inkstitch/fonts
git clone --depth 1 https://github.com/inkstitch/embroidery-fonts /tmp/inkstitch/fonts
```

(wxPython não é necessário — o script substitui a interface gráfica por um stub.)

## Gerar

```sh
# nome inteiro, até 60 x 14 mm
python3 bordado/gerar_marcadores.py --inkstitch /tmp/inkstitch \
  --nomes bordado/convidados.txt --fonte Montecarlo \
  --altura 14 --largura 60 --espaco 8 --veludo --saida bordado/saida

# só iniciais, até 45 x 25 mm
python3 bordado/gerar_marcadores.py --inkstitch /tmp/inkstitch \
  --nomes bordado/convidados.txt --fonte Montecarlo --iniciais \
  --altura 25 --largura 45 --veludo --saida bordado/saida-iniciais
```

Saída: `NNN-Nome.dst`, uma prévia `NNN-Nome.png` (em escala, com régua de
10 mm), `folha-de-provas.png` e `relatorio.txt` (medidas, pontos e cortes).
A origem de cada DST é o centro do desenho.

Outras fontes boas para casamento: `Chopin Script`, `MAM Script`,
`Magnolia KOR`, `Auberge Marif`, `Pacificlo tiny` (letras bem pequenas; exige
linha e agulha 60).

## Dicas para bordar em veludo

- **Topping hidrossolúvel** (tipo Solvy) por cima do veludo: sem ele o ponto
  afunda no pelo e as letras finas somem. Retire com água/pincel úmido depois.
- **Entretela** por baixo (tear-away ou cut-away leve) e bastidor sem marcar o
  pelo (prender a entretela no bastidor e o veludo por cima com spray/alfinete).
- `--veludo` liga underlay de contorno + centro em todas as colunas de satin.
- Linha 40 (rayon ou poliéster), agulha 75/11 ponta bola ou 70/10.
- **Borde um teste** antes de rodar a lista inteira.
