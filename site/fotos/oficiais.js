/**
 * oficiais.js — fotos OFICIAIS do casamento (as do fotógrafo), separadas das
 * que os convidados enviam.
 *
 * Cada item é um arquivo do Google Drive (id + tipo), na ordem em que aparece
 * no site (ordem do nome do arquivo). As pastas precisam estar compartilhadas
 * como "qualquer pessoa com o link"; enquanto não estiverem, a seção não
 * aparece e o álbum fica só com as fotos dos convidados.
 *
 * Esta lista é a base fixa. Quando o backend do álbum tiver a ação
 * "oficiais", o site passa a usar o que estiver nas pastas na hora, e fotos
 * novas aparecem sem precisar mexer aqui. "chave" liga cada álbum à pasta
 * configurada no backend (PASTAS_OFICIAIS em backend-fotos/Codigo.gs).
 *
 * Pastas no Drive:
 *   civil  → "Oficial - Civil"  (1MG9ugAs6b1tfht9n0dJlogGamB58Tye5)
 *   jantar → "Oficial - Festa"  (1hBiJ2Zp9sUhR77QFFN0FzcGKyG52Sy0z)
 */
window.FOTOS_OFICIAIS = {
  albuns: [
    {
      chave: 'civil',
      titulo: 'Casamento civil',   // legenda da foto ampliada
      rotulo: 'Civil',             // texto do seletor
      itens: [
        { id: '1wsKQ_ALwJ_Cy-PfXYwyzZ2V8_pGkB1JO', cat: 'foto' },
        { id: '1xmBE5lbkmYv0z2uD-IZ8AoaGjqZd8y0h', cat: 'foto' },
        { id: '192vPEJCxgTkoEtgjFfv5NGHzqcDHZi_T', cat: 'foto' },
        { id: '1J0RfRJfjUc8-jErWd_KxqC8dZEvNUHxM', cat: 'foto' },
        { id: '1-H_QvnwlLI89i0myEjbnyC--jNC6YJ6F', cat: 'foto' },
        { id: '1B-RR8V9PI1I8tTSV8GBF3PX-I--wgi0z', cat: 'foto' },
        { id: '1p6K6o0qw-rbsbhQ-aAtrTElWbN_mhuVN', cat: 'foto' },
        { id: '11bV9vEcOLOnPDHfQXtesqxHHJoe8ANfS', cat: 'foto' },
        { id: '1fely-RXsneNyGfXTnc8cdzv1Rzlk_r8f', cat: 'foto' },
        { id: '1GyKkKPGQmFQYkbRBwBLq81q42RTbA95F', cat: 'foto' }
      ]
    },
    {
      chave: 'jantar',
      titulo: 'Jantar',
      rotulo: 'Jantar',
      itens: [
        { id: '1q74uSTtj3Wa8_q0cGS-gOW4zqeQd23uU', cat: 'foto' },
        { id: '1-d0da50rt1f9QabB_KsxCUwqBwpCCrG5', cat: 'foto' },
        { id: '1jDpelawwZ7H9fO6UdiiiE2qW82JO_aBQ', cat: 'foto' },
        { id: '1WE2fCDLB-318pRkD-dW0RYkva2RTg_oG', cat: 'foto' },
        { id: '1iheD9smhYi29FxcRjz0AF6j5jhKobAWT', cat: 'foto' },
        { id: '1RGwtsPTfLcyQrWljEySF0B0Z5nMbm0wE', cat: 'foto' },
        { id: '14in-dsUdej68cAVataWHqinAlSfmGUJA', cat: 'foto' },
        { id: '1S7z731gWmGn6ZfjJc2hm9qLvzgYGCJQl', cat: 'foto' },
        { id: '143VgLd8C0cF-gkKXzzeFoHmSeyuwb5kP', cat: 'foto' },
        { id: '1lWlMSvYSdPHO35pLWWdmQ413awB7mcSD', cat: 'foto' },
        { id: '12EyDBRby7XuER2wGA0LaGcKk4n-JU0kK', cat: 'foto' },
        { id: '1FzoOtE4zBYvR8KUNmP9G3SvSuQeVQbn2', cat: 'foto' },
        { id: '1H_W-WrEvLZW6-mPNJhcntpgoVUESPPLQ', cat: 'foto' },
        { id: '1eqO-2JJACzLHkfykSCaaXhX0zWwf4Wme', cat: 'foto' },
        { id: '1lB5_6S1eqbe2wgnqZkZFMeSZd9AOFdIu', cat: 'foto' },
        { id: '15O-wa47PortAriQtHno-nEBv2_iQrr-E', cat: 'foto' },
        { id: '1eagde2-LjPzq19dbDanWp68jshV1OcZi', cat: 'foto' },
        { id: '1Cs1LG8hsIMO5ycfimD5xX0JvMxd_ZfHt', cat: 'foto' },
        { id: '1UxDHbMxBAqmbvdgj2x2qz6gI2gSwJGu6', cat: 'foto' },
        { id: '1spo3_p3hMclqt2lUkPIlJC4HqXhLHUIH', cat: 'foto' },
        { id: '1e_Y32CzK_vRygBlBJG--cAWhiMCiZoYX', cat: 'foto' },
        { id: '1Gh6VY3OY86_-BZSL6i6gr_kdXng5f-R-', cat: 'foto' },
        { id: '1ld92uht38q-1td8tPLWOO5PU1YFoClXG', cat: 'foto' }
      ]
    }
  ]
};
