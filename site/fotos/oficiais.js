/**
 * oficiais.js — fotos OFICIAIS do casamento (as do fotógrafo), separadas das
 * que os convidados enviam.
 *
 * Cada item é um arquivo do Google Drive (id + tipo). Os arquivos precisam
 * estar compartilhados como "qualquer pessoa com o link" — basta compartilhar
 * a pasta assim. A ordem aqui é a ordem em que aparecem no site.
 *
 * Enquanto um álbum não tem itens:
 *   - com emBreve: true  → aparece como "Em breve por aqui" (se outro álbum já tiver fotos);
 *   - sem emBreve        → não aparece.
 * Enquanto NENHUM álbum tem itens, o site fica como antes (só convidados).
 */
window.FOTOS_OFICIAIS = {
  albuns: [
    {
      titulo: 'Casamento civil',
      data: '12.11.2026',
      credito: '',
      itens: []
    },
    {
      titulo: 'Jantar',
      data: '12.11.2026',
      credito: '',
      emBreve: true,
      itens: []
    }
  ]
};
