const SlashCommand = require("../../lib/SlashCommand");
const {
	ActionRowBuilder,
	ButtonBuilder,
	EmbedBuilder,
	ButtonStyle,
	Colors
} = require("discord.js");
const axios = require("axios");
const { emojiFor, emojiTag } = require("../../lib/emojis");

// Ruído comum em títulos do YouTube (usado só no fallback LRCLIB)
const phrasesToRemove = [
	"Full Video", "Full Audio", "Official Music Video", "Lyrics", "Lyrical Video",
	"Feat.", "Ft.", "Official", "Audio", "Video", "HD", "4K", "Remix", "Lyric Video", "Lyrics Video", "8K",
	"High Quality", "Animation Video", "\\(Official Video\\. .*\\)", "\\(Music Video\\. .*\\)", "\\[NCS Release\\]",
	"Extended", "DJ Edit", "with Lyrics", "Karaoke",
	"Instrumental", "Live", "Acoustic", "Cover", "\\(feat\\. .*\\)"
];

// Pega um nó conectado do lavalink-client (pro node.lyrics.get quando não há player tocando)
function getConnectedNode(client, player) {
	if (player?.node?.connected) return player.node;
	const nm = client.manager?.nodeManager;
	if (!nm) return null;
	return (nm.leastUsedNodes && nm.leastUsedNodes[0])
		|| [...nm.nodes.values()].find((n) => n.connected)
		|| null;
}

// Converte o retorno do LavaLyrics ({ text, lines:[{line}] }) em texto
function lyricsToText(lyrics) {
	if (!lyrics) return null;
	if (Array.isArray(lyrics.lines) && lyrics.lines.length) {
		const t = lyrics.lines.map((l) => l.line).filter((s) => s != null).join("\n");
		if (t.trim()) return t;
	}
	if (lyrics.text && lyrics.text.trim()) return lyrics.text;
	return null;
}

const command = new SlashCommand()
	.setName("lyrics")
	.setDescription("Get the lyrics of a song")
	.addStringOption((o) => o.setName("song").setDescription("The song to get lyrics for").setRequired(false))
	.addStringOption((o) => o.setName("artist").setDescription("Artist of the song (optional)").setRequired(false))
	.setRun(async (client, interaction) => {
		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("search")} | **Searching...**`),
			],
		});

		const player = client.manager ? client.manager.players.get(interaction.guild.id) : null;
		const songArg = interaction.options.getString("song");
		const artistArg = interaction.options.getString("artist");

		if (!songArg && !player?.current) {
			return interaction.editReply({
				embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("There's nothing playing")],
			});
		}

		let lyricsText = null;
		let titleLine = "";
		let footerSrc = "";
		let synced = false;

		// ===== 1) LavaLyrics (nativo, via Lavalink) =====
		try {
			let lyrics = null;
			if (!songArg && player?.current) {
				// Letra da música que está tocando — usa a fonte da própria faixa
				titleLine = `${player.current.info.title} - ${player.current.info.author || ""}`.trim();
				lyrics = await player.getCurrentLyrics().catch(() => null);
			} else if (songArg) {
				// Letra por busca: resolve a faixa e pede a letra dela ao nó
				const res = await client.manager
					.resolve({ query: `${songArg} ${artistArg || ""}`.trim(), requester: interaction.user })
					.catch(() => null);
				const track = res?.tracks?.[0];
				if (track) {
					titleLine = `${track.info.title} - ${track.info.author || ""}`.trim();
					const node = getConnectedNode(client, player);
					if (node?.lyrics?.get) lyrics = await node.lyrics.get(track, false).catch(() => null);
				}
			}
			if (lyrics) {
				lyricsText = lyricsToText(lyrics);
				synced = Array.isArray(lyrics.lines) && lyrics.lines.length > 0;
				footerSrc = lyrics.provider || lyrics.sourceName || "LavaLyrics";
			}
		} catch (e) {
			client.error?.(`[lyrics] LavaLyrics falhou: ${e.message}`);
		}

		// ===== 2) Fallback: LRCLIB (se o nativo não achou) =====
		if (!lyricsText) {
			let query = songArg || "";
			let artist = artistArg || "";
			if (!songArg && player?.current) {
				let t = player.current.info.title
					.replace(new RegExp(phrasesToRemove.join("|"), "gi"), "")
					.replace(/\s*([\[\(].*?[\]\)])?\s*(\|.*)?\s*(\*.*)?$/, "");
				const parts = t.split(" - ");
				if (parts.length > 1) { artist = artist || parts[0].trim(); t = parts[1].trim(); }
				query = t;
			}
			try {
				const url = `https://lrclapi.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(query)}`;
				const { data } = await axios.get(url, { timeout: 8000 });
				if (data?.lyrics) {
					lyricsText = data.lyrics;
					titleLine = `${data.trackName || query} - ${data.artistName || artist || "Unknown"}`;
					footerSrc = `LRCLIB${data.albumName ? ` | ${data.albumName}` : ""}`;
				}
			} catch (e) {
				client.error?.(`[lyrics] LRCLIB falhou: ${e.message}`);
			}
		}

		if (!lyricsText) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder().setColor(Colors.Red).setDescription(
						`Não achei a letra${titleLine ? ` de \`${titleLine}\`` : ""}.\nTenta com \`/lyrics song:\` (e \`artist:\`).`
					),
				],
			});
		}

		const button = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId("tipsbutton")
				.setLabel("Tips")
				.setEmoji(emojiFor("pin"))
				.setStyle(ButtonStyle.Secondary)
		);

		const embed = new EmbedBuilder()
			.setColor(client.config.embedColor)
			.setTitle(titleLine || "Lyrics")
			.setFooter({ text: `${synced ? "🎤 Sincronizada • " : ""}Fonte: ${footerSrc}` });

		if (lyricsText.length > 4096) {
			embed.setDescription(lyricsText.substring(0, 4050) + "\n\n[...] (letra muito longa, cortada)");
		} else {
			embed.setDescription(lyricsText);
		}

		return interaction.editReply({ embeds: [embed], components: [button] });
	});

module.exports = command;
