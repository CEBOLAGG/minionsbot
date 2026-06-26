const colors = require("colors");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");

const command = new SlashCommand()
  .setName("autopause")
  .setDescription("Automatically pause when everyone leaves the voice channel (toggle)")
  .setRun(async (client, interaction) => {
    let channel = await client.getChannel(client, interaction);
    if (!channel) return;

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
            .setDescription("There's nothing playing in the queue"),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    let autoPauseEmbed = new EmbedBuilder().setColor(client.config.embedColor);
		const autoPause = client.getPlayerData(interaction.guild.id, "autoPause");
		client.setPlayerData(interaction.guild.id, "requester", interaction.guild.members.me);

    if (!autoPause || autoPause === false) {
			client.setPlayerData(interaction.guild.id, "autoPause", true);
    } else {
			client.setPlayerData(interaction.guild.id, "autoPause", false);
    }
		
    autoPauseEmbed
			.setDescription(`**Auto Pause is** \`${!autoPause ? "ON" : "OFF"}\``)
			.setFooter({
			  text: `The player will ${!autoPause ? "now be automatically" : "no longer be"} paused when everyone leaves the voice channel.`
			});
		
    client.warn(
			`Player: ${interaction.guild.id} | [${colors.blue("AUTOPAUSE")}] has been [${colors.blue(
				!autoPause ? "ENABLED" : "DISABLED"
			)}] in ${client.guilds.cache.get(interaction.guild.id)?.name || "a guild"}`
    );

    return interaction.reply({ embeds: [autoPauseEmbed] });
  });

module.exports = command;
