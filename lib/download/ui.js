const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { FORMATS } = require("./formats.js");
const { emojiFor, emojiTag } = require("../emojis.js");

/**
 * Componentes v2: o "embed" e um Container e os formatos sao botoes de interacao
 * dentro dele. Ao clicar, o bot resolve no cobalt na hora e ANEXA o arquivo.
 *
 * A flag IsComponentsV2 precisa ir em cada envio (reply/editReply); por isso
 * cada build ja retorna a flag.
 */

const V2_FLAGS = MessageFlags.IsComponentsV2;

const ACCENT_OK = 0x5865f2;
const ACCENT_ERR = 0xed4245;

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Preview de midia unica: thumbnail + botoes de formato. */
function buildPreviewMessage({ url, host, thumbnail, token, title }) {
  const container = new ContainerBuilder().setAccentColor(ACCENT_OK);

  const media = emojiTag("media");
  const header = title ? `# ${media} ${truncate(title, 200)}` : `# ${media} Midia disponivel`;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${header}\nEscolha um formato para baixar.`),
  );

  const info = `**Fonte:** \`${host}\`\n**Link:** ${url}`;
  if (thumbnail) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(info))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail).setDescription("thumbnail da midia")),
    );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(info));
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Large),
  );

  const rows = new Map();
  for (const f of FORMATS) {
    if (!rows.has(f.row)) rows.set(f.row, new ActionRowBuilder());
    rows.get(f.row).addComponents(
      new ButtonBuilder()
        .setCustomId(`dl:${f.key}:${token}`)
        .setLabel(f.label)
        .setEmoji(emojiFor(f.icon))
        .setStyle(f.style),
    );
  }
  for (const row of rows.values()) container.addActionRowComponents(row);

  return { components: [container], flags: V2_FLAGS };
}

/** Preview de galeria (resposta `picker`): grade de imagens + botao "pegar links". */
function buildPickerMessage({ host, items, token }) {
  const container = new ContainerBuilder().setAccentColor(ACCENT_OK);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${emojiTag("gallery")} Galeria disponivel\n**Fonte:** \`${host}\` • ${items.length} item(ns)`),
  );

  const gallery = new MediaGalleryBuilder();
  let count = 0;
  for (const it of items.slice(0, 10)) {
    const media = it.thumb || (it.type === "photo" ? it.url : null);
    if (!media) continue;
    gallery.addItems(new MediaGalleryItemBuilder().setURL(media).setDescription(it.type || "midia"));
    count++;
  }
  if (count > 0) container.addMediaGalleryComponents(gallery);

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pk:${token}`)
        .setLabel("Pegar todos os links")
        .setEmoji(emojiFor("link"))
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return { components: [container], flags: V2_FLAGS };
}

/** Mensagem de erro padronizada (tambem em componentes v2). */
function buildErrorMessage({ title, detail }) {
  const container = new ContainerBuilder()
    .setAccentColor(ACCENT_ERR)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${emojiTag("error")} ${title}\n${detail}`));
  return { components: [container], flags: V2_FLAGS };
}

module.exports = { V2_FLAGS, buildPreviewMessage, buildPickerMessage, buildErrorMessage };
