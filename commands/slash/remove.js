const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");

const command = new SlashCommand()
	.setName("remove")
	.setDescription("Remove track you don't want from queue")
	.addNumberOption((option) =>
		option
			.setName("number")
			.setDescription("Enter track number.")
			.setRequired(true),
	)
	
	.setRun(async (client, interaction) => {
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
						.setDescription("There are no songs to remove."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		await interaction.deferReply();
		
		const position = Number(args) - 1;
		if (position >= player.queue.length) {
			let thing = new EmbedBuilder()
				.setColor(client.config.embedColor)
				.setDescription(`Current queue has only **${player.queue.length}** track(s)`);
			return interaction.editReply({ embeds: [thing] });
		}
		
		player.queue.remove(position);
		
		const number = position + 1;
		let removeEmbed = new EmbedBuilder()
			.setColor(client.config.embedColor)
			.setDescription(`Removed track number **${number}** from queue`);
		return interaction.editReply({ embeds: [removeEmbed] });
	});

module.exports = command;
