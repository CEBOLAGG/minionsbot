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

const command = new SlashCommand()
	.setName("lyrics")
	.setDescription("Get the lyrics of a song")
	.addStringOption((option) =>
		option
			.setName("song")
			.setDescription("The song to get lyrics for")
			.setRequired(false),
	)
	.addStringOption((option) =>
		option
			.setName("artist")
			.setDescription("Artist of the song (optional)")
			.setRequired(false),
	)
	.setRun(async (client, interaction) => {
		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("search")} | **Searching...**`),
			],
		});

		let player;
		if (client.manager) {
			player = client.manager.players.get(interaction.guild.id);
		}

		const songArg = interaction.options.getString("song");
		const artistArg = interaction.options.getString("artist");

		if (!songArg && !player?.current) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("There's nothing playing"),
				],
			});
		}

		let currentTitle = "";
		let currentArtist = "";
		const phrasesToRemove = [
			"Full Video", "Full Audio", "Official Music Video", "Lyrics", "Lyrical Video",
			"Feat.", "Ft.", "Official", "Audio", "Video", "HD", "4K", "Remix", "Lyric Video", "Lyrics Video", "8K",
			"High Quality", "Animation Video", "\\(Official Video\\. .*\\)", "\\(Music Video\\. .*\\)", "\\[NCS Release\\]",
			"Extended", "DJ Edit", "with Lyrics", "Karaoke",
			"Instrumental", "Live", "Acoustic", "Cover", "\\(feat\\. .*\\)"
		];

		if (!songArg && player?.current) {
			currentTitle = player.current.info.title;
			currentTitle = currentTitle
				.replace(new RegExp(phrasesToRemove.join('|'), 'gi'), '')
				.replace(/\s*([\[\(].*?[\]\)])?\s*(\|.*)?\s*(\*.*)?$/, '');

			// Try to extract artist from title if it's in "Artist - Title" format
			const titleParts = currentTitle.split(' - ');
			if (titleParts.length > 1) {
				currentArtist = titleParts[0].trim();
				currentTitle = titleParts[1].trim();
			}
		}

		let query = songArg || currentTitle;
		let artist = artistArg || currentArtist;

		try {
			// LRCLIB API - Free, no API key needed
			const apiUrl = `https://lrclapi.net/api/get?artist_name=${encodeURIComponent(artist || "")}&track_name=${encodeURIComponent(query)}`;

			const response = await axios.get(apiUrl);

			if (!response.data || !response.data.lyrics) {
				throw new Error("No lyrics found");
			}

			const lyricsData = response.data;
			const lyricsText = lyricsData.lyrics;
			const songTitle = lyricsData.trackName || query;
			const artistName = lyricsData.artistName || artist || "Unknown Artist";
			const albumName = lyricsData.albumName || "";

			const button = new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
						.setCustomId('tipsbutton')
						.setLabel('Tips')
						.setEmoji(emojiFor("pin"))
						.setStyle(ButtonStyle.Secondary)
				);

			let lyricsEmbed = new EmbedBuilder()
				.setColor(client.config.embedColor)
				.setTitle(`${songTitle} - ${artistName}`)
				.setFooter({
					text: `Lyrics provided by LRCLIB${albumName ? ` | Album: ${albumName}` : ''}`,
				})
				.setDescription(lyricsText);

			if (lyricsText.length > 4096) {
				const truncatedText = lyricsText.substring(0, 4050) + "\n\n[...]";
				lyricsEmbed.setDescription(truncatedText + `\n\nTruncated, the lyrics were too long.`);
			}

			return interaction.editReply({
				embeds: [lyricsEmbed],
				components: [button],
			});

		} catch (error) {
			console.error("Lyrics error:", error.message);
			const button = new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
						.setEmoji(emojiFor("pin"))
						.setCustomId('tipsbutton')
						.setLabel('Tips')
						.setStyle(ButtonStyle.Secondary),
				);
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription(
							`No lyrics found for \`${query}\`${artist ? ` by \`${artist}\`` : ''}!\nMake sure you typed your search correctly.`,
						),
				], components: [button],
			});
		}
	});

module.exports = command;
