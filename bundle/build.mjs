/**
 * build.mjs — gera um ÚNICO arquivo com todo o backend, para colar de uma vez
 * no editor do Apps Script. Rode: `node bundle/build.mjs`
 *
 * Os módulos em backend/*.gs continuam sendo a fonte da verdade; este bundle é
 * só uma conveniência para quem prefere colar um arquivo só (sem clasp).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// Ordem não importa para o Apps Script (funções são içadas), mas fica legível.
const ordem = ['Codigo', 'Planilha', 'Identidade', 'Rsvp', 'Presentes', 'MercadoPago', 'Conteudo'];

const cabecalho =
`/**
 * ============================================================================
 *  BACKEND COMPLETO — cole TUDO isto no editor do Apps Script (um arquivo só).
 *  Gerado por bundle/build.mjs a partir de backend/*.gs — NÃO edite à mão:
 *  edite os módulos em backend/ e rode \`node bundle/build.mjs\` de novo.
 * ============================================================================
 */

`;

const corpo = ordem.map((nome) => {
  const conteudo = readFileSync(join(raiz, 'backend', nome + '.gs'), 'utf8');
  return `// ===== ${nome}.gs ` + '='.repeat(Math.max(0, 60 - nome.length)) + `\n\n${conteudo.trim()}\n`;
}).join('\n');

writeFileSync(join(raiz, 'bundle', 'apps-script.gs'), cabecalho + corpo + '\n');
console.log('Gerado: bundle/apps-script.gs');
