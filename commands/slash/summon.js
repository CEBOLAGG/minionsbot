const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("summon")
	.setDescription("Summons the bot to the channel.")
	.setRun(async (client, interaction, options) => {
		let channel = await client.getChannel(client, interaction);
		if (!interaction.member.voice.channel) {
			const joinEmbed = new EmbedBuilder()
				.setColor(client.config.embedColor)
				.setDescription(`${emojiTag("error")} | **You must be in a voice channel to use this command.**`);
			return interaction.reply({ embeds: [joinEmbed], flags: MessageFlags.Ephemeral });
		}
		
		let player = client.manager.players.get(interaction.guild.id);
		if (!player) {
			player = client.createPlayer(interaction.channel, channel);
			player.connect();
		}
		
		if (channel.id !== player.voiceChannel) {
			player.setVoiceChannel(channel.id);
			player.connect();
		}
		
		interaction.reply({
			embeds: [
				client.Embed(`${emojiTag("success")} | **Successfully joined <#${channel.id}>!**`),
			],
		});
	});

module.exports = command;
