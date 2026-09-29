#!/usr/bin/env python3
"""
marcador_taca.py — marcador de taça em veludo: disco de pétalas (Ø 70 mm) com
fenda até o furo central, CONTORNO BORDADO em satin e o nome do convidado
(sempre dois nomes: "Nome Sobrenome") seguindo a curva.

Tudo sai num único .DST por convidado (Tajima, lido pelas Barudan), numa cor só:
primeiro o nome, depois o contorno. O pano é cortado depois, rente por fora do
contorno bordado (a borda externa do satin fica exatamente na linha de corte).
O nome é reduzido automaticamente até ficar a pelo menos --margem mm da borda
interna do contorno, em qualquer ponto.

A ORIGEM do DST é o centro do disco (centro do furo).

Uso:
    python3 bordado/marcador_taca.py --inkstitch /tmp/inkstitch \
        --nomes bordado/convidados.txt --saida bordado/saida-taca

Geometria (mm, do molde): pontas das pétalas a 35 mm do centro (Ø 70), vales a
32 mm (Ø 64), 10 pétalas, furo Ø 13, fenda de 2 mm no topo.

--angulo  onde fica o MEIO do nome, em graus: 0 = lado direito (3 h),
          -90 = embaixo (6 h), -15 = como no molde (lado direito, um pouco abaixo).
--raio    raio onde fica a parte de baixo do nome (pé das letras/descendentes,
          virada para a borda; o topo das letras fica virado para o centro).
--altura  altura máxima do nome (mm).
--arco    comprimento máximo do nome, em graus de arco.
--borda   largura do satin do contorno (mm).
"""
import argparse
import json
import math
import os
import sys
import tempfile

from gerar_marcadores import NS, SVG_VAZIO, _WxFinder, ler_nomes, nome_arquivo

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


def recorte(passo_graus=1):
    """Linha de corte: pétalas abertas na fenda + furo, como polígono único."""
    import shapely.geometry as g
    disco = g.Polygon(contorno_disco(passo_graus))
    furo = g.Point(0, 0).buffer(R_FURO, 128)
    fenda = g.box(-FENDA / 2, 0, FENDA / 2, R_PONTA + 1)
    return disco.difference(furo.union(fenda))


def anel_comecando_no_topo(anel):
    """Reordena o anel para começar no ponto mais perto do topo da fenda (lado direito)."""
    import shapely.geometry as g
    pts = list(anel.coords)[:-1]
    alvo = (FENDA / 2, R_PONTA)
    k = min(range(len(pts)), key=lambda i: math.dist(pts[i], alvo))
    pts = pts[k:] + pts[:k]
    return g.LinearRing(pts)


def pontos_contorno(corte, largura, densidade=0.35, passo_base=2.0):
    """
    Pontos (mm, y para cima) do contorno em satin: base (ponto corrido no centro
    da faixa + ponto corrido perto da borda interna) e depois o zigue-zague
    entre a linha de corte e a borda interna. Começa e termina com arremate.
    """
    import shapely.geometry as g

    def ring(offset):
        forma = corte.buffer(-offset, join_style=1, quad_segs=32) if offset else corte
        return anel_comecando_no_topo(forma.exterior)

    externo = ring(0.05)       # um fio para dentro da linha de corte
    interno = ring(largura)
    centro = ring(largura / 2)
    base_int = ring(largura - 0.35)

    def corrido(anel, passo):
        n = max(3, round(anel.length / passo))
        return [anel.interpolate(anel.length * i / n).coords[0] for i in range(n + 1)]

    pts = []
    # arremate inicial
    p0 = centro.coords[0]
    p1 = centro.interpolate(0.6).coords[0]
    pts += [p0, p1, p0, p1, p0]
    # underlay: centro + borda interna (segura o pelo do veludo)
    pts += corrido(centro, passo_base)
    pts += corrido(base_int, passo_base)
    # satin: zigue-zague externo/interno ao longo do centro
    # nos cantos o ponto de um dos lados fica parado e o outro gira (leque)
    n = round(centro.length / (densidade / 2))
    for i in range(n + 1):
        c = g.Point(centro.interpolate(centro.length * i / n))
        lado = externo if i % 2 == 0 else interno
        p = lado.interpolate(lado.project(c)).coords[0]
        if not pts or p != pts[-1]:
            pts.append(p)
    # arremate final (em cima do satin, no centro da faixa)
    q0 = centro.coords[0]
    q1 = centro.interpolate(centro.length - 0.6).coords[0]
    pts += [q0, q1, q0, q1, q0]
    return pts


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--inkstitch', required=True, help='pasta do código-fonte do Ink/Stitch (com fonts/)')
    ap.add_argument('--nomes', required=True, help='um convidado por linha: "Nome Sobrenome"')
    ap.add_argument('--fonte', default='Magnolia KOR')
    ap.add_argument('--angulo', type=float, default=-15.0)
    ap.add_argument('--raio', type=float, default=28.0)
    ap.add_argument('--altura', type=float, default=9.0)
    ap.add_argument('--arco', type=float, default=140.0)
    ap.add_argument('--borda', type=float, default=1.6, help='largura do satin do contorno (mm)')
    ap.add_argument('--margem', type=float, default=2.0, help='folga mínima entre o nome e o contorno (mm)')
    ap.add_argument('--espaco', type=float, default=0, help='espaço extra entre palavras (unidades da fonte)')
    ap.add_argument('--engrossar', type=float, default=0.12,
                    help='mm mínimos somados a cada lado das colunas de satin das letras (veludo)')
    ap.add_argument('--sem-veludo', action='store_true', help='não reforçar o underlay das letras')
    ap.add_argument('--cor', default='#C9A45C', help='cor da linha na prévia')
    ap.add_argument('--fundo', default='#740C23', help='cor do veludo na prévia')
    ap.add_argument('--saida', default='saida-taca')
    args = ap.parse_args()

    nomes = ler_nomes(args.nomes)
    errados = [n for n in nomes if len(n.split()) != 2]
    if errados:
        sys.exit('Cada convidado precisa ter exatamente dois nomes. Corrija:\n  ' + '\n  '.join(errados))
    saida = os.path.abspath(args.saida)
    os.makedirs(saida, exist_ok=True)

    sys.meta_path.insert(0, _WxFinder())
    ink = os.path.abspath(args.inkstitch)
    sys.path.insert(0, ink)
    os.chdir(ink)  # Ink/Stitch procura fonts/ relativo à própria pasta

    import pystitch
    import shapely.geometry as g
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

    corte = recorte()
    livre = corte.buffer(-(args.borda + args.margem))  # onde o nome pode ficar
    contorno = pontos_contorno(corte, args.borda)

    def ajustes(grupo, escala):
        # Abaixo da escala mínima, a compensação de puxada (mm fixos) engorda as
        # letras: reduz na proporção da escala. Mas no veludo os traços finos
        # somem no pelo, então garante um mínimo por lado.
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

    def nome_no_arco(texto, escala, destino):
        """Borda o nome no arco, grava num DST temporário e devolve o padrão lido."""
        sp = plano(texto, escala, True)
        lib.output.write_embroidery_file(destino, sp, ext.svg)
        return pystitch.read(destino)

    def folga(pat):
        """Menor distância entre a linha do nome e a borda interna do contorno."""
        segs, ant = [], None
        for x, y, c in pat.stitches:
            p = (x / 10, -y / 10)
            if c == pystitch.STITCH:
                if ant is not None and ant != p:
                    segs.append((ant, p))
                ant = p
            else:
                ant = None
        linhas = g.MultiLineString(segs)
        interno = corte.buffer(-args.borda)
        if not interno.contains(linhas):
            return -1.0
        return interno.exterior.distance(linhas)

    limite_arco = args.raio * math.radians(args.arco)
    relatorio = []
    tmp = tempfile.NamedTemporaryFile(suffix='.dst', delete=False).name
    for i, nome in enumerate(nomes, 1):
        texto = nome
        escala = 1.0
        for _ in range(2):  # 2ª passada corrige o que não escala linearmente
            w, h = medida_mm(plano(texto, escala, False))
            escala *= min(args.altura / h, limite_arco / w)
        # garante a folga: diminui o nome até caber
        while True:
            pat = nome_no_arco(texto, escala, tmp)
            f = folga(pat)
            if f >= args.margem:
                break
            escala *= 0.97
        w, h = medida_mm(plano(texto, escala, False))

        # junta: nome -> corte de linha -> contorno, tudo na mesma cor
        final = pystitch.EmbPattern()
        base = nome_arquivo(i, texto)
        final.extras['name'] = base[:8]
        final.add_thread(pystitch.EmbThread('#C9A45C'))
        for x, y, c in pat.stitches:
            if c == pystitch.END:
                break
            final.add_stitch_absolute(c, x, y)
        final.add_stitch_absolute(pystitch.TRIM, *final.stitches[-1][:2])
        x0, y0 = contorno[0]
        final.add_stitch_absolute(pystitch.JUMP, x0 * 10, -y0 * 10)
        for x, y in contorno:
            final.add_stitch_absolute(pystitch.STITCH, x * 10, -y * 10)
        final.add_stitch_absolute(pystitch.TRIM, *final.stitches[-1][:2])
        final.add_command(pystitch.END)
        dst = os.path.join(saida, base + '.dst')
        pystitch.write(final, dst)

        conf = pystitch.read(dst)
        pontos = conf.count_stitches()
        linha = (f'{base}.dst  {nome}  altura {h:.1f} mm, arco {math.degrees(w / args.raio):.0f}°, '
                 f'{pontos} pontos, {conf.count_stitch_commands(pystitch.TRIM)} cortes, '
                 f'{f:.1f} mm entre o nome e o contorno')
        print(linha)
        relatorio.append((base, nome, linha))
    os.unlink(tmp)

    gerar_previas(saida, relatorio, corte, args.cor, args.fundo)
    with open(os.path.join(saida, 'relatorio.txt'), 'w', encoding='utf-8') as fp:
        fp.write(f'Fonte: {args.fonte} | ângulo {args.angulo:g}° | altura máx {args.altura:g} mm | '
                 f'contorno satin {args.borda:g} mm | folga mínima {args.margem:g} mm\n'
                 f'Origem de todos os DST = centro do disco (centro do furo).\n'
                 f'Ordem: nome, corte de linha, contorno. Uma cor só.\n\n')
        for *_, linha in relatorio:
            fp.write(linha + '\n')


def gerar_previas(saida, relatorio, corte, cor, fundo):
    """Desenha o disco de veludo (cortado 0,5 mm por fora do contorno) com o bordado."""
    import pystitch
    from PIL import Image, ImageDraw, ImageFont

    PX = 12
    LADO = int(78 * PX)
    meio = LADO / 2
    pano = corte.buffer(0.5)

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
        d.polygon([xy(*p) for p in pano.exterior.coords], fill=fundo)
        pat = pystitch.read(os.path.join(saida, base + '.dst'))
        ant = None
        for x, y, cmd in pat.stitches:
            p = xy(x / 10, -y / 10)
            if cmd == pystitch.STITCH:
                if ant is not None:
                    d.line([ant, p], fill=cor, width=max(1, int(0.3 * PX)))
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
