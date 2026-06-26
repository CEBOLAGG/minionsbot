# Imagem do minionsbot. Inclui ffmpeg + yt-dlp (feature de download) e sharp (ícones).
# Lavalink e cobalt rodam em containers separados (ver docker-compose.yml).
FROM node:20-bookworm-slim

# ffmpeg + python3 (yt-dlp é zipapp que usa Python) + yt-dlp standalone.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get purge -y curl && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

# A feature de download acha os binários por estes caminhos.
ENV YTDLP_PATH=/usr/local/bin/yt-dlp \
    FFMPEG_DIR=/usr/bin \
    NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

CMD ["node", "index.js"]
