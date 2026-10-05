# Marcadores de taça — bordado (Barudan)

## Marcador em disco (modelo escolhido)

`marcador_taca.py` — disco de veludo com pétalas (Ø 70 mm, vales Ø 64 mm,
furo Ø 13 mm, fenda de 2 mm no topo), **contorno bordado em satin** e o nome
(**sempre dois nomes**, "Nome Sobrenome") seguindo a curva. Fonte definitiva:
**Magnolia KOR** (mesmo desenho da Magnolia tamed, mas numa camada só); linha **verde-oliva** (`--cor`).

```sh
python3 bordado/marcador_taca.py --inkstitch /tmp/inkstitch \
  --nomes bordado/convidados.txt --saida bordado/saida-taca
```

- **Formato**: `.dst` (Tajima) — testado e lido pela Barudan. (EMB é o arquivo
  de trabalho fechado do Wilcom e não dá para gerar; U01 foi dispensado.)
- **Um único arquivo por convidado, uma cor só**: primeiro o nome, corte de
  linha, depois o contorno (satin de 1,6 mm com base de ponto corrido).
- A borda externa do satin fica **exatamente na linha de corte**: depois de
  bordar, corte o veludo rente por fora do contorno (e o furo/fenda por dentro).
- **Mesmo tamanho de letra em todos os bordados**: a escala é única para a lista
  inteira — a maior em que TODOS os nomes cabem (maiúscula "M" de até 7 mm,
  `--altura`). O relatório diz qual nome limitou e a escala usada; para outro
  lote sair igual, repita com `--escala <valor>`. Por isso, gere o casal junto
  com a lista final.
- Todo nome fica a pelo menos 2 mm (`--margem`) da borda interna do contorno —
  o script confere cada ponto da linha.
- **Origem no centro do disco** (centro do furo). Desenho: 69,8 × 67,8 mm.
- Linha com mais ou menos de dois nomes é recusada.
- Acentos: a Magnolia (de origem francesa) não tem á í ó ú ã õ Á Í Ó Ú Ã Õ.
  `acentos.py` monta essas letras numa cópia da fonte ("Magnolia tamed PT"):
  agudo copiado do "é", til desenhado em ponto corrido triplo. Confira a
  prévia de nomes com maiúscula acentuada.
- Fontes bicolores (ex.: Magnolia tamed) saem numa linha só: as trocas de cor
  viram cortes de linha. Mas cada traço delas é feito de duas metades, cada uma
  com sua base — no 1º teste real (30/09) a letra saiu cheia demais. Por isso a
  fonte padrão passou a ser a Magnolia KOR (uma camada, ~60% menos pontos).
- Letras SEM reforço de veludo por padrão (o 1º teste encheu demais as letras).
  Para tecido com pelo: `--veludo` (base extra) e/ou `--engrossar 0.1`.
- Legibilidade (após o 2º teste, 05/10): maiúscula de **9 mm** (`--altura`),
  letras bem separadas (`--letras 6`, compensa o aperto do topo das letras na
  curva) e palavras também (`--espaco 25`, senão o espaço some na curva), nome
  ocupando até 280° de curva (`--arco`) com o meio em `--angulo -65`.
- Nitidez só pelo arquivo (teste 4, A x B): `--densidade 0.5` (satin mais
  aberto que o 0,40 da fonte), `--base centro` (sem zigue-zague por baixo, que
  estufa letra pequena) e `--puxada 0.6` (traço um pouco mais fino).
  `--linhas 2` (nome e sobrenome em duas curvas) existe, mas a letra sai MENOR
  por causa do furo.
- `--fonte "Allegria 55"`, `--angulo -15`
  (padrão, como no molde) ou `-90` (nome embaixo), `--altura 7` (mm, maiúscula),
  `--borda 1.6` (mm), `--margem 2` (mm).

## Nome reto (primeira versão)


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
