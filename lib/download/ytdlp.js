const { execFile } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { mkdir, readdir, stat, rm } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/**
 * Backend de YouTube usando yt-dlp (muito mais confiavel que o cobalt para YT).
 * O cobalt continua para os outros servicos.
 *
 * Binarios ficam em ./bin (yt-dlp.exe + ffmpeg.exe), ou nos caminhos dos envs
 * YTDLP_PATH / FFMPEG_DIR (ex.: instalados no sistema, numa VPS Linux).
 */

const PROJECT_BIN = path.resolve(__dirname, "../../bin");
const IS_WIN = process.platform === "win32";

const YTDLP = process.env.YTDLP_PATH || path.join(PROJECT_BIN, IS_WIN ? "yt-dlp.exe" : "yt-dlp");
const FFMPEG_DIR = process.env.FFMPEG_DIR || PROJECT_BIN;
const DOWNLOAD_DIR = path.join(os.tmpdir(), "botinsanoskol-dl");

function isYouTube(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h === "youtube.com" || h === "youtu.be" || h === "m.youtube.com" || h === "music.youtube.com";
  } catch {
    return false;
  }
}

/** O binario do yt-dlp esta presente? (usado no aviso de inicializacao) */
function ytdlpAvailable() {
  return process.env.YTDLP_PATH ? true : existsSync(YTDLP);
}

function run(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

const BASE_ARGS = ["--no-warnings", "--no-playlist", "--no-progress", "--ffmpeg-location", FFMPEG_DIR];

/** Metadados do video: titulo, thumbnail e duracao (ou null se falhar). */
async function ytMeta(url) {
  try {
    const { stdout } = await run([...BASE_ARGS, "--print", "%(title)s", "--print", "%(thumbnail)s", "--print", "%(duration)s", url], 30_000);
    const [title, thumbnail, duration] = stdout.trim().split("\n");
    return {
      title: title || "video",
      thumbnail: thumbnail && thumbnail !== "NA" ? thumbnail : null,
      duration: Number(duration) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Baixa o video/audio para um diretorio temporario unico.
 * `spec.audio` (ex.: 'mp3'/'m4a') => extrai audio; senao `spec.format` (+ merge mp4).
 * @returns {Promise<{ok:true, path, filename, size, dir} | {ok:false, reason, dir?}>}
 */
async function ytDownload(url, spec, timeoutMs = 180_000) {
  const dir = path.join(DOWNLOAD_DIR, "yt-" + randomUUID().replace(/-/g, "").slice(0, 10));
  await mkdir(dir, { recursive: true });

  const args = [...BASE_ARGS, "--restrict-filenames", "-o", path.join(dir, "%(title).120s.%(ext)s")];
  if (spec.audio) {
    args.push("-f", "ba/b", "-x", "--audio-format", spec.audio, "--audio-quality", "5");
  } else {
    args.push("-f", spec.format, "--merge-output-format", spec.merge || "mp4");
  }
  args.push(url);

  try {
    await run(args, timeoutMs);
    const files = await readdir(dir);
    if (!files.length) return { ok: false, reason: "no_output", dir };
    const filename = files[0];
    const full = path.join(dir, filename);
    const { size } = await stat(full);
    if (!size) return { ok: false, reason: "empty", dir };
    return { ok: true, path: full, filename, size, dir };
  } catch (err) {
    return { ok: false, reason: "ytdlp_error", message: String(err?.stderr || err?.message || err).slice(0, 300), dir };
  }
}

/** Tamanho estimado do formato em bytes, SEM baixar (ou null se desconhecido). */
async function ytSize(url, spec) {
  try {
    const fmt = spec.audio ? "ba/b" : spec.format;
    const { stdout } = await run([...BASE_ARGS, "-f", fmt, "--print", "%(filesize,filesize_approx)s", url], 30_000);
    const n = Number(stdout.trim().split("\n")[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * URL direta de download (CDN do Google), SEM baixar, usando um stream unico.
 * Funciona no navegador de qualquer pessoa (nao e localhost, nao expira em 90s).
 * @returns {Promise<string|null>}
 */
async function ytDirectUrl(url, spec) {
  try {
    const fmt = spec.direct || (spec.audio ? "bestaudio/best" : "best");
    const { stdout } = await run([...BASE_ARGS, "-g", "-f", fmt, url], 30_000);
    const first = stdout.trim().split("\n").filter(Boolean)[0];
    return first || null;
  } catch {
    return null;
  }
}

/** Apaga o diretorio temporario de um download (chamar depois de anexar). */
async function ytCleanup(dir) {
  if (!dir) return;
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

module.exports = { isYouTube, ytdlpAvailable, ytMeta, ytDownload, ytSize, ytDirectUrl, ytCleanup };
