const colors = require("colors");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");

const command = new SlashCommand()
	.setName("247")
	.setDescription("Prevents the bot from ever disconnecting from a VC (toggle)")
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
						.setDescription("There's nothing to play 24/7."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		let twentyFourSevenEmbed = new EmbedBuilder().setColor(client.config.embedColor);
		const twentyFourSeven = client.getPlayerData(interaction.guild.id, "twentyFourSeven");
		
		if (!twentyFourSeven || twentyFourSeven === false) {
			client.setPlayerData(interaction.guild.id, "twentyFourSeven", true);
		} else {
			client.setPlayerData(interaction.guild.id, "twentyFourSeven", false);
		}
		
		twentyFourSevenEmbed
		  .setDescription(`**24/7 mode is** \`${!twentyFourSeven ? "ON" : "OFF"}\``)
		  .setFooter({
		    text: `The bot will ${!twentyFourSeven ? "now" : "no longer"} stay connected to the voice channel 24/7.`
      });
		
		client.warn(
			`Player: ${interaction.guild.id} | [${colors.blue("24/7")}] has been [${colors.blue(
				!twentyFourSeven ? "ENABLED" : "DISABLED"
			)}] in ${client.guilds.cache.get(interaction.guild.id)?.name || "a guild"}`
		);
		
		if (!player.playing && player.queue.length === 0 && twentyFourSeven) {
			player.destroy();
			client.clearPlayerData(interaction.guild.id);
		}
		
		return interaction.reply({ embeds: [twentyFourSevenEmbed] });
	});

module.exports = command;
