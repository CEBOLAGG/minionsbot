const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const prettyMilliseconds = require("pretty-ms");

const command = new SlashCommand()
	.setName("save")
	.setDescription("Saves current song to your DM's")
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
		
		if (!player || !player.current) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("There is no music playing right now."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		const song = player.current;
		
		const sendtoDmEmbed = new EmbedBuilder()
			.setColor(client.config.embedColor)
			.setAuthor({
				name: "Saved track",
				iconURL: `${interaction.user.displayAvatarURL({ dynamic: true })}`,
			})
			.setDescription(
				`**Saved [${song.info.title}](${song.info.uri}) to your DM**`,
			)
			.addFields(
				{
					name: "Track Duration",
					value: `\`${prettyMilliseconds(song.info.length, { colonNotation: true })}\``,
					inline: true,
				},
				{
					name: "Track Author",
					value: `\`${song.info.author || 'Unknown'}\``,
					inline: true,
				},
				{
					name: "Requested Guild",
					value: `\`${interaction.guild}\``,
					inline: true,
				},
			);
		
		interaction.user.send({ embeds: [sendtoDmEmbed] });
		
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(
						"Please check your **DMs**. If you didn't receive any message from me please make sure your **DMs** are open",
					),
			],
			flags: MessageFlags.Ephemeral,
		});
	});

module.exports = command;
