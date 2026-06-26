const { MessageFlags, EmbedBuilder } = require("discord.js");
const { getRequest } = require("./cache.js");
const { FORMAT_BY_KEY } = require("./formats.js");
const { cobaltRequest, downloadCapped, explainCobaltError } = require("./cobalt.js");
const { isYouTube, ytDownload, ytCleanup, ytSize, ytDirectUrl } = require("./ytdlp.js");
const { emojiTag } = require("../emojis.js");
const { config } = require("./config.js");

// funcao (nao const) porque o emoji custom so existe depois do ensureEmojis no startup
const expired = () => `${emojiTag("expired")} Esse menu expirou ou o bot reiniciou. Rode \`/baixar\` de novo.`;

/** Roteia os cliques de botao a partir do prefixo do custom_id. */
async function handleButton(interaction) {
  const [kind, a, b] = interaction.customId.split(":");
  if (kind === "dl") return handleDownload(interaction, a, b); // dl:<formato>:<token>
  if (kind === "pk") return handlePicker(interaction, a); //       pk:<token>
}

async function handleDownload(interaction, formatKey, token) {
  const fmt = FORMAT_BY_KEY[formatKey];
  const entry = getRequest(token);
  if (!fmt || !entry) {
    await interaction.reply({ content: expired(), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // so quem clicou ve

  if (isYouTube(entry.url)) {
    await downloadViaYtdlp(interaction, fmt, entry.url);
  } else {
    await downloadViaCobalt(interaction, fmt, entry.url);
  }
}

/** YouTube: yt-dlp baixa e anexa; se passar do limite, manda a URL direta (CDN). */
async function downloadViaYtdlp(interaction, fmt, url) {
  const maxBytes = config.maxUploadMb * 1024 * 1024;

  // Pre-checa o tamanho SEM baixar: se ja passa do limite, manda o link direto.
  const pre = await ytSize(url, fmt.yt);
  if (pre && pre > maxBytes) {
    await sendYtLink(interaction, fmt, url, pre);
    return;
  }

  const result = await ytDownload(url, fmt.yt);
  try {
    if (result.ok && result.size <= maxBytes) {
      await interaction.editReply({
        content: `${emojiTag("success")} **${fmt.label}** — \`${result.filename}\` (${mb(result.size)})`,
        files: [{ attachment: result.path, name: result.filename }],
      });
      return;
    }
    // Passou do limite (pre-check nao pegou) ou o download falhou -> link direto.
    await sendYtLink(interaction, fmt, url, result.ok ? result.size : pre, result.ok ? null : result);
  } finally {
    await ytCleanup(result.dir);
  }
}

/** Manda a URL direta do YouTube (CDN do Google) — funciona no navegador de todos. */
async function sendYtLink(interaction, fmt, url, sizeBytes, fail) {
  const direct = await ytDirectUrl(url, fmt.yt);
  if (!direct) {
    const reason = fail?.reason ? ` (${fail.reason})` : "";
    await interaction.editReply(`${emojiTag("error")} Nao consegui baixar nem gerar link para **${fmt.label}**${reason}.`);
    return;
  }
  await interaction.editReply(linkReply(fmt.label, direct, sizeBytes));
}

/**
 * Reply com link "bonito": a URL do googlevideo tem ~1180 chars (botao de Link
 * so aceita 512), entao usamos um LINK MASCARADO num embed — clicavel e sem
 * mostrar a URL gigante.
 */
function linkReply(label, url, sizeBytes, note) {
  const tam = sizeBytes ? ` (~${mb(sizeBytes)})` : "";
  const desc =
    `${emojiTag("file")} **${label}**${tam} passa do limite de ${config.maxUploadMb} MB para anexar.\n\n` +
    `### ${emojiTag("download")} [Clique aqui para baixar](${url})` +
    (note ? `\n\n${note}` : "");
  return { embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription(desc)] };
}

/** Outros servicos: cobalt resolve e o bot baixa/anexa (ou manda link se grande). */
async function downloadViaCobalt(interaction, fmt, url) {
  const data = await cobaltRequest(url, fmt.cobalt);
  if (data.status === "error") {
    await interaction.editReply(`${emojiTag("error")} ${explainCobaltError(data.error?.code)}`);
    return;
  }

  const fileUrl = pickUrl(data);
  if (!fileUrl) {
    await interaction.editReply(`${emojiTag("error")} Nao consegui obter um link de download para esse formato.`);
    return;
  }

  const filename = sanitizeName(data.filename || fmt.key);
  const maxBytes = config.maxUploadMb * 1024 * 1024;
  const dl = await downloadCapped(fileUrl, maxBytes);

  if (dl.ok) {
    try {
      await interaction.editReply({
        content: `${emojiTag("success")} **${fmt.label}** — \`${filename}\` (${mb(dl.size)})`,
        files: [{ attachment: dl.buffer, name: filename }],
      });
      return;
    } catch (err) {
      console.warn("[download] upload falhou, caindo para link:", err?.message || err);
    }
  }

  await interaction.editReply(
    linkReply(fmt.label, fileUrl, dl.ok ? dl.size : null, "_Link de tunnel expira em ~90s — baixe agora._"),
  );
}

async function handlePicker(interaction, token) {
  const entry = getRequest(token);
  if (!entry?.picker) {
    await interaction.reply({ content: expired(), flags: MessageFlags.Ephemeral });
    return;
  }

  const lines = entry.picker.map((p, i) => `${i + 1}. [${p.type || "midia"}] <${p.url}>`);
  if (entry.audio) lines.push(`${emojiTag("audio")} audio: <${entry.audio}>`);

  await interaction.reply({
    content: (`${emojiTag("link")} **Links da galeria:**\n` + lines.join("\n")).slice(0, 1900),
    flags: MessageFlags.Ephemeral,
  });
}

/** Extrai uma URL baixavel unica de uma resposta do cobalt (ou null). */
function pickUrl(data) {
  if (data.status === "tunnel" || data.status === "redirect") return data.url || null;
  if (data.status === "local-processing") {
    const first = Array.isArray(data.tunnel) ? data.tunnel[0] : null;
    return typeof first === "string" ? first : first?.url || null;
  }
  return null;
}

/** Nome de arquivo seguro para anexo (sem caracteres proibidos, ate 100 chars). */
function sanitizeName(name) {
  let s = String(name || "download").replace(/[\\/:*?"<>|]/g, "_").trim();
  if (!s) s = "download";
  if (s.length > 100) {
    const dot = s.lastIndexOf(".");
    const ext = dot > 0 && s.length - dot <= 6 ? s.slice(dot) : "";
    s = s.slice(0, 100 - ext.length) + ext;
  }
  return s;
}

function mb(bytes) {
  const m = bytes / 1024 / 1024;
  return m >= 1 ? `${m.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

module.exports = { handleButton };
