# Deploy da apiv2 + Dashboard v3

A dashboard nova (pasta `dashboardteste/`, na Vercel) fala com o bot **ao vivo** por uma
API REST + WebSocket que roda dentro do próprio bot (`apiv2/`, porta **4201**).
Não usa mais o "despejo no MongoDB a cada 10s".

```
Browser ──Discord OAuth──▶ Vercel (Next.js)
   │  REST: /api/bot/* (proxy seguro, token server-side)  ─┐
   │  WS:   wss://api.konbdemo.xyz/ws?ticket=…             ─┤──▶ Bot na VPS (porta 4201)
   └───────────────────────────────────────────────────────┘     atrás de Caddy/nginx (HTTPS)
```

---

## 1. Gere os dois segredos compartilhados

No seu PC ou na VPS:

```bash
openssl rand -hex 32   # use como BOT_API_TOKEN  (nos DOIS lados)
openssl rand -hex 32   # use como REALTIME_SECRET (nos DOIS lados)
```

Os mesmos valores entram no `.env` do **bot** e nas variáveis da **Vercel**.

## 2. Hostname HTTPS grátis (DuckDNS)

Não precisa de domínio pago. Em [duckdns.org](https://www.duckdns.org):
1. Entre (Google/GitHub) e crie um subdomínio, ex.: `minionsbot` → `minionsbot.duckdns.org`.
2. No campo **current ip**, coloque o **IP público da sua VM** e clique **update ip**.

Seu endereço do bot fica `https://minionsbot.duckdns.org`. (Alternativas: registrar um domínio,
`<ip>.sslip.io` sem cadastro, ou Cloudflare Tunnel.)

## 3. Configure o `.env` do bot (na VPS)

Acrescente ao `.env` (veja `.env.example`):

```env
APIV2_ENABLED=true
APIV2_PORT=4201
API_DOMAIN=minionsbot.duckdns.org
BOT_API_TOKEN=<o-hex-de-32-do-passo-1>
REALTIME_SECRET=<o-outro-hex-de-32>
DASHBOARD_ORIGINS=https://SEU-PROJETO.vercel.app
LEGACY_MONGO_SYNC=false
```

> `API_DOMAIN` = o domínio do passo 2 (o Caddy usa p/ emitir o cert).
> `DASHBOARD_ORIGINS` = a URL EXATA da dashboard na Vercel (sem barra no fim). É o CORS/WS.

## 4. Suba o bot com o proxy HTTPS (Caddy)

O Caddy obtém o certificado TLS sozinho. A partir da **raiz do projeto**:

```bash
docker compose -f docker-compose.yml -f deploy/apiv2/docker-compose.apiv2.yml up -d --build
```

> ⚠ **Abra as portas 80 e 443 no firewall da nuvem** (Azure NSG / Oracle Security List)
> e no host, senão o Caddy não consegue emitir o certificado TLS:
> ```bash
> sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
> sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
> sudo netfilter-persistent save   # se aplicável
> ```
> (e libere 80/443 de entrada no painel da Azure/Oracle).

> ℹ Os proxies apontam para a porta **4201** fixa. Se mudar `APIV2_PORT`, edite também
> `deploy/apiv2/Caddyfile` (`reverse_proxy bot:PORTA`) e/ou `nginx.conf`.

Confira:

```bash
curl https://minionsbot.duckdns.org/health
# -> {"ok":true,"ready":true,...}
```

> **Alternativa nginx:** se já tem nginx no host, use `deploy/apiv2/nginx.conf` e publique a
> porta do bot adicionando `ports: ["127.0.0.1:4201:4201"]` no serviço `bot`.

## 5. Configure a Vercel (dashboard)

Em **Project → Settings → Environment Variables** (veja `dashboardteste/.env.example`):

| Variável | Valor |
|---|---|
| `DISCORD_CLIENT_ID` | id do app no Discord |
| `DISCORD_CLIENT_SECRET` | secret do app |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://SEU-PROJETO.vercel.app` |
| `BOT_API_URL` | `https://minionsbot.duckdns.org` |
| `BOT_API_TOKEN` | **o mesmo** do passo 1 |
| `REALTIME_SECRET` | **o mesmo** do passo 1 |
| `BOT_WS_URL` | (opcional, deixe vazio — derivado de `BOT_API_URL`) |

## 6. Discord Developer Portal → OAuth2 → Redirects

Adicione a URL de callback da Vercel:

```
https://SEU-PROJETO.vercel.app/api/auth/callback/discord
```

(e `http://localhost:3000/api/auth/callback/discord` para testar local).

## 7. Pronto

Abra `https://SEU-PROJETO.vercel.app`, entre com o Discord e controle tudo ao vivo.

---

### Rodar a dashboard local (dev)

```bash
cd dashboardteste
cp .env.example .env.local   # preencha; BOT_API_URL pode apontar pro https da VPS
npm install
npm run dev
```

### Segurança (resumo)

- O `BOT_API_TOKEN` **nunca** vai ao browser — só as route handlers da Vercel o usam.
- O browser abre o WebSocket com um **ticket** assinado (HS256, expira em 120s) que carrega
  só o `userId` e as guilds que o usuário pode gerenciar. O bot valida assinatura + origem.
- Ações de moderação exigem a permissão Discord específica (banir/expulsar/silenciar),
  verificada na Vercel antes de repassar ao bot.
