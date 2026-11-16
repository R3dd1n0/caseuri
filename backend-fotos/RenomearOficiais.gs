/**
 * RenomearOficiais.gs — padroniza os nomes dos arquivos das pastas de fotos
 * OFICIAIS no Drive. Rode UMA vez no editor (função renomearOficiais) e veja
 * o resultado em Ver → Registros de execução.
 *
 * Resultado:  Felipe-Mariana_Civil_001.jpg, _002.jpg, ...
 *             Felipe-Mariana_Jantar_001.jpg, _002.jpg, ...
 *
 * - A ordem segue o nome atual do arquivo (que, nas câmeras e no WhatsApp, é
 *   a ordem cronológica).
 * - Só mexe em arquivos que AINDA NÃO têm o padrão; os já renomeados ficam
 *   como estão. Dá para rodar de novo quando chegarem fotos novas: elas
 *   continuam a numeração de onde parou.
 * - Não apaga nada, não mexe no conteúdo e o id do arquivo não muda (o site
 *   continua funcionando, e o nome vira o nome do arquivo ao baixar).
 * - Arquivos que estão na lixeira são ignorados.
 *
 * Precisa do escopo do Drive, que o projeto do álbum já tem.
 */
var PASTAS_PARA_RENOMEAR = [
  { pasta: '1MG9ugAs6b1tfht9n0dJlogGamB58Tye5', prefixo: 'Felipe-Mariana_Civil_'  },  // "Oficial - Civil"
  { pasta: '1hBiJ2Zp9sUhR77QFFN0FzcGKyG52Sy0z', prefixo: 'Felipe-Mariana_Jantar_' }   // "Oficial - Festa"
];

function renomearOficiais() {
  PASTAS_PARA_RENOMEAR.forEach(function (p) {
    var pasta = DriveApp.getFolderById(p.pasta);
    var padrao = new RegExp('^' + p.prefixo + '(\\d+)\\.[A-Za-z0-9]+$');

    var arquivos = [], it = pasta.getFiles();
    while (it.hasNext()) arquivos.push(it.next());

    var maior = 0, novos = [];
    arquivos.forEach(function (f) {
      var m = f.getName().match(padrao);
      if (m) maior = Math.max(maior, parseInt(m[1], 10));
      else novos.push(f);
    });

    novos.sort(function (a, b) {
      var x = a.getName(), y = b.getName();
      return x < y ? -1 : (x > y ? 1 : 0);
    });

    novos.forEach(function (f, i) {
      var n = String(maior + i + 1);
      while (n.length < 3) n = '0' + n;
      var ext = (f.getName().match(/\.([A-Za-z0-9]+)$/) || [null, 'jpg'])[1].toLowerCase();
      f.setName(p.prefixo + n + '.' + ext);
    });

    Logger.log(pasta.getName() + ': ' + novos.length + ' renomeados, '
      + (arquivos.length - novos.length) + ' já estavam no padrão, '
      + arquivos.length + ' no total.');
  });
}
