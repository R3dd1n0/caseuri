#!/usr/bin/env python3
"""
marcador_taca.py — marcador de taça em veludo (disco recortado de 70 mm com
fenda até o furo central) com o nome do convidado bordado seguindo a curva.

Gera, para cada convidado, um .DST (Tajima, lido pelas Barudan) com a ORIGEM
NO CENTRO DO DISCO (centro do furo). Gera também `gabarito-recorte.dst`, só com
o contorno do disco + furo + fenda em ponto corrido, na mesma origem: borde o
gabarito primeiro (como linha de corte/posicionamento) e o nome em seguida,
sem tirar o bastidor.

Uso:
    python3 bordado/marcador_taca.py --inkstitch /tmp/inkstitch \
        --nomes bordado/convidados.txt --saida bordado/saida-taca

Geometria (mm, ver medidas do molde): pontas das "pétalas" a 35 mm do centro
(Ø 70), vales a 32 mm (Ø 64), 10 pétalas, furo Ø 13, fenda de 2 mm no topo.

--angulo  onde fica o MEIO do nome, em graus: 0 = lado direito (3 h),
          -90 = embaixo (6 h), -15 = como no molde (lado direito, um pouco abaixo).
--raio    raio onde fica a parte de baixo do nome (pé das letras e descendentes,
          virada para a borda; o topo das letras fica virado para o centro).
          Os vales das pétalas ficam a 32 mm, então 30 = 2 mm de folga.
--altura  altura máxima do nome (mm, maiúsculas + descendentes).
--arco    comprimento máximo do nome, em graus de arco.
"""
import argparse
import json
import math
import os
import sys
import tempfile

from gerar_marcadores import NS, SVG_VAZIO, _WxFinder, iniciais, ler_nomes, nome_arquivo

# --- geometria do disco (mm, eixo y para cima, centro = 0,0)
R_PONTA, R_VALE, PETALAS = 35.0, 32.0, 10
R_FURO, FENDA = 6.5, 2.0


def contorno_disco(passo_graus=3):
    """Pontos do contorno de pétalas (fechado). Vales em 90° (fenda) e a cada 36°."""
    meio = math.pi / PETALAS  # meio ângulo de pétala (18°)
    vx, vy = R_VALE * math.cos(meio), R_VALE * math.sin(meio)
    # círculo da pétala: centro a d do centro do disco, raio r, passa pelos vales e pela ponta
    d = (R_PONTA ** 2 - vx ** 2 - vy ** 2) / (2 * (R_PONTA - vx))
    r = R_PONTA - d
    pts = []
    for k in range(PETALAS):
        a = k * 2 * meio  # eixo da pétala
        cx, cy = d * math.cos(a), d * math.sin(a)
        v1 = (R_VALE * math.cos(a - meio), R_VALE * math.sin(a - meio))
        v2 = (R_VALE * math.cos(a + meio), R_VALE * math.sin(a + meio))
        b1 = math.atan2(v1[1] - cy, v1[0] - cx)
        b2 = math.atan2(v2[1] - cy, v2[0] - cx)
        if b2 < b1:
            b2 += 2 * math.pi
        n = max(2, int(math.degrees(b2 - b1) / passo_graus))
        for i in range(n):
            b = b1 + (b2 - b1) * i / n
            pts.append((cx + r * math.cos(b), cy + r * math.sin(b)))
    return pts


def recorte(passo_graus=3):
    """Contorno de corte completo: pétalas abertas na fenda + furo, como polígono único."""
    import shapely.geometry as g
    disco = g.Polygon(contorno_disco(passo_graus))
    furo = g.Point(0, 0).buffer(R_FURO, 64)
    fenda = g.box(-FENDA / 2, 0, FENDA / 2, R_PONTA + 1)
    return disco.difference(furo.union(fenda))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--inkstitch', required=True, help='pasta do código-fonte do Ink/Stitch (com fonts/)')
    ap.add_argument('--nomes', required=True)
    ap.add_argument('--fonte', default='Chopin Script')
    ap.add_argument('--angulo', type=float, default=-15.0)
    ap.add_argument('--raio', type=float, default=30.0)
    ap.add_argument('--altura', type=float, default=9.0)
    ap.add_argument('--arco', type=float, default=140.0)
    ap.add_argument('--espaco', type=float, default=0, help='espaço extra entre palavras (unidades da fonte)')
    ap.add_argument('--margem', type=float, default=2.0, help='distância mínima do bordado até o corte (mm)')
    ap.add_argument('--iniciais', action='store_true')
    ap.add_argument('--engrossar', type=float, default=0.15,
                    help='mm mínimos somados a cada lado das colunas de satin (veludo)')
    ap.add_argument('--sem-veludo', action='store_true', help='não reforçar o underlay')
    ap.add_argument('--cor', default='#C9A45C', help='cor da linha na prévia')
    ap.add_argument('--fundo', default='#740C23', help='cor do veludo na prévia')
    ap.add_argument('--saida', default='saida-taca')
    args = ap.parse_args()

    nomes = ler_nomes(args.nomes)
    saida = os.path.abspath(args.saida)
    os.makedirs(saida, exist_ok=True)

    sys.meta_path.insert(0, _WxFinder())
    ink = os.path.abspath(args.inkstitch)
    sys.path.insert(0, ink)
    os.chdir(ink)  # Ink/Stitch procura fonts/ relativo à própria pasta

    import pystitch
    from inkex import Group, PathElement
    import lib.output
    from lib.extensions.batch_lettering import BatchLettering
    from lib.extensions.lettering_along_path import TextAlongPath
    from lib.lettering import get_font_by_name
    from lib.stitch_plan import stitch_groups_to_stitch_plan
    from lib.svg import PIXELS_PER_MM, get_correction_transform
    from lib.utils import Point

    fonte = get_font_by_name(args.fonte, False)
    if fonte is None:
        sys.exit(f'Fonte não encontrada: {args.fonte}')

    svg_tmp = tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False)
    svg_tmp.write(SVG_VAZIO)
    svg_tmp.close()
    ext = BatchLettering()
    ext.parse_arguments([svg_tmp.name])
    with open(svg_tmp.name, 'rb') as f:
        ext.document = ext.load(f)
    ext.svg = ext.document.getroot()
    os.unlink(svg_tmp.name)
    meta = ext.get_inkstitch_metadata()

    # centro do disco no documento (mm) = meio da página de 200 mm
    CX = CY = 100.0
    # origem do DST = centro do disco (e não o centro do desenho)
    lib.output.get_origin = lambda svg, bbox: Point(CX * PIXELS_PER_MM, CY * PIXELS_PER_MM)

    def ajustes(grupo, escala):
        # Abaixo da escala mínima, a compensação de puxada (mm fixos) engorda as
        # letras: reduz na proporção da escala. Mas no veludo os traços finos
        # (floreios) somem no pelo, então garante um mínimo por lado, o que dá
        # aos traços finos ~0,3 mm a mais de largura.
        fator = min(1.0, escala / fonte.min_scale)
        minimo = 0.0 if args.sem_veludo else args.engrossar
        for no in grupo.iter():
            if no.get(NS + 'satin_column') != 'True':
                continue
            pc = float(no.get(NS + 'pull_compensation_mm') or 0)
            no.set(NS + 'pull_compensation_mm', f'{max(pc * fator, minimo):.3f}')
            if not args.sem_veludo:
                no.set(NS + 'contour_underlay', 'True')
                no.set(NS + 'center_walk_underlay', 'True')

    def plano(texto, escala, em_arco):
        grupo = Group()
        grupo.set('inkstitch:lettering', json.dumps({
            'text': texto, 'font': fonte.marked_custom_font_id, 'scale': round(escala * 100, 3),
            'back_and_forth': False, 'trim_option': 2, 'use_trim_symbols': False, 'color_sort': 0,
            'text_align': 0, 'letter_spacing': 0, 'word_spacing': args.espaco, 'line_height': 0}))
        ext.svg.append(grupo)
        grupo.set('transform', get_correction_transform(grupo, child=True))
        destino = Group()
        grupo.append(destino)
        fonte.render_text(texto, destino, trim_option=2, word_spacing=args.espaco)
        destino.set('transform', f'scale({escala})')
        if em_arco:
            # arco no sentido anti-horário: o "em cima" das letras fica para o centro
            a0 = math.radians(args.angulo - 150)
            pts = [(CX + args.raio * math.cos(a0 + math.radians(i)),
                    CY - args.raio * math.sin(a0 + math.radians(i))) for i in range(0, 301)]
            caminho = PathElement()
            caminho.set('d', 'M ' + ' L '.join(f'{x:.4f},{y:.4f}' for x, y in pts))
            caminho.set('style', 'fill:none;stroke:#000000;stroke-width:0.1')
            ext.svg.append(caminho)
            TextAlongPath(ext.svg, grupo, caminho, 'center', 'top')
            caminho.delete()
        ajustes(grupo, escala)
        ext.get_elements()
        grupos = ext.elements_to_stitch_groups(ext.elements)
        sp = stitch_groups_to_stitch_plan(grupos, collapse_len=meta['collapse_len_mm'],
                                          min_stitch_len=meta['min_stitch_len_mm'])
        grupo.delete()
        return sp

    def medida_mm(sp):
        x0, y0, x1, y1 = sp.bounding_box
        return (x1 - x0) / PIXELS_PER_MM, (y1 - y0) / PIXELS_PER_MM

    limite_arco = args.raio * math.radians(args.arco)
    area = recorte()
    import shapely.geometry as g
    relatorio = []
    for i, nome in enumerate(nomes, 1):
        texto = (iniciais(nome) if args.iniciais else nome).replace('|', ' ')
        escala = 1.0
        for _ in range(2):  # 2ª passada corrige o que não escala linearmente
            w, h = medida_mm(plano(texto, escala, False))
            escala *= min(args.altura / h, limite_arco / w)
        w, h = medida_mm(plano(texto, escala, False))
        sp = plano(texto, escala, True)

        base = nome_arquivo(i, texto)
        ext.svg.set('sodipodi:docname', base + '.svg')  # título no cabeçalho do DST
        dst = os.path.join(saida, base + '.dst')
        lib.output.write_embroidery_file(dst, sp, ext.svg)

        pat = pystitch.read(dst)
        pts = [(x / 10, -y / 10) for x, y, c in pat.stitches if c == pystitch.STITCH]
        folga = min(area.exterior.distance(g.Point(p)) if area.contains(g.Point(p)) else -1 for p in pts)
        for anel in area.interiors:
            folga = min(folga, min(anel.distance(g.Point(p)) for p in pts))
        # (a escala fica bem abaixo da mínima que a fonte sugere; por isso o
        # --engrossar garante espessura mínima nos traços finos)
        avisos = []
        if folga < args.margem:
            avisos.append(f'só {folga:.1f} mm até o corte' if folga >= 0 else 'SAI DO DISCO')
        pontos = pat.count_stitches()
        cortes = pat.count_stitch_commands(pystitch.TRIM)
        linha = (f'{base}.dst  {nome.replace("|", " ")}  arco {w:.0f} mm ({math.degrees(w / args.raio):.0f}°), '
                 f'altura {h:.1f} mm, {pontos} pontos, {cortes} cortes, {folga:.1f} mm até o corte')
        if avisos:
            linha += '  (!) ' + '; '.join(avisos)
        print(linha)
        relatorio.append((base, nome.replace('|', ' '), linha))

    escrever_gabarito(os.path.join(saida, 'gabarito-recorte.dst'))
    gerar_previas(saida, relatorio, args.cor, args.fundo)
    with open(os.path.join(saida, 'relatorio.txt'), 'w', encoding='utf-8') as f:
        f.write(f'Fonte: {args.fonte} | raio {args.raio:g} mm | ângulo {args.angulo:g}° | '
                f'altura máx {args.altura:g} mm | arco máx {args.arco:g}°\n'
                f'Origem de todos os DST = centro do disco (centro do furo).\n\n')
        for *_, linha in relatorio:
            f.write(linha + '\n')


def escrever_gabarito(caminho, passo=2.5):
    """Contorno de corte (pétalas + fenda + furo) em ponto corrido, origem no centro."""
    import pystitch
    pat = pystitch.EmbPattern()
    pat.extras['name'] = 'GABARITO'

    def corrido(anel, pular_para=True):
        coords = list(anel.coords)
        x, y = coords[0]
        pat.add_stitch_absolute(pystitch.JUMP if pular_para else pystitch.STITCH, x * 10, -y * 10)
        for (x0, y0), (x1, y1) in zip(coords, coords[1:]):
            n = max(1, round(math.hypot(x1 - x0, y1 - y0) / passo))
            for k in range(1, n + 1):
                t = k / n
                pat.add_stitch_absolute(pystitch.STITCH, (x0 + (x1 - x0) * t) * 10, -(y0 + (y1 - y0) * t) * 10)

    forma = recorte(passo_graus=2)
    corrido(forma.exterior)
    pat.add_command(pystitch.END)
    pystitch.write(pat, caminho)


def gerar_previas(saida, relatorio, cor, fundo):
    """Desenha o disco de veludo com o bordado por cima, em escala (12 px/mm)."""
    import pystitch
    from PIL import Image, ImageDraw, ImageFont

    PX = 12
    LADO = int(78 * PX)
    meio = LADO / 2
    forma = recorte(passo_graus=1)

    def xy(x, y):  # mm (y para cima) -> pixel
        return (meio + x * PX, meio - y * PX)

    try:
        letra = ImageFont.truetype('DejaVuSans.ttf', 18)
    except OSError:
        letra = None
    previas = []
    for base, nome, _ in relatorio:
        img = Image.new('RGB', (LADO, LADO), 'white')
        d = ImageDraw.Draw(img)
        d.polygon([xy(*p) for p in forma.exterior.coords], fill=fundo, outline='#333333')
        pat = pystitch.read(os.path.join(saida, base + '.dst'))
        ant = None
        for x, y, cmd in pat.stitches:
            p = xy(x / 10, -y / 10)
            if cmd == pystitch.STITCH:
                if ant is not None:
                    d.line([ant, p], fill=cor, width=max(1, int(0.35 * PX)))
                ant = p
            else:
                ant = None
        d.line([(20, LADO - 20), (20 + 10 * PX, LADO - 20)], fill='black', width=2)
        d.text((20, LADO - 44), '10 mm', fill='black', font=letra)
        img.save(os.path.join(saida, base + '.png'))
        previas.append((base, nome, img))

    col = min(3, len(previas))
    ch = LADO + 34
    linhas = (len(previas) + col - 1) // col
    folha = Image.new('RGB', (LADO * col, ch * linhas), 'white')
    d = ImageDraw.Draw(folha)
    for k, (base, nome, img) in enumerate(previas):
        x, y = (k % col) * LADO, (k // col) * ch
        folha.paste(img, (x, y))
        d.text((x + 20, y + LADO + 4), f'{base}.dst — {nome}', fill='black', font=letra)
    folha.save(os.path.join(saida, 'folha-de-provas.png'))


if __name__ == '__main__':
    main()
