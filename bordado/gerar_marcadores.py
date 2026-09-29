#!/usr/bin/env python3
"""
gerar_marcadores.py — gera arquivos de bordado (.DST, formato Tajima, lido
pelas máquinas Barudan) para os marcadores de taça, um arquivo por convidado.

Usa as fontes já digitalizadas do Ink/Stitch (https://inkstitch.org), então os
pontos saem em "satin" de verdade (não é conversão automática de fonte TTF).

Uso:
    python3 bordado/gerar_marcadores.py --inkstitch /caminho/inkstitch \
        --nomes bordado/convidados.txt --fonte "Montecarlo" \
        --altura 12 --largura 55 --saida bordado/saida

    --nomes    arquivo texto, um nome por linha (linhas vazias e # são ignoradas).
               Use "|" para quebrar em duas linhas: "Ana|Beatriz".
    --altura   altura máxima do bordado em mm.
    --largura  largura máxima do bordado em mm.
    --iniciais borda só as iniciais ("Ana Beatriz" -> "AB").
    --veludo   reforça o enchimento (underlay de contorno + centro) em todas as
               colunas de satin, para os pontos não afundarem no pelo do veludo.

Saída (em --saida): NNN-Nome.dst + NNN-Nome.png (prévia) + folha-de-provas.png.
O ponto de partida (origem) de cada .DST é o centro do desenho.
"""
import argparse
import importlib.abc
import importlib.machinery
import json
import os
import re
import sys
import tempfile
import types
import unicodedata


# --- Ink/Stitch importa wxPython (interface gráfica) em todo lugar; aqui não
# precisamos de interface, então trocamos o módulo por um stub inofensivo.
class _Any:
    def __init__(self, *a, **k): pass
    def __call__(self, *a, **k): return _Any()
    def __getattr__(self, n): return _Any()
    def __or__(self, o): return self
    __ror__ = __or__
    def __int__(self): return 0
    def __iter__(self): return iter(())
    def __bool__(self): return False


class _WxModule(types.ModuleType):
    def __getattr__(self, n):
        if n.startswith('__'):
            raise AttributeError(n)
        if n[:1].isupper() and not n.isupper():
            cls = type(n, (_Any,), {})
            setattr(self, n, cls)
            return cls
        return _Any()


class _WxFinder(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def find_spec(self, name, path, target=None):
        if name == 'wx' or name.startswith('wx.'):
            return importlib.machinery.ModuleSpec(name, self, is_package=True)

    def create_module(self, spec):
        m = _WxModule(spec.name)
        m.__path__ = []
        return m

    def exec_module(self, m):
        pass


NS = '{http://inkstitch.org/namespace}'

SVG_VAZIO = ('<svg xmlns="http://www.w3.org/2000/svg" '
             'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
             'xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" '
             'width="200mm" height="200mm" viewBox="0 0 200 200">'
             '<sodipodi:namedview inkscape:document-units="mm"/></svg>')


def ler_nomes(caminho):
    nomes = []
    with open(caminho, encoding='utf-8') as f:
        for linha in f:
            linha = linha.strip()
            if linha and not linha.startswith('#'):
                nomes.append(linha)
    return nomes


def iniciais(nome):
    return ''.join(p[0].upper() for p in nome.replace('|', ' ').split() if p[0].isalpha())


def nome_arquivo(i, texto):
    base = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode()
    base = re.sub(r'[^A-Za-z0-9]+', '', base)[:8]  # DST: nomes curtos
    return f'{i:03d}-{base}' if base else f'{i:03d}'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--inkstitch', required=True, help='pasta do código-fonte do Ink/Stitch (com fonts/)')
    ap.add_argument('--nomes', required=True)
    ap.add_argument('--fonte', default='Montecarlo')
    ap.add_argument('--altura', type=float, default=12.0)
    ap.add_argument('--largura', type=float, default=55.0)
    ap.add_argument('--iniciais', action='store_true')
    ap.add_argument('--veludo', action='store_true')
    ap.add_argument('--espaco', type=float, default=0, help='espaço extra entre palavras (unidades da fonte)')
    ap.add_argument('--cor', default='#C9A45C', help='cor da linha na prévia')
    ap.add_argument('--fundo', default='#740C23', help='cor do veludo na prévia')
    ap.add_argument('--saida', default='saida')
    args = ap.parse_args()

    nomes = ler_nomes(args.nomes)
    saida = os.path.abspath(args.saida)
    os.makedirs(saida, exist_ok=True)

    sys.meta_path.insert(0, _WxFinder())
    ink = os.path.abspath(args.inkstitch)
    sys.path.insert(0, ink)
    os.chdir(ink)  # Ink/Stitch procura fonts/ relativo à própria pasta

    import pystitch
    from inkex import Group
    from lib.extensions.batch_lettering import BatchLettering
    from lib.lettering import get_font_by_name
    from lib.output import write_embroidery_file
    from lib.stitch_plan import stitch_groups_to_stitch_plan
    from lib.svg import get_correction_transform

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
    meta = ext.get_inkstitch_metadata()

    def plano(texto, escala):
        grupo = Group()
        grupo.set('inkstitch:lettering', json.dumps({'text': texto, 'scale': int(escala * 100)}))
        ext.svg.append(grupo)
        grupo.set('transform', get_correction_transform(grupo, child=True))
        destino = Group()
        grupo.append(destino)
        fonte.render_text(texto, destino, trim_option=2, text_align=1, word_spacing=args.espaco)
        destino.set('transform', f'scale({escala})')
        # Abaixo da escala mínima a compensação de puxada (em mm fixos) engorda
        # as letras: reduz na mesma proporção da escala.
        fator = min(1.0, escala / fonte.min_scale)
        for no in destino.iter():
            pc = no.get(NS + 'pull_compensation_mm')
            if pc and fator < 1:
                no.set(NS + 'pull_compensation_mm', f'{float(pc) * fator:.3f}')
            if args.veludo and no.get(NS + 'satin_column') == 'True':
                no.set(NS + 'contour_underlay', 'True')
                no.set(NS + 'center_walk_underlay', 'True')
        ext.get_elements()
        grupos = ext.elements_to_stitch_groups(ext.elements)
        sp = stitch_groups_to_stitch_plan(grupos, collapse_len=meta['collapse_len_mm'],
                                          min_stitch_len=meta['min_stitch_len_mm'])
        grupo.delete()
        return sp

    def medida_mm(sp):
        x0, y0, x1, y1 = sp.bounding_box
        px_mm = 96 / 25.4
        return (x1 - x0) / px_mm, (y1 - y0) / px_mm

    relatorio = []
    for i, nome in enumerate(nomes, 1):
        texto = iniciais(nome) if args.iniciais else nome
        texto = texto.replace('|', '\n')
        # duas passadas: a 2ª corrige o que não escala linearmente (compensação)
        escala = 1.0
        for _ in range(2):
            w1, h1 = medida_mm(plano(texto, escala))
            escala *= min(args.altura / h1, args.largura / w1)
        aviso = ''
        if escala < fonte.min_scale:
            aviso = f'  (!) abaixo da escala mínima da fonte ({fonte.min_scale:g}); letras podem ficar finas demais'
        sp = plano(texto, escala)
        w, h = medida_mm(sp)

        base = nome_arquivo(i, texto)
        ext.svg.set('sodipodi:docname', base + '.svg')  # vira o título no cabeçalho do DST
        dst = os.path.join(saida, base + '.dst')
        write_embroidery_file(dst, sp, ext.svg)

        pat = pystitch.read(dst)
        pontos = pat.count_stitches()
        cortes = pat.count_stitch_commands(pystitch.TRIM)
        relatorio.append((base, nome, w, h, pontos, cortes, aviso))
        print(f'{base}.dst  {w:5.1f} x {h:4.1f} mm  {pontos:5d} pontos  {cortes} cortes{aviso}')

    os.unlink(svg_tmp.name)
    gerar_previas(saida, relatorio, args.cor, args.fundo)

    with open(os.path.join(saida, 'relatorio.txt'), 'w', encoding='utf-8') as f:
        f.write(f'Fonte: {args.fonte} | limite {args.largura:g} x {args.altura:g} mm'
                f'{" | modo veludo" if args.veludo else ""}\n\n')
        for base, nome, w, h, pontos, cortes, aviso in relatorio:
            f.write(f'{base}.dst\t{nome}\t{w:.1f} x {h:.1f} mm\t{pontos} pontos\t{cortes} cortes{aviso}\n')


def gerar_previas(saida, relatorio, cor, fundo):
    """Desenha cada .DST ponto a ponto (linha = cor, fundo = veludo) em escala real."""
    import pystitch
    from PIL import Image, ImageDraw

    PX_MM = 12  # resolução da prévia
    MARGEM = 6  # mm
    previas = []
    for base, nome, w, h, *_ in relatorio:
        pat = pystitch.read(os.path.join(saida, base + '.dst'))
        x0, y0, x1, y1 = pat.bounds()
        W = int(((x1 - x0) / 10 + 2 * MARGEM) * PX_MM)
        H = int(((y1 - y0) / 10 + 2 * MARGEM) * PX_MM)
        img = Image.new('RGB', (W, H), fundo)
        d = ImageDraw.Draw(img)
        largura_linha = max(1, int(0.35 * PX_MM))
        ant = None
        for x, y, cmd in pat.stitches:
            p = ((x - x0) / 10 * PX_MM + MARGEM * PX_MM, (y - y0) / 10 * PX_MM + MARGEM * PX_MM)
            if cmd == pystitch.STITCH:
                if ant is not None:
                    d.line([ant, p], fill=cor, width=largura_linha)
                ant = p
            else:
                ant = None  # salto/corte: não desenha a linha solta
        # régua de 10 mm no canto
        d.line([(PX_MM * 2, H - PX_MM * 2), (PX_MM * 12, H - PX_MM * 2)], fill='white', width=2)
        d.text((PX_MM * 2, H - PX_MM * 2 - 14), '10 mm', fill='white')
        img.save(os.path.join(saida, base + '.png'))
        previas.append((base, nome, w, h, img))

    # folha de provas com todos os nomes
    if not previas:
        return
    col = 3
    cw = max(p[4].width for p in previas)
    ch = max(p[4].height for p in previas) + 30
    linhas = (len(previas) + col - 1) // col
    folha = Image.new('RGB', (cw * col, ch * linhas), 'white')
    d = ImageDraw.Draw(folha)
    try:
        from PIL import ImageFont
        letra = ImageFont.truetype('DejaVuSans.ttf', 16)
    except OSError:
        letra = None
    for k, (base, nome, w, h, img) in enumerate(previas):
        x, y = (k % col) * cw, (k // col) * ch
        folha.paste(img, (x + (cw - img.width) // 2, y))
        d.text((x + 8, y + ch - 24), f'{base}.dst  {nome.replace("|", " ")}  ({w:.0f} x {h:.0f} mm)', fill='black', font=letra)
    folha.save(os.path.join(saida, 'folha-de-provas.png'))


if __name__ == '__main__':
    main()
