const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");

const command = new SlashCommand()
	.setName("replay")
	.setDescription("Replay current playing track")
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
						.setDescription("I'm not playing anything."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		await interaction.deferReply();
		
		player.seek(0);
		
		let song = player.current;
		if (!song) {
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("Nothing is playing."),
				],
			});
		}
		
		return interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`Replay [${song.info.title}](${song.info.uri})`),
			],
		});
	});

module.exports = command;
