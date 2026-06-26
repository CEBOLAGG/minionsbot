const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("loopq")
	.setDescription("Loop the current song queue")
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
						.setDescription("There is no music playing."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		// Riffy usa setLoop com "queue" ou "none"
		const currentLoop = player.loop;
		if (currentLoop === "queue") {
			player.setLoop("none");
		} else {
			player.setLoop("queue");
		}
		
		const queueRepeat = player.loop === "queue" ? "enabled" : "disabled";
		
		interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("success")} | **Loop queue is now \`${queueRepeat}\`**`),
			],
		});
	});

module.exports = command;
