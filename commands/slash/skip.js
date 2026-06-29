const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder, Colors } = require("discord.js");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("skip")
	.setDescription("Skip the current song")
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
						.setDescription("There is nothing to skip."),
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
						.setDescription("There is nothing playing."),
				],
				ephemeral: true,
			});
		}
		
		const autoQueue = client.getPlayerData(interaction.guild.id, "autoQueue");
		if (player.queue.length === 0 && (!autoQueue || autoQueue === false)) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription(`There is nothing after [${song.info.title}](${song.info.uri}) in the queue.`),
				],
			});
		}
		
		player.skip(0, false).catch(() => {}); // AVANÇA (player.stop limparia a fila e pararia)

		interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("success")} | **Skipped!**`),
			],
		});
	});

module.exports = command;
