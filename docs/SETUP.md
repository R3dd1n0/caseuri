# SETUP — como colocar no ar

Três blocos: **(A)** backend na planilha, **(B)** Mercado Pago, **(C)** site no
GitHub Pages. Nada aqui exige CNPJ. Faça na ordem.

---

## A. Backend (Google Sheets + Apps Script)

1. **Crie uma planilha** nova no Google Sheets (com a conta pessoal de vocês).
   Ela será o banco de dados **e** o painel de controle.
2. Menu **Extensões → Apps Script**. Abre o editor (script vinculado à planilha).
3. **Cole os arquivos** de `backend/` no editor (um arquivo `.gs` para cada, com
   o mesmo nome). Em ⚙️ *Project Settings*, marque *"Show appsscript.json"* e
   cole o conteúdo de `backend/appsscript.json`.
   > Alternativa p/ quem prefere linha de comando: use o `clasp`
   > (`clasp push`) apontando para a pasta `backend/`.
4. **Configure os segredos** em ⚙️ *Project Settings → Script Properties*:
   | Propriedade | Valor |
   |---|---|
   | `MP_ACCESS_TOKEN` | (preenchido no bloco B) |
   | `TOKEN_SECRET` | uma frase aleatória longa (assina os tokens de sessão) |
   | `WEBHOOK_URL` | (preenchido no fim do bloco A, após o deploy) |
   | `SHEET_ID` | opcional; só se o script não for vinculado à planilha |
5. No editor, rode a função **`setupPlanilha`** uma vez (selecione no topo e
   ▶️ *Run*). Autorize os escopos quando pedir. Isso cria as abas
   `Convidados`, `Presentes`, `Pagamentos`, `Config` com exemplos.
6. **Publique o Web App:** *Deploy → New deployment → tipo Web app*:
   - *Execute as:* **Você (mesmo)**
   - *Who has access:* **Anyone** (necessário p/ o site e o webhook do MP)
   - Copie a **URL do Web App** (termina em `/exec`).
7. Cole essa URL na Script Property **`WEBHOOK_URL`** (é lida em tempo de
   execução; não precisa republicar).
8. Rode **`instalarTriggerPagamentos`** uma vez — instala a checagem de
   pagamentos a cada 5 min (rede de segurança do webhook).

> A cada mudança no código, faça *Deploy → Manage deployments → editar → nova
> versão* para publicar. A URL continua a mesma.

---

## B. Mercado Pago (pessoa física / CPF)

1. Tenha uma conta Mercado Pago pessoal (CPF).
2. Acesse **Mercado Pago Developers → Suas integrações → Criar aplicação**.
3. Pegue o **Access Token de produção** e cole na Script Property
   `MP_ACCESS_TOKEN`.
4. **Webhook:** o backend já manda `notification_url` em cada cobrança, então
   normalmente **não precisa** configurar nada no painel. Se quiser reforçar,
   em *Webhooks* aponte a mesma URL do Web App para o tópico **Pagamentos**.
5. ⚠️ **Taxas:** PIX de pessoa física é gratuito por regra do BC, **exceto**
   QR Code dinâmico e/ou +30 recebimentos/mês, onde pode haver tarifa.
   **Confirme as taxas atuais** na sua conta antes de divulgar a lista.

> Para testar sem gastar, use as credenciais de **teste** do MP e um usuário de
> teste; depois troque pelo token de produção.

---

## C. Site (GitHub Pages)

1. Edite **`site/config.js`** e coloque a URL do Web App em `BASE_URL`.
2. Faça commit/push na branch `main`.
3. No GitHub: **Settings → Pages → Source: GitHub Actions**. O workflow
   `.github/workflows/pages.yml` publica só a pasta `site/`.
4. A URL pública aparece na aba *Actions*/*Pages* (algo como
   `https://<usuario>.github.io/<repo>/`).

Pronto. Para testar localmente: `python3 -m http.server` dentro de `site/` e
abra `http://localhost:8000` (com o `BASE_URL` já apontando para o Web App).

---

## Conteúdo e dados (depois, sem mexer no código)
- **Textos/data/nomes:** `site/conteudo.js`. **Cores/fontes:** variáveis no topo
  de `site/assets/base.css`.
- **Convidados:** aba `Convidados` da planilha. Coluna `nomes` aceita vários
  nomes por convite separados por `;` (ex.: `Felipe Araujo; Mariana Souza`).
- **Presentes:** aba `Presentes` (tipo `item` esgota; tipo `livre` é
  contribuição de qualquer valor).
- A **lista de convidados nunca vai para o GitHub** — vive só na planilha.
