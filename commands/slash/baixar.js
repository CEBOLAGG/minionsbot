const { MessageFlags } = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");
const { cobaltRequest, explainCobaltError } = require("../../lib/download/cobalt");
const { deriveThumbnail, hostnameOf } = require("../../lib/download/thumbnail");
const { isYouTube, ytMeta, ytdlpAvailable } = require("../../lib/download/ytdlp");
const { putRequest } = require("../../lib/download/cache");
const { buildPreviewMessage, buildPickerMessage, buildErrorMessage } = require("../../lib/download/ui");

const command = new SlashCommand()
  .setName("baixar")
  .setDescription("Baixa videos e midias de um link (YouTube via yt-dlp, resto via cobalt).")
  .addStringOption((opt) =>
    opt
      .setName("link")
      .setDescription("URL do video/midia (YouTube, TikTok, Twitter/X, Instagram, Reddit, SoundCloud...)")
      .setRequired(true),
  )
  .setRun(async (client, interaction, options) => {
    const url = options.getString("link").trim();

    if (!/^https?:\/\/\S+$/i.test(url)) {
      await interaction.reply(
        buildErrorMessage({
          title: "Link invalido",
          detail: "Envie um link comecando com `http://` ou `https://`.",
        }),
      );
      return;
    }

    await interaction.deferReply();

    // --- YouTube: usa yt-dlp (mais confiavel que o cobalt para YT) ---
    if (isYouTube(url)) {
      if (!ytdlpAvailable()) {
        await interaction.editReply(
          buildErrorMessage({
            title: "yt-dlp ausente",
            detail: "O binario do yt-dlp nao foi encontrado em `bin/`. Veja o README (secao YouTube).",
          }),
        );
        return;
      }
      const meta = await ytMeta(url);
      if (!meta) {
        await interaction.editReply(
          buildErrorMessage({
            title: "Video indisponivel",
            detail: "O yt-dlp nao conseguiu ler esse video (privado, removido, com idade restrita ou bloqueado).",
          }),
        );
        return;
      }
      const token = putRequest({ url, userId: interaction.user.id });
      const thumbnail = meta.thumbnail || (await deriveThumbnail(url));
      await interaction.editReply(buildPreviewMessage({ url, host: "youtube.com", thumbnail, token, title: meta.title }));
      return;
    }

    // --- Outros servicos: cobalt ---
    const probe = await cobaltRequest(url, { downloadMode: "auto" });
    if (probe.status === "error") {
      await interaction.editReply(
        buildErrorMessage({ title: "Midia indisponivel", detail: explainCobaltError(probe.error?.code) }),
      );
      return;
    }

    const host = hostnameOf(url);

    if (probe.status === "picker") {
      const items = (probe.picker || []).filter((p) => p?.url);
      const token = putRequest({ url, userId: interaction.user.id, picker: items, audio: probe.audio || null });
      await interaction.editReply(buildPickerMessage({ host, items, token }));
      return;
    }

    const token = putRequest({ url, userId: interaction.user.id });
    const thumbnail = await deriveThumbnail(url);
    await interaction.editReply(buildPreviewMessage({ url, host, thumbnail, token }));
  });

module.exports = command;
