# minionsbot

Bot de Discord (discord.js v14) com **música** (Lavalink v4 via `lavalink-client`), **download** de mídia (`/baixar` com cobalt + yt-dlp, Components v2), **futebol** (jogos ao vivo, Copa do Mundo), **MinionsBet** (apostas com bananas 🍌) e modos de IA (`/ignorantmode`, `/toxicmode`).

Toda a stack roda em **Docker**: `lavalink` + `cobalt` + `bot` (que já inclui Node, yt-dlp e ffmpeg).

---

## 🚀 Deploy (Ubuntu / qualquer Linux com Docker)

Pré-requisitos na máquina: **só Docker** (Engine + plugin Compose) e **git**. Java, Node, Python, yt-dlp, ffmpeg e cobalt já vêm dentro das imagens.

```bash
# 1) Docker (se não tiver)
curl -fsSL https://get.docker.com | sh

# 2) Clonar
git clone <este-repo> minionsbot && cd minionsbot

# 3) Configurar segredos (NÃO versionados)
cp config.example.js config.js          # config.js lê tudo do .env
cp .env.example .env                     # preencha token, MONGO_URI, etc.
cp lavalink/application.example.yml lavalink/application.yml
nano .env                                # edite com seus valores

# 4) Subir tudo
docker compose up -d --build

# 5) Registrar os slash commands (1x)
docker compose run --rm bot npm run deploy

# 6) Logs
docker compose logs -f bot
```

> 💡 **RAM:** Lavalink (Java) + cobalt + bot pedem ~1.5–2GB. Em VPS de 1GB, baixe `-Xmx1G` → `-Xmx512m` no `docker-compose.yml` e crie swap.

---

## 🔑 Configuração

Os segredos **nunca** vão pro git. Eles ficam em arquivos ignorados, criados a partir dos `.example`:

| Arquivo real (ignorado) | Template (versionado) | O que tem |
|---|---|---|
| `.env` | `.env.example` | token, `MONGO_URI`, chaves de API, config do Lavalink |
| `config.js` | `config.example.js` | lê os segredos do `.env` (`process.env.*`) |
| `lavalink/application.yml` | `lavalink/application.example.yml` | config do Lavalink (lê do `.env`) |

Mínimo pra rodar: `token` (bot) e `MONGO_URI` (MongoDB Atlas, grátis). O resto é opcional.

---

## 🖥️ Rodar local (sem Docker)

Precisa de Node 20+, Java 17+, ffmpeg e yt-dlp instalados. Depois:

```bash
npm install
cp config.example.js config.js   # e preencha (ou use .env)
node index.js
```

O Lavalink local pode ser iniciado com `lavalink/start-lavalink.bat` (Windows) após baixar o `Lavalink.jar`.

---

## 📦 Estrutura

```
commands/slash/   comandos (play, baixar, minionsbet, toxicmode, ...)
events/           handlers (messageCreate, interactionCreate, ready, raw, ...)
lib/              DiscordMusicBot (core + camada de compat lavalink-client), emojis
util/             mongodb, guildDb, Controller (botões do player), ...
lavalink/         config do Lavalink self-host (jar/plugins baixados, não versionados)
docker-compose.yml + Dockerfile
```
