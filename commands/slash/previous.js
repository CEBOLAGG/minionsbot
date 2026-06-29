const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("previous")
	.setDescription("Go back to the previous song.")
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
						.setDescription("There are no previous songs for this session."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}

		const previousSong = player.previous;
		const currentSong = player.current;
		const nextSong = player.queue.length > 0 ? player.queue[0] : null;

		if (!previousSong || 
			previousSong?.info?.identifier === currentSong?.info?.identifier || 
			previousSong?.info?.identifier === nextSong?.info?.identifier) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("There is no previous song in the queue."),
				],
			});
		}

		// Adicionar a música atual no início da fila e tocar a anterior
		if (currentSong) {
			player.queue.unshift(currentSong);
		}
		player.queue.unshift(previousSong);
		player.skip(0, false).catch(() => {}); // AVANÇA p/ a anterior (player.stop limparia a fila)

		interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("previous")} | Previous song: **${previousSong.info.title}**`),
			],
		});
	});

module.exports = command;
