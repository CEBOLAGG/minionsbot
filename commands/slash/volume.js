const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder, Colors } = require("discord.js");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("volume")
	.setDescription("Change the volume of the current song.")
	.addNumberOption((option) =>
		option
			.setName("amount")
			.setDescription("Amount of volume you want to change. 0-100")
			.setRequired(false),
	)
	.setRun(async (client, interaction) => {
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
						.setDescription("There is no music playing."),
				],
				ephemeral: true,
			});
		}
		
		let vol = interaction.options.getNumber("amount");
		if (!vol || vol < 1 || vol > 250) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(client.config.embedColor)
						.setDescription(
							`${emojiTag("vol2")} | Current volume **${player.volume}**`,
						),
				],
			});
		}
		
		player.setVolume(vol);
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(
						`${emojiTag("vol2")} | Successfully set volume to **${vol}**`,
					),
			],
		});
	});

module.exports = command;
