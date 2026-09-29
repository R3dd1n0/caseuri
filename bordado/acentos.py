"""
acentos.py — completa fontes do Ink/Stitch com os acentos do português que
faltam (ex.: Magnolia, de origem francesa, não tem á í ó ú ã õ Á Í Ó Ú Ã Õ Ç).

Monta cada letra que falta a partir de letras que existem:
  agudo       base + acento copiado de é/É (tirando o "e" dele)
  cedilha     C + cedilha copiada de ç
  circunflexo base + acento copiado de ê/Ê
  til         base + til desenhado em ponto corrido triplo, do tamanho do
              circunflexo (a fonte não tem nenhum til para copiar)
  í           i sem o pingo + agudo

A fonte completada é gravada como cópia (nome + " PT") dentro de fonts/ do
Ink/Stitch; a original fica intocada.
"""
import copy
import json
import os
import shutil

from lxml import etree

SVG = '{http://www.w3.org/2000/svg}'
LABEL = '{http://www.inkscape.org/namespaces/inkscape}label'
INK = '{http://inkstitch.org/namespace}'

# alvo: (base, doador, base do doador, tipo)
RECEITAS = {
    'á': ('a', 'é', 'e', 'marca'), 'í': ('ı', 'é', 'e', 'marca'),
    'ó': ('o', 'é', 'e', 'marca'), 'ú': ('u', 'é', 'e', 'marca'),
    'â': ('a', 'ê', 'e', 'marca'), 'ê': ('e', 'ê', 'e', 'marca'), 'ô': ('o', 'ê', 'e', 'marca'),
    'ã': ('a', 'ê', 'e', 'til'), 'õ': ('o', 'ê', 'e', 'til'),
    'à': ('a', 'è', 'e', 'marca'), 'ç': ('c', 'ç', 'c', 'marca'), 'ü': ('u', 'ë', 'e', 'marca'),
    'Á': ('A', 'É', 'E', 'marca'), 'Í': ('I', 'É', 'E', 'marca'),
    'Ó': ('O', 'É', 'E', 'marca'), 'Ú': ('U', 'É', 'E', 'marca'),
    'Â': ('A', 'Ê', 'E', 'marca'), 'Ê': ('E', 'Ê', 'E', 'marca'), 'Ô': ('O', 'Ê', 'E', 'marca'),
    'Ã': ('A', 'Ê', 'E', 'til'), 'Õ': ('O', 'Ê', 'E', 'til'),
    'À': ('A', 'È', 'E', 'marca'), 'Ç': ('C', 'ç', 'c', 'marca'),
}


def caracteres_faltando(fonte, texto):
    """Letras do texto que a fonte não tem (ignora espaço)."""
    fonte._load_variants()
    variante = fonte.get_variant(fonte.default_variant)
    return sorted({c for c in texto if c != ' ' and not variante.glyphs_start_with(c)})


def completar_fonte(fonte, faltando):
    """Cria (ou reaproveita) a cópia da fonte com as letras que faltam. Devolve o nome novo
    e as letras que não deu para montar."""
    import inkex

    origem = fonte.path
    destino = origem.rstrip('/') + '_pt'
    if os.path.exists(destino):
        shutil.rmtree(destino)
    shutil.copytree(origem, destino)

    svgs = [os.path.join(r, f) for r, _, fs in os.walk(destino) for f in fs if f.endswith('.svg')]
    impossiveis = set()
    with open(os.path.join(destino, 'font.json'), encoding='utf-8') as f:
        info = json.load(f)
    avancos = info.setdefault('horiz_adv_x', {})
    for caminho in svgs:
        doc = inkex.load_svg(caminho)
        raiz = doc.getroot()
        camadas = {g.get(LABEL)[len('GlyphLayer-'):]: g for g in raiz.iter(SVG + 'g')
                   if (g.get(LABEL) or '').startswith('GlyphLayer-')}

        def folhas(camada):
            return [el for el in camada.iter() if isinstance(el, inkex.PathElement)]

        def caixa(els):
            bb = None
            for el in els:
                b = el.bounding_box(el.getparent().composed_transform())
                bb = b if bb is None else bb + b
            return bb

        def marcas(doador, base_doador):
            """Traços do doador que ficam acima ou abaixo do corpo da base (o acento)."""
            corpo = caixa(folhas(camadas[base_doador]))
            sel = []
            for el in folhas(camadas[doador]):
                b = el.bounding_box(el.getparent().composed_transform())
                if b.bottom <= corpo.top + 0.5 or b.top >= corpo.bottom - 0.5:
                    sel.append(el)
            return sel, corpo

        n = 0
        for alvo in faltando:
            if alvo in camadas:
                continue
            receita = RECEITAS.get(alvo)
            if not receita:
                impossiveis.add(alvo)
                continue
            base, doador, base_doador, tipo = receita
            sem_pingo = base == 'ı'
            if sem_pingo:
                base = 'i'
            if base not in camadas or doador not in camadas or base_doador not in camadas:
                impossiveis.add(alvo)
                continue

            nova = copy.deepcopy(camadas[base])
            nova.set(LABEL, 'GlyphLayer-' + alvo)
            n += 1
            for el in nova.iter():
                if el.get('id'):
                    el.set('id', f"{el.get('id')}_pt{n}")
            caixa_base = caixa(folhas(nova))
            if sem_pingo:
                # tira o pingo do i: traços que ficam acima do corpo do "u"
                topo_x = caixa(folhas(camadas['u'])).top if 'u' in camadas else caixa_base.center.y
                for el in folhas(nova):
                    if el.bounding_box(el.getparent().composed_transform()).bottom <= topo_x + 0.5:
                        el.getparent().remove(el)
                caixa_base = caixa(folhas(nova))

            marca, corpo_doador = marcas(doador, base_doador)
            if not marca:
                impossiveis.add(alvo)
                continue
            caixa_marca = caixa(marca)
            dx = caixa_base.center.x - caixa_marca.center.x
            # altura: o acento fica onde já estava no doador (é/É/ê/Ê/ç), que tem
            # a mesma altura de minúscula/maiúscula da base. Horizontal: centro do
            # corpo da base, ignorando floreios à esquerda das maiúsculas.
            dy = 0.0
            miolo = [el for el in folhas(nova)
                     if el.bounding_box(el.getparent().composed_transform()).width < caixa_base.width * 0.9]
            if alvo.isupper() and miolo:
                caixa_centro = caixa(miolo)
                dx = (caixa_centro.center.x + caixa_base.center.x) / 2 - caixa_marca.center.x
            grupo = etree.SubElement(nova, SVG + 'g', {'id': f'marca_pt{n}',
                                                     'transform': f'translate({dx:.3f},{dy:.3f})'})
            if tipo == 'marca':
                for el in marca:
                    c = copy.deepcopy(el)
                    c.transform = el.getparent().composed_transform() @ c.transform
                    c.set('id', f"{el.get('id')}_m{n}")
                    grupo.append(c)
            else:
                # til: onda em ponto corrido triplo na caixa do circunflexo
                x0, x1 = caixa_marca.left, caixa_marca.right
                altura = caixa_marca.bottom - caixa_marca.top
                ym = caixa_marca.bottom - altura * 0.35
                a = altura * 0.22
                w = x1 - x0
                d = (f'M {x0:.2f},{ym + a:.2f} C {x0 + w * 0.25:.2f},{ym - a * 2.2:.2f} '
                     f'{x0 + w * 0.45:.2f},{ym - a * 0.6:.2f} {x0 + w * 0.5:.2f},{ym:.2f} '
                     f'C {x0 + w * 0.55:.2f},{ym + a * 0.6:.2f} {x0 + w * 0.75:.2f},{ym + a * 2.2:.2f} '
                     f'{x1:.2f},{ym - a:.2f}')
                etree.SubElement(grupo, SVG + 'path', {
                    'id': f'til_pt{n}', 'd': d,
                    'style': 'fill:none;stroke:#000000;stroke-width:0.26',
                    INK + 'running_stitch_length_mm': '0.8',
                    INK + 'bean_stitch_repeats': '2',
                })
            camadas[alvo] = nova
            camadas[base].addnext(nova)
            if base in avancos:
                avancos[alvo] = avancos[base]
        doc.write(caminho)

    info['name'] = info['name'] + ' PT'
    with open(os.path.join(destino, 'font.json'), 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=4)
    return info['name'], sorted(impossiveis)
