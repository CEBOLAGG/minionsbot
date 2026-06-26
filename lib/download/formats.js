const { ButtonStyle } = require("discord.js");

/**
 * Cada formato vira um botao no preview (custom_id = dl:<key>:<token>).
 * Ao clicar, o bot escolhe o backend pela URL:
 *   - YouTube -> yt-dlp (campo `yt`)
 *   - resto   -> cobalt (campo `cobalt`)
 *
 * `yt.audio` => extrai audio nesse formato; senao usa `yt.format` (+ merge mp4).
 * `yt.direct` => seletor de STREAM UNICO (sem merge), usado para pegar a URL
 *   direta do Google (`yt-dlp -g`) quando o arquivo passa do limite de upload.
 * `row` agrupa os botoes em linhas (max 5 por linha).
 */
const FORMATS = [
  // --- Video ---
  {
    key: "v1080", label: "1080p", icon: "video", style: ButtonStyle.Secondary, row: 0,
    cobalt: { downloadMode: "auto", videoQuality: "1080", youtubeVideoCodec: "h264" },
    yt: { format: "bv*[height<=1080]+ba/b[height<=1080]/b", merge: "mp4", direct: "best[height<=1080]/best" },
  },
  {
    key: "v720", label: "720p", icon: "video", style: ButtonStyle.Secondary, row: 0,
    cobalt: { downloadMode: "auto", videoQuality: "720", youtubeVideoCodec: "h264" },
    yt: { format: "bv*[height<=720]+ba/b[height<=720]/b", merge: "mp4", direct: "best[height<=720]/best" },
  },
  {
    key: "v360", label: "360p", icon: "video", style: ButtonStyle.Secondary, row: 0,
    cobalt: { downloadMode: "auto", videoQuality: "360", youtubeVideoCodec: "h264" },
    yt: { format: "bv*[height<=360]+ba/b[height<=360]/b", merge: "mp4", direct: "best[height<=360]/best" },
  },

  // --- Audio ---
  {
    key: "amp3", label: "Audio MP3", icon: "audio", style: ButtonStyle.Success, row: 1,
    cobalt: { downloadMode: "audio", audioFormat: "mp3", audioBitrate: "320" },
    yt: { audio: "mp3", direct: "bestaudio/best" },
  },
  {
    key: "am4a", label: "Audio M4A", icon: "audio", style: ButtonStyle.Success, row: 1,
    cobalt: { downloadMode: "audio", audioFormat: "best" },
    yt: { audio: "m4a", direct: "bestaudio[ext=m4a]/bestaudio/best" },
  },
];

const FORMAT_BY_KEY = Object.fromEntries(FORMATS.map((f) => [f.key, f]));

module.exports = { FORMATS, FORMAT_BY_KEY };
