const { EmbedBuilder, Colors, escapeMarkdown } = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");
const prettyMilliseconds = require("pretty-ms");

const command = new SlashCommand()
	.setName("nowplaying")
	.setDescription("Shows the song currently playing in the voice channel.")
	.setRun(async (client, interaction, options) => {
		let channel = await client.getChannel(client, interaction);
		if (!channel) {
			return;
		}
		
		let player;
		if (client.manager) {
			player = client.manager.players.get(interaction.guild.id);
		} else {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("Lavalink node is not connected"),
				],
			});
		}
		
		if (!player) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("The bot isn't in a channel."),
				],
				ephemeral: true,
			});
		}
		
		if (!player.playing && !player.current) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("There's nothing playing."),
				],
				ephemeral: true,
			});
		}
		
		const song = player.current;
		if (!song) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("There's nothing playing."),
				],
				ephemeral: true,
			});
		}
		
		var title = escapeMarkdown(song.info.title);
		title = title.replace(/\]/g, "");
		title = title.replace(/\[/g, "");
		
		const embed = new EmbedBuilder()
			.setColor(client.config.embedColor)
			.setAuthor({ name: "Now Playing", iconURL: client.config.iconURL })
			.setFields([
				{
					name: "Requested by",
					value: `${song.info.requester || `<@${client.user.id}>`}`,
					inline: true,
				},
				{
					name: "Duration",
					value: song.info.isStream
						? `\`LIVE\``
						: `\`${prettyMilliseconds(player.position, {
							secondsDecimalDigits: 0,
						})} / ${prettyMilliseconds(song.info.length, {
							secondsDecimalDigits: 0,
						})}\``,
					inline: true,
				},
			])
			.setDescription(`[${title}](${song.info.uri})`);
			
		if (song.info.artworkUrl) {
			embed.setThumbnail(song.info.artworkUrl);
		}
		
		return interaction.reply({ embeds: [embed] });
	});

module.exports = command;
