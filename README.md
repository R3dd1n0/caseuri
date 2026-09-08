# caseuri — site de casamento

Hub para os convidados: informações, direções, horário, dress code,
confirmação de presença (RSVP) e lista de presentes com PIX. Sem CNPJ.

## Estrutura

```
site/              Frontend estático (GitHub Pages)
  index.html         Página única: gate por nome + hub
  config.js          A ÚNICA config a preencher (URL do backend)
  conteudo.js        CONTEÚDO (textos/data/nomes) — camada desacoplada
  assets/
    base.css         Reset + TEMA em variáveis CSS (cores/fontes aqui)
    api.js           Cliente do backend
    sessao.js        Sessão no dispositivo (localStorage)
    app.js           Orquestração (gate, RSVP, presentes, PIX)
backend/           Google Apps Script (Web App) — o "cérebro"
  Codigo.gs          Roteamento + token de sessão (HMAC)
  Planilha.gs        Abas/schema + setup + config/segredos
  Identidade.gs      Match de nomes (landing)
  Rsvp.gs            Confirmar/recusar presença
  Presentes.gs       Catálogo + reserva (soft-lock) + status
  MercadoPago.gs     Cobrança PIX + webhook + trigger de segurança
docs/
  ESPECIFICACAO.md   Decisões e escopo
  API.md             Contrato frontend↔backend
  SETUP.md           Passo a passo de deploy
.github/workflows/
  pages.yml          Publica site/ no GitHub Pages
```

## Princípio: arquitetura desacoplada do conteúdo

- **Lógica** (backend + JS) não conhece nenhum texto/cor/data específico.
- **Conteúdo** vive em `site/conteudo.js`; **tema** nas variáveis de
  `site/assets/base.css`; **dados** (convidados, presentes) na planilha.
- Trocar conteúdo/visual **não** exige mexer em código.

## Como rodar / publicar
Ver **`docs/SETUP.md`**. Resumo: montar o Apps Script + planilha, ligar o
Mercado Pago, apontar `site/config.js` para o Web App e ativar o GitHub Pages.
