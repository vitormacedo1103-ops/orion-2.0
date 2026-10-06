# Checkout Orionnex — Setup e Operação

Checkout próprio com Mercado Pago **Orders API** (Checkout Transparente): Pix + cartão via Card Payment Brick, backend serverless (Vercel), webhook com validação de assinatura e idempotência.

**NENHUM secret neste repo. Credenciais só em variáveis de ambiente.**

## 1. Arquitetura

```
Landing (estático)
  → /checkout (form + Brick) ──POST /api/create-order──▶ Vercel Serverless (TS)
        │                                              ├─ preço fixo R$647,90 no servidor
        │                                              └─▶ POST /v1/orders (Orders API, X-Idempotency-Key)
        │◀── orderId + (Pix: qr_code) / (cartão: status)
        │──poll──▶ GET /api/order-status?id= ──▶ GET /v1/orders/{id}
        │──aprovado──▶ /obrigado/?order= (revalida no servidor; URL direta sem pedido válido NÃO confirma)
Mercado Pago ──POST /api/webhooks/mercadopago──▶ valida x-signature (HMAC) ─▶ confirma Order ─▶ marca 1x
```

- Frontend **nunca** recebe Access Token. Só a Public Key via `GET /api/config` (pública por natureza).
- Preço exibido no frontend é ilustrativo; o backend usa `PRODUCT.amountCents = 64790` e **ignora** qualquer valor enviado.
- `GET /api/order-status` e `/obrigado` nunca aprovam sem confirmação do Mercado Pago (fail closed).

## 2. Instalação

Pré-requisito: Node 18+.

```bash
npm install
npm run typecheck   # checagem de tipos
npm test            # build + 19 testes (node --test, zero deps de teste)
```

## 3. Variáveis de ambiente

Copie `.env.example` para `.env` (local, **ignorado pelo git**) ou configure na Vercel:

| Variável | Onde obter | Uso |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Painel MP → Sua aplicação → Credenciais de **teste** (`APP_USR...`) | Somente backend |
| `MERCADOPAGO_WEBHOOK_SECRET` | App → Webhooks → configurar notificações → revelar chave | Somente backend |
| `MERCADOPAGO_PUBLIC_KEY` | Credenciais de teste (`TEST-...`) | Frontend (Brick), via `/api/config` |
| `PUBLIC_SITE_URL` | URL pública (ex: `https://orionnexoficial.com`, sem `/` final) | Valida Origin/Referer |
| `MP_ENV` | `test` ou `production` (qualquer outro valor = recusa tudo) | Fail closed |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Opcional (produção). Sem isso: memória local | Idempotência do webhook |

## 4. Mercado Pago — credenciais de teste

1. https://www.mercadopago.com.br/developers/panel/app → sua aplicação → **Testes → Credenciais de teste** (Public Key `TEST-...` + Access Token `APP_USR...`).
2. Cartões de teste (doc: Checkout Transparente Orders → Testes → Cartões): Mastercard `5480 8328 0103 3311`, Visa `4235 6477 2802 5682`, CVV `123`, validade `11/30`, e-mail `test@testuser.com`, titular `APRO` (aprovado) / `OTHE` (recusado) / `CONT` (pendente), CPF `12345678909` se pedido.
3. Pix aprovado: crie order de teste com `payer.first_name: "APRO"` e e-mail `test_user_br@testuser.com` → retorna `action_required/waiting_transfer` e aprova em seguida. Verifique com `GET /v1/orders/{id}`.

## 5. Webhook

1. Painel MP → app → **Webhooks** → URL: `https://SEU-DOMINIO/api/webhooks/mercadopago` (tópico de orders).
2. Copie o **secret gerado** para `MERCADOPAGO_WEBHOOK_SECRET`.
3. Fluxo: valida `x-signature` (`id:{data.id};request-id:{x-request-id};ts:{ts};` + HMAC-SHA256) → `GET /v1/orders/{id}` → grava status 1x → `200 {received:true}`.
4. Teste local: `npm i -g` nada — use `vercel dev` + URL pública (ngrok/Cloudflare tunnel) cadastrada no painel, ou simule com o script de assinatura dos testes.

## 6. Domínio

- Conecte `orionnexoficial.com` (e `www`) na Vercel → atualize `PUBLIC_SITE_URL` e a URL do webhook no painel MP.
- O frontend usa links relativos (`checkout/`, `../obrigado/`), então funciona no Pages (`/orion-2.0/`) e no domínio próprio.

## 7. Testes (11 cenários do escopo)

| # | Cenário | Como testar | Esperado |
|---|---|---|---|
| 1 | Pix aprovado | Checkout → Pix com `first_name APRO` (via API de teste) | QR + aprovação + `/obrigado` confirma |
| 2 | Pix pendente | Pix sem `APRO` | status `pending`, nunca aprovado |
| 3 | Cartão aprovado | Brick + titular `APRO` | aprovado + `/obrigado` confirma |
| 4 | Cartão rejeitado | Brick + titular `OTHE` | mensagem de erro, sem confirmação |
| 5 | Duplo clique | `npm test` (409 em chave repetida) + clicar 2x no botão | 1 cobrança (idempotência) |
| 6 | Webhook duplicado | enviar mesma notificação 2x | 2º retorna 200 sem reprocessar |
| 7 | Assinatura inválida | POST sem `x-signature`/assinatura errada | 401, nada processado |
| 8 | Preço alterado no DevTools | `npm test` (TESTE 8) | backend usa R$647,90 |
| 9 | Marcar pago pelo frontend | chamar `/obrigado/?order=X` sem pedido | sem confirmação falsa |
| 10 | JSON inválido | `npm test` (TESTE 10) + curl | 400 seguro |
| 11 | `/obrigado` direto | abrir URL sem `?order=` válido | "Nenhuma contratação encontrada" |

## 8. Deploy

```bash
npm i -g vercel   # ou via painel: Import Git Repository
vercel --prod     # configure as envs de PRODUÇÃO antes
```

Config do projeto na Vercel (importante): Framework Preset = **Other**,
Build Command com override **vazio** (o repo não tem script `build` de propósito:
a Vercel compila `api/*.ts` sozinha e serve o estático da raiz; qualquer
build que não gere saída faz ela exigir uma pasta `public` inexistente),
Output Directory **vazio** (raiz). Não criar pasta `public`.

GitHub Pages continua servindo o estático, mas **sem `/api`** (checkout mostra erro seguro + WhatsApp). Produção real = Vercel + domínio.

## 9. Troca para produção

1. Credenciais **de produção** no painel MP (chaves sem prefixo `TEST-`/`APP_USR`-teste).
2. `MP_ENV=production`, `PUBLIC_SITE_URL` final, webhook secret de produção.
3. Refaça os testes 1–11 em produção com valores reais baixos primeiro.
4. `UPSTASH_REDIS_REST_*` configurado (idempotência entre instâncias).

## 10. Segurança (resumo)

- Secrets só em env; `.env.example` sem valores; `.gitignore` bloqueia `.env*`, `node_modules/`, `dist/`.
- Fail closed em: config ausente, assinatura inválida, status desconhecido, JSON inválido, origem estranha.
- Sem `innerHTML`/`eval` no frontend; sem `Access-Control-Allow-Origin: *`; CSP restritiva no `vercel.json` (ajustar domínios MP do Brick se a doc exigir).
- Logs mascaram CPF/e-mail e redactam tokens; rate limit em memória (documentado como parcial).
- Cartão: tokenizado pelo Brick; número/CVV nunca tocam nosso backend.

## 11. Troubleshooting

- `checkout_unavailable` (503): envs ausentes ou `MP_ENV` inválido.
- `invalid_idempotency_key` (400): frontend deve enviar UUID v4 em `X-Idempotency-Key`.
- `409 duplicate_request`: mesma chave reutilizada — gere nova por tentativa.
- Brick não carrega: confira `/api/config` (Public Key) e CSP liberando `sdk.mercadopago.com`.
- Webhook 401: secret divergente ou `data.id` maiúsculo (o código normaliza para minúsculo no manifest).
