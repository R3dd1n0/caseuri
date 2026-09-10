/**
 * conteudo.js — CAMADA DE CONTEÚDO (desacoplada da arquitetura).
 *
 * Tudo que é texto/dado do casamento vive AQUI. A Mariana pode editar este
 * arquivo à vontade sem tocar em nenhuma lógica. Cores e fontes ficam nas
 * variáveis CSS de `assets/base.css`.
 *
 * ⚠️ Os valores abaixo são PLACEHOLDERS PROVISÓRIOS só para o esqueleto ter o
 * que mostrar. Trocar sem medo.
 */
window.CONTEUDO = {
  casal: {
    nome1: 'Felipe',
    nome2: 'Mariana',
    // usado no <title> e cabeçalhos
    titulo: 'Felipe & Mariana'
  },

  evento: {
    // Data/hora em ISO usada na contagem regressiva (18h de 12/11/2026).
    dataISO: '2026-11-12T18:00:00-03:00',
    dataTexto: '12 de novembro de 2026',
    horario: 'A festa começa às 18h',
    local: 'Flores Arte Bistrô',
    endereco: 'Rua Xavier de Castro, 68, Praia de Iracema, Fortaleza',
    mapsUrl: 'https://maps.app.goo.gl/duwmXrSrzr9BmJmE9',
    wazeUrl: 'https://waze.com/ul?ll=-3.7214135,-38.5125623&navigate=yes'
  },

  // Cada seção tem título + corpo. Textos provisórios.
  // Seções com corpo vazio ('') ficam ocultas até vocês preencherem.
  secoes: {
    historia: {
      titulo: 'Nossa história',
      corpo: ''
    },
    quandoOnde: {
      titulo: 'Quando & onde',
      corpo: 'Reserve a data e venha comemorar com a gente.'
    },
    comoChegar: {
      titulo: 'Como chegar',
      corpo: 'As vagas de estacionamento na rua são poucas, então vale ir de aplicativo ou combinar uma carona.'
    },
    dressCode: {
      titulo: 'Dress code',
      corpo: 'Esporte fino, na cor preta.'
    },
    informacoes: {
      titulo: 'Informações',
      corpo: ''
    },
    recados: {
      titulo: 'Recados',
      corpo: ''
    }
  },

  rsvp: {
    titulo: 'Confirme sua presença',
    // Aviso sutil e não agressivo para quem ainda não deu presente.
    lembreteSemPresente: 'Sem pressa 💛 quando quiser, dá uma olhada na lista.'
  },

  presentes: {
    titulo: 'Lista de presentes',
    intro: 'Escolha um presente ou contribua com o valor que quiser via Pix.',
    // rótulo do card de contribuição livre (item tipo "livre" no catálogo)
    livreChamada: 'Contribuir com um valor',
    // mostrado depois que o convite já presenteou (nome do grupo entra na frente)
    obrigado: 'já recebemos seu presente, muito obrigado 💛 se quiser presentear de novo, fique à vontade.'
  },

  // Textos da landing (gate por nome)
  gate: {
    titulo: 'Você está convidado',
    instrucao: 'Digite seu nome para entrar',
    placeholder: 'Seu nome',
    botao: 'Entrar',
    erroNaoEncontrado: 'Não encontramos seu nome. Confira a grafia ou fale com os noivos.',
    pedirSobrenome: 'Temos mais de uma pessoa com esse nome. Digite também um sobrenome.'
  }
};
