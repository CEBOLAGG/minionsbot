const { EmbedBuilder, Colors } = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
  .setName("ping")
  .setDescription("View the bot's latency")
  .setRun(async (client, interaction, options) => {
    let msg = await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setDescription("🏓 | Fetching ping...")
          .setColor("#6F8FAF"),
      ],
    });

    let zap = emojiTag("zap");
    let green = emojiTag("green");
    let red = emojiTag("red");
    let yellow = emojiTag("yellow");

    var botState = zap;
    var apiState = zap;

    let apiPing = client.ws.ping;
    let botPing = Math.floor(msg.createdAt - interaction.createdAt);

    if (apiPing >= 40 && apiPing < 200) {
      apiState = green;
    } else if (apiPing >= 200 && apiPing < 400) {
      apiState = yellow;
    } else if (apiPing >= 400) {
      apiState = red;
    }

    if (botPing >= 40 && botPing < 200) {
      botState = green;
    } else if (botPing >= 200 && botPing < 400) {
      botState = yellow;
    } else if (botPing >= 400) {
      botState = red;
    }

    msg.delete();
    interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏓 | Pong!")
          .addFields(
            {
              name: "API Latency",
              value: `${apiState} \`${apiPing}ms\``,
              inline: true,
            },
            {
              name: "Bot Latency",
              value: `${botState} \`${botPing}ms\``,
              inline: true,
            }
          )
          .setColor(client.config.embedColor)
          .setFooter({
            text: `Requested by ${interaction.user.tag}`,
            iconURL: interaction.user.avatarURL(),
          }),
      ],
    });
  });

module.exports = command;
