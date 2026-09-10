/**
 * Conteudo.gs — dados de conteúdo que o casal pode recarregar de uma vez.
 *
 * Rode `popularPresentes()` no editor para preencher a aba Presentes com a
 * lista abaixo (limpa o que estiver lá e insere estes itens). Editar depois na
 * planilha é livre; rodar de novo sobrescreve pela lista daqui.
 */

var PRESENTES_INICIAIS = [
  // ---- Japão ----
  { id: 'g01', titulo: 'Tigela de ramen numa noite fria', descricao: 'Quentinho e reconfortante, do tipo que a gente nunca esquece.', valor: 150 },
  { id: 'g02', titulo: 'Fatia de sashimi em Tóquio', descricao: 'Peixe fresco, wasabi na medida e felicidade no rosto.', valor: 180 },
  { id: 'g03', titulo: "Brinde de sake ao nosso 'sim'", descricao: 'Kanpai! Ao casal recém-casado, do outro lado do mundo.', valor: 250 },
  { id: 'g04', titulo: 'Selfie com os cervos de Nara', descricao: 'Eles fazem reverência, juramos. Ajuda a gente a retribuir.', valor: 250 },
  { id: 'g05', titulo: 'Doces wagashi com matchá', descricao: 'Doces delicados e um matchá amarguinho na medida certa.', valor: 300 },
  { id: 'g06', titulo: 'Karaokê até desafinar em Tóquio', descricao: 'Promessa: ninguém filma. Alguém vai filmar.', valor: 450 },
  { id: 'g07', titulo: 'Contemplar as cerejeiras em flor', descricao: 'Uns minutinhos sob as cerejeiras, de mãos dadas. Perfeito.', valor: 520 },
  { id: 'g08', titulo: 'Banho relaxante num onsen', descricao: 'Águas termais pra desamassar o casal. Ordens do médico.', valor: 560 },
  { id: 'g09', titulo: 'Visita a um templo em Kyoto', descricao: 'Madeira centenária e silêncio. A Mariana vai amar cada viga.', valor: 600 },
  { id: 'g10', titulo: 'Passeio de kimono por Kyoto', descricao: 'Andar de quimono pelas ruelas, sentindo-se de outra época.', valor: 600 },
  { id: 'g11', titulo: 'Os mil torii de Fushimi Inari', descricao: 'Mil portões vermelhos subindo a montanha. De tirar o fôlego.', valor: 650 },
  { id: 'g12', titulo: 'Assento no trem-bala Shinkansen', descricao: 'Rápido, pontual e com vista pro Monte Fuji.', valor: 780 },
  { id: 'g13', titulo: 'Wagyu na chapa', descricao: 'A carne que derrete na boca. Sério, derrete.', valor: 900 },
  { id: 'g14', titulo: 'Omakase no balcão do chef', descricao: 'O chef decide o menu. A gente só se rende, prato após prato.', valor: 950 },
  { id: 'g15', titulo: 'Onsen privativo com vista pro Fuji', descricao: 'Um banho termal só nosso, com o Monte Fuji na janela.', valor: 1100 },
  // ---- China ----
  { id: 'g16', titulo: 'Dim sum sem moderação em Xangai', descricao: 'A regra é não ter regra, só nesse dia.', valor: 500 },
  { id: 'g17', titulo: 'Fatia do pato laqueado de Pequim', descricao: 'Crocante por fora, inesquecível por dentro.', valor: 680 },
  { id: 'g18', titulo: 'Um encontro com os pandas em Chengdu', descricao: 'Tem panda. A gente precisa ir. Não se discute.', valor: 700 },
  { id: 'g19', titulo: 'Um degrau, ou mil, na Muralha da China', descricao: 'São milhares de degraus. Cada cota é um fôlego nosso lá em cima.', valor: 740 },
  { id: 'g20', titulo: 'A Cidade Proibida em Pequim', descricao: 'Palácios sem fim. A Mariana vai querer medir tudo.', valor: 760 },
  { id: 'g21', titulo: 'O Bund de Xangai à noite', descricao: 'A skyline mais linda da China, brilhando sobre o rio.', valor: 820 },
  { id: 'g22', titulo: 'Cruzeiro pelo Rio Li, em Guilin', descricao: 'Montanhas de cartão-postal deslizando pela água.', valor: 1150 },
  { id: 'g23', titulo: 'Trecho aéreo de Tóquio a Pequim', descricao: 'O pulo do Japão pra China, o trecho mais caro e o mais empolgante.', valor: 1200 },
  // ---- Vida a dois ----
  { id: 'g24', titulo: 'A última fatia de pizza dividida no amor', descricao: 'A última fatia sempre foi sua. Agora é oficial.', valor: 200 },
  { id: 'g25', titulo: 'Cafezinho na cama de domingo', descricao: 'O melhor jeito de começar um domingo a dois.', valor: 220 },
  { id: 'g26', titulo: 'A planta que a gente promete não deixar morrer', descricao: 'A gente promete de coração não deixar morrer dessa vez.', valor: 350 },
  { id: 'g27', titulo: 'O edredom de casal, fim da briga pela coberta', descricao: 'Pra acabar de vez com a briga pela coberta.', valor: 480 },
  { id: 'g28', titulo: 'Jogo de taças pra brindar qualquer coisa', descricao: 'Pra brindar qualquer coisa. Terça-feira conta.', valor: 500 },
  { id: 'g29', titulo: 'Air fryer, o eletrodoméstico do amor', descricao: 'O eletrodoméstico oficial do casamento moderno.', valor: 520 },
  { id: 'g30', titulo: 'Almofadas que a Mariana vai combinar com tudo', descricao: 'Que a Mariana vai combinar com absolutamente tudo.', valor: 540 },
  { id: 'g31', titulo: 'Maratona de série no sofá novo', descricao: 'Um sofá novo e uma série pra não acabar nunca.', valor: 580 },
  { id: 'g32', titulo: 'Jogo de panelas pra fingir que cozinha', descricao: 'Pra fingir que a gente cozinha mais do que pede delivery.', valor: 620 },
  { id: 'g33', titulo: 'Vinho pra comemorar 1 mês de casados', descricao: 'Uma taça faz bem ao coração, dizem por aí.', valor: 640 },
  { id: 'g34', titulo: 'Kit churrasco de domingo em família', descricao: 'Pros domingos de família na casa nova.', valor: 660 },
  { id: 'g35', titulo: 'Um quadro pra parede, escolhido pela arquiteta', descricao: 'Escolhido a dedo pela arquiteta da casa.', valor: 720 },
  { id: 'g36', titulo: 'Jantar à luz de velas, sem celular na mesa', descricao: 'Uma noite especial, sem celular na mesa.', valor: 820 },
  { id: 'g37', titulo: 'Robô aspirador pra ninguém mais varrer', descricao: 'Pra ninguém mais discutir de quem é a vez de varrer.', valor: 850 },
  { id: 'g38', titulo: 'Ensaio de fotos do casal na viagem', descricao: 'Um ensaio do casal nas ruas do Japão, pra lembrar pra sempre.', valor: 980 },
  { id: 'g39', titulo: 'Uma diária extra de hotel na viagem', descricao: 'Uma noite a mais de descanso na viagem dos sonhos.', valor: 1000 },
  { id: 'g40', titulo: 'Um dia inteiro do nosso roteiro', descricao: 'Um dia inteirinho da nossa viagem, do café ao jantar.', valor: 1050 },
  // ---- Especial ----
  { id: 'livre', titulo: 'Nossa felicidade na proporção áurea', descricao: 'Não cabe numa cota: contribua com o valor que quiser. Sem contraindicações.', valor: '', tipo: 'livre' }
];

/** Preenche a aba Presentes com PRESENTES_INICIAIS (limpa e reinsere). */
function popularPresentes() {
  var sh = aba(ABAS.PRESENTES);
  var cols = ABAS.PRESENTES.colunas.length;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, cols).clearContent();

  var linhas = PRESENTES_INICIAIS.map(function (p) {
    // [id, titulo, descricao, valor, tipo, status, reservado_por, reservado_em,
    //  pago_por, payment_id, data_pgto, mensagem]
    return [p.id, p.titulo, p.descricao, p.valor, p.tipo || 'item',
            'disponivel', '', '', '', '', '', ''];
  });
  sh.getRange(2, 1, linhas.length, cols).setValues(linhas);
  SpreadsheetApp.flush();
}
