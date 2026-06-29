const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("skipto")
	.setDescription("skip to a specific song in the queue")
	.addNumberOption((option) =>
		option
			.setName("number")
			.setDescription("The number of tracks to skipto")
			.setRequired(true),
	)
	
	.setRun(async (client, interaction, options) => {
		const args = interaction.options.getNumber("number");
		
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
						.setDescription("I'm not in a channel."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		await interaction.deferReply();
		
		const position = Number(args);
		
		try {
			if (!position || position < 0 || position > player.queue.length) {
				let thing = new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("error")} | Invalid position!`);
				return interaction.editReply({ embeds: [thing] });
			}
			
			// player.skip(position) descarta as (position-1) primeiras e toca a position-ésima.
			// (player.queue.shift não existe no shim; player.stop limparia a fila e pararia.)
			await player.skip(position, false).catch(() => {});
			
			let thing = new EmbedBuilder()
				.setColor(client.config.embedColor)
				.setDescription(`${emojiTag("success")} | Skipped to position ` + position);
			
			return interaction.editReply({ embeds: [thing] });
		} catch {
			if (position === 1) {
				player.skip(0, false).catch(() => {});
			}
			return interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(client.config.embedColor)
						.setDescription(`${emojiTag("success")} | Skipped to position ` + position),
				],
			});
		}
	});

module.exports = command;
