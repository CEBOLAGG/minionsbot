const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("loop")
	.setDescription("Loops the current song")
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
						.setDescription("Nothing is playing right now."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		// Riffy usa setLoop com "track", "queue" ou "none"
		const currentLoop = player.loop;
		if (currentLoop === "track") {
			player.setLoop("none");
		} else {
			player.setLoop("track");
		}
		
		const trackRepeat = player.loop === "track" ? "enabled" : "disabled";
		
		interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("success")} | **Loop has been \`${trackRepeat}\`**`),
			],
		});
	});

module.exports = command;
