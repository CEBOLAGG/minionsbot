const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder, Colors } = require("discord.js");

const command = new SlashCommand()
	.setName("stop")
	.setDescription("Stops whatever the bot is playing and leaves the voice channel\n(This command will clear the queue)")
	
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
						.setDescription("I'm not in a channel."),
				],
				ephemeral: true,
			});
		}
		
		const twentyFourSeven = client.getPlayerData(interaction.guild.id, "twentyFourSeven");
		
		if (twentyFourSeven) {
			player.queue.clear();
			player.stop();
			client.setPlayerData(interaction.guild.id, "autoQueue", false);
		} else {
			player.destroy();
			client.clearPlayerData(interaction.guild.id);
		}
		
		interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`:wave: | **Bye Bye!**`),
			],
		});
	});

module.exports = command;
