/**
 * Conteudo.gs — dados de conteúdo que o casal pode recarregar de uma vez.
 *
 * Rode `popularPresentes()` no editor para preencher a aba Presentes com a
 * lista abaixo (limpa o que estiver lá e insere estes itens). Editar depois na
 * planilha é livre; rodar de novo sobrescreve pela lista daqui.
 */

var PRESENTES_INICIAIS = [
  // ---- Lua de mel: Japão ----
  { id: 'g01', titulo: 'Tigela de ramen numa noite fria', descricao: 'Quentinho e reconfortante, do tipo que a gente nunca esquece.', valor: 150 },
  { id: 'g02', titulo: 'Fatia de sashimi em Tóquio', descricao: 'Peixe fresco, wasabi na medida e felicidade no rosto.', valor: 180 },
  { id: 'g03', titulo: 'Brinde de sake ao nosso "sim"', descricao: 'Kanpai! Ao casal recém-casado, do outro lado do mundo.', valor: 250 },
  { id: 'g04', titulo: 'Karaokê até desafinar em Tóquio', descricao: 'Promessa: ninguém filma. Alguém vai filmar.', valor: 450 },
  { id: 'g05', titulo: 'Contemplar as cerejeiras em flor', descricao: 'Uns minutinhos sob as cerejeiras, de mãos dadas. Perfeito.', valor: 520 },
  { id: 'g06', titulo: 'Passeio de quimono por Kyoto', descricao: 'Andar de quimono pelas ruelas, sentindo-se de outra época.', valor: 600 },
  { id: 'g07', titulo: 'Assento no trem-bala pelo Japão', descricao: 'Rápido, pontual e com vista pro Monte Fuji.', valor: 780 },
  { id: 'g08', titulo: 'Uma carne que derrete na boca no Japão', descricao: 'A carne mais macia da nossa vida, do outro lado do mundo.', valor: 900 },
  { id: 'g09', titulo: 'Banho termal privativo com vista pro Fuji', descricao: 'Um banho quentinho só nosso, com o Monte Fuji na janela.', valor: 1100 },
  // ---- Lua de mel: China ----
  { id: 'g10', titulo: 'Dim sum sem moderação em Xangai', descricao: 'A regra é não ter regra, só nesse dia.', valor: 500 },
  { id: 'g11', titulo: 'Fatia do pato laqueado de Pequim', descricao: 'Crocante por fora, inesquecível por dentro.', valor: 680 },
  { id: 'g12', titulo: 'Um encontro com os pandas em Chengdu', descricao: 'Tem panda. A gente precisa ir. Não se discute.', valor: 700 },
  { id: 'g13', titulo: 'Um degrau, ou mil, na Muralha da China', descricao: 'São milhares de degraus. Cada cota é um fôlego nosso lá em cima.', valor: 740 },
  { id: 'g14', titulo: 'A Cidade Proibida em Pequim', descricao: 'Palácios sem fim. A Mariana vai querer medir tudo.', valor: 760 },
  { id: 'g15', titulo: 'Um trecho de avião de Tóquio a Pequim', descricao: 'O pulo do Japão pra China, o trecho mais caro e o mais empolgante.', valor: 1200 },
  // ---- Recém-casados ----
  { id: 'g16', titulo: 'O primeiro café da manhã de casados', descricao: 'O primeiro da nossa vida de casados, feito sem pressa nenhuma.', valor: 260 },
  { id: 'g17', titulo: 'Um espumante gelado esperando no quarto', descricao: 'Gelado, borbulhante e esperando a gente subir.', valor: 350 },
  { id: 'g18', titulo: 'Uma massagem a dois na lua de mel', descricao: 'Pra relaxar os dois depois de tanta festa e aeroporto.', valor: 560 },
  { id: 'g19', titulo: 'A suíte da nossa primeira noite de casados', descricao: 'A primeira noite de casados merece uma suíte à altura.', valor: 1150 },
  // ---- Casa e vida a dois ----
  { id: 'g20', titulo: 'A última fatia de pizza dividida no amor', descricao: 'A última fatia sempre foi sua. Agora é oficial.', valor: 200 },
  { id: 'g21', titulo: 'Cafezinho na cama de domingo', descricao: 'O melhor jeito de começar um domingo a dois.', valor: 220 },
  { id: 'g22', titulo: 'A planta que a gente promete não deixar morrer', descricao: 'A gente promete de coração não deixar morrer dessa vez.', valor: 320 },
  { id: 'g23', titulo: 'O edredom de casal, fim da briga pela coberta', descricao: 'Pra acabar de vez com a briga pela coberta.', valor: 480 },
  { id: 'g24', titulo: 'Air fryer, o eletrodoméstico do amor', descricao: 'O eletrodoméstico oficial do casamento moderno.', valor: 520 },
  { id: 'g25', titulo: 'Almofadas que a Mariana vai combinar com tudo', descricao: 'Que a Mariana vai combinar com absolutamente tudo.', valor: 540 },
  { id: 'g26', titulo: 'Maratona de série no sofá novo', descricao: 'Um sofá novo e uma série pra não acabar nunca.', valor: 580 },
  { id: 'g27', titulo: 'Jogo de panelas pra fingir que cozinha', descricao: 'Pra fingir que a gente cozinha mais do que pede delivery.', valor: 620 },
  { id: 'g28', titulo: 'Vinho pra comemorar o primeiro mês de casados', descricao: 'Uma taça faz bem ao coração, dizem por aí.', valor: 640 },
  { id: 'g29', titulo: 'Kit churrasco de domingo em família', descricao: 'Pros domingos de família na casa nova.', valor: 660 },
  { id: 'g30', titulo: 'Um quadro pra parede, escolhido pela arquiteta', descricao: 'Escolhido a dedo pela arquiteta da casa.', valor: 720 },
  { id: 'g31', titulo: 'Jantar à luz de velas, sem celular na mesa', descricao: 'Uma noite especial, sem celular na mesa.', valor: 820 },
  { id: 'g32', titulo: 'Robô aspirador pra ninguém mais varrer', descricao: 'Pra ninguém mais discutir de quem é a vez de varrer.', valor: 850 },
  { id: 'g33', titulo: 'Ensaio de fotos do casal na viagem', descricao: 'Um ensaio do casal na viagem, pra lembrar pra sempre.', valor: 980 },
  { id: 'g34', titulo: 'Uma diária extra de hotel na viagem', descricao: 'Uma noite a mais de descanso na viagem dos sonhos.', valor: 1000 },
  { id: 'g35', titulo: 'Um dia inteiro do nosso roteiro', descricao: 'Um dia inteirinho da nossa viagem, do café ao jantar.', valor: 1050 },
  // ---- Contribuição livre ----
  { id: 'livre', titulo: 'Um presente com o valor que quiser', descricao: 'Não cabe numa cota só. Contribua com quanto quiser. Sem contraindicações.', valor: '', tipo: 'livre' }
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
