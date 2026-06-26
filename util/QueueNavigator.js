const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown } = require("discord.js");
const { emojiFor, emojiTag } = require("../lib/emojis");

/**
 *
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {import("discord.js").ButtonInteraction} interaction
 */
module.exports = async (client, interaction) => {
	if (!interaction.isButton()) return;
	
	// Para navegação da fila
	if (interaction.customId.startsWith("queue:")) {
		const [, guildId, action, pageString] = interaction.customId.split(":");
		let player = null;
		if (client.manager && client.manager.players) {
			player = client.manager.players.get(guildId);
		}
		let page = parseInt(pageString);
		
		if (!player) {
			return interaction.reply({
				embeds: [
					client.Embed(`${emojiTag("error")} | **There is no player to control in this server.**`),
				],
				ephemeral: true
			});
		}
		
		const totalPages = Math.ceil(player.queue.length / 5);
		
		if (action === "next") {
			page = page + 1 < totalPages ? page + 1 : 0;
		} else if (action === "prev") {
			page = page > 0 ? page - 1 : totalPages - 1;
		}
		
		// Obter a lista de músicas para a página atual
		const startIndex = page * 5;
		const queueList = player.queue.map(
			(t, i) => `\` ${i + 1} \` [${t.info.title}](${t.info.uri}) [${t.info.requester || 'Unknown'}]`
		).slice(startIndex, startIndex + 5).join("\n");
		
		let song = player.current;
		if (!song) {
			return interaction.reply({
				embeds: [
					client.Embed(`${emojiTag("error")} | **There is no song playing.**`),
				],
				ephemeral: true
			});
		}
		
		var title = escapeMarkdown(song.info.title);
		title = title.replace(/\]/g, "");
		title = title.replace(/\[/g, "");
		
		const queueEmbed = new EmbedBuilder()
			.setColor(client.config.embedColor)
			.setDescription(`**${emojiTag("audio")} | Now playing:** [${title}](${song.info.uri})\n\n**Queued Tracks**\n${queueList}`)
			.addFields(
				{
					name: "Duration",
					value: song.info.isStream
						? `\`LIVE\``
						: `\`${client.ms(player.position, { colonNotation: true })} / ${client.ms(song.info.length, { colonNotation: true })}\``,
					inline: true,
				},
				{
					name: "Volume",
					value: `\`${player.volume}\``,
					inline: true,
				},
				{
					name: "Total Tracks",
					value: `\`${player.queue.length}\``,
					inline: true,
				},
			)
			.setFooter({ text: `Page ${page + 1}/${totalPages}` });
		
		const navigationRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`queue:${guildId}:prev:${page}`)
				.setEmoji(emojiFor("navleft"))
				.setStyle(ButtonStyle.Primary)
				.setDisabled(page === 0),
			new ButtonBuilder()
				.setCustomId(`queue:${guildId}:next:${page}`)
				.setEmoji(emojiFor("navright"))
				.setStyle(ButtonStyle.Primary)
				.setDisabled(page === totalPages - 1)
		);
		
		await interaction.update({ 
			embeds: [queueEmbed], 
			components: [navigationRow]
		});
		return;
	}
	
	// Para ajuste de volume
	if (interaction.customId.startsWith("volume:")) {
		const [, guildId, volumeLevel] = interaction.customId.split(":");
		let player = null;
		if (client.manager && client.manager.players) {
			player = client.manager.players.get(guildId);
		}
		
		if (!player) {
			return interaction.reply({
				embeds: [
					client.Embed(`${emojiTag("error")} | **There is no player to control in this server.**`),
				],
				ephemeral: true
			});
		}
		
		player.setVolume(parseInt(volumeLevel));
		
		return interaction.update({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("vol2")} | **Volume set to ${volumeLevel}%**`)
			],
			components: []
		});
	}
};
