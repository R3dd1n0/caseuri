/**
 * conteudo.js — CAMADA DE CONTEÚDO (desacoplada da arquitetura).
 *
 * Tudo que é texto/dado do casamento vive AQUI. A Mariana pode editar este
 * arquivo à vontade sem tocar em nenhuma lógica. Cores e fontes ficam nas
 * variáveis CSS de `assets/base.css`.
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
    horario: '18h',
    local: 'Flores Arte Bistrô',
    endereco: 'Rua Xavier de Castro, nº 68, Praia de Iracema',
    mapsUrl: 'https://maps.app.goo.gl/duwmXrSrzr9BmJmE9',
    wazeUrl: 'https://waze.com/ul?ll=-3.7214135,-38.5125623&navigate=yes'
  },

  secoes: {
    historia: {
      titulo: 'Nossa história',
      // parágrafos (renderizados um por <p>)
      paragrafos: [
        'Nos conhecemos em um pré-carnaval na Gentilândia, em 2018. Entre música, amigos e aquela mistura típica de carnaval, a gente se encontrou. E, desde então, não largou mais a mão um do outro.',
        'Vieram a formatura do Felipe, a troca de emprego da Mariana, os primeiros planos para o futuro e, dois anos depois, o nosso primeiro noivado. Então veio a pandemia, que bagunçou os planos de todo mundo e, no nosso caso, acabou dando aquele empurrãozinho para a gente morar junto. Mas, pensando bem, o Felipe já estava se preparando para isso muito antes: comprou um jogo de pratos e um liquidificador antes mesmo de a gente ter casa. O plano, pelo visto, já estava bem encaminhado, só faltava mesmo a desculpa.',
        'E assim começamos a construir nosso primeiro cantinho. Vieram muitas descobertas, uma vida compartilhada, o primeiro cachorro, depois o segundo, uma ou outra viagem, o segundo noivado no final de 2025, agora vai, e tantos outros capítulos que fizeram os anos passarem rápido demais.',
        'Foram quase nove anos de mudanças, desafios, incertezas, adaptações, conquistas e muitos dias comuns que, olhando para trás, se tornaram parte das nossas melhores lembranças. Fomos construindo, aos poucos, a vida que hoje é nossa.',
        'E, no meio de tudo isso, uma coisa permaneceu: a certeza de ter um ao outro.',
        'Agora, queremos celebrar mais um passo dessa caminhada ao lado das pessoas que fizeram parte dela, que estiveram por perto nos momentos importantes e que, de alguma forma, caminharam com a gente até aqui.',
        'É com muita alegria que convidamos vocês para celebrar o nosso casamento e, principalmente, tudo o que ainda vem pela frente!'
      ],
      // linha do tempo (miniatura + foto grande em assets/historia/)
      fotos: [
        { img: '0005', ano: '2018' },
        { img: '0007', ano: '2018' },
        { img: '0011', ano: '2019' },
        { img: '0012', ano: '2019' },
        { img: '0013', ano: '2020' },
        { img: '0014', ano: '2020' },
        { img: '0016', ano: '2021' },
        { img: '0019', ano: '2022' },
        { img: '0020', ano: '2023' },
        { img: '0024', ano: '2024' },
        { img: '0027', ano: '2024' },
        { img: '0029', ano: '2025' },
        { img: '0030', ano: '2025' },
        { img: '0033', ano: '2025' },
        { img: '0034', ano: '2025' }
      ]
    },
    quandoOnde: {
      titulo: 'Quando e onde',
      corpo: 'Reserve a data e venha comemorar com a gente.',
      estacionamento: 'As vagas de estacionamento na rua são poucas, então vale ir de aplicativo ou combinar uma carona.'
    },
    dressCode: {
      titulo: 'Dress Code',
      destaque: 'Esporte fino · All black',
      corpo: 'Para celebrar com a gente, queremos todo mundo de preto. A proposta é um visual esporte fino, 100% preto, dos pés à cabeça, sem medo de exagerar!'
    },
    informacoes: {
      titulo: 'Informações',
      corpo: ''
    },
    recados: {
      titulo: 'Recadinhos',
      paragrafos: [
        'Se você está aqui, é porque foi escolhido a dedo. Entre tantas pessoas que fazem parte da nossa história, vocês estão entre aquelas que queremos bem perto para celebrar esse momento.',
        'Nos vemos dia 12 de novembro. 🤍'
      ]
    }
  },

  // Mural de recados (os convidados escrevem para os noivos; fica privado).
  mural: {
    titulo: 'Deixe seu recado para os noivos',
    placeholderNome: 'Seu nome',
    placeholderMensagem: 'Escreva aqui seu recado…',
    botao: 'Enviar recado',
    sucesso: 'Recado enviado, muito obrigado 💛',
    erro: 'Não deu para enviar agora. Tente de novo em instantes.'
  },

  rsvp: {
    titulo: 'Confirme sua presença',
    // Aviso sutil e não agressivo para quem ainda não deu presente.
    lembreteSemPresente: 'Sem pressa 💛 quando quiser, dá uma olhada na lista.'
  },

  presentes: {
    titulo: 'Lista de presentes',
    intro: 'Escolha um presente ou contribua com o valor que quiser.',
    // botão único do card; a escolha Pix/Cartão só aparece depois do clique
    botaoPresentear: 'Quero presentear',
    escolhaMetodo: 'Como prefere pagar?',
    pagarPix: 'Pix',
    pagarCartao: 'Cartão',
    // rótulo do card de contribuição livre (item tipo "livre" no catálogo)
    livreChamada: 'Contribuir com um valor',
    // mostrado depois que o convite já presenteou (nome do grupo entra na frente)
    obrigado: 'já recebemos seu presente, muito obrigado 💛 se quiser presentear de novo, fique à vontade.'
  },

  // Textos da landing (gate por nome)
  gate: {
    titulo: 'Você está convidado',
    instrucao: 'Digite seu nome e sobrenome para entrar',
    placeholder: 'Seu nome e sobrenome',
    botao: 'Entrar',
    erroNaoEncontrado: 'Não encontramos seu nome. Confira a grafia ou fale com os noivos.',
    pedirSobrenome: 'Temos mais de uma pessoa com esse nome. Digite também um sobrenome.'
  }
};
