const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("resume")
	.setDescription("Resume current track")
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
						.setDescription("There is no song playing right now."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		if (!player.paused) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("Current track is already resumed"),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		player.pause(false);
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("resume")} **Resumed!**`),
			],
		});
	});

module.exports = command;
