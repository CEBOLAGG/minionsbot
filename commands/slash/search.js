const SlashCommand = require("../../lib/SlashCommand");
const prettyMilliseconds = require("pretty-ms");
const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Colors,
} = require("discord.js");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
  .setName("search")
  .setDescription("Search for a song")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("The song to search for")
      .setRequired(true)
  )
  .setRun(async (client, interaction, options) => {
    let channel = await client.getChannel(client, interaction);
    if (!channel) {
      return;
    }

    let node = await client.getLavalink(client);
    if (!node) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription("Lavalink node is not connected"),
        ],
      });
    }

    await interaction.deferReply().catch(() => {});

    let player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      player = client.createPlayer(interaction.channel, channel);
    }

    if (!player.connected) {
      player.connect();
    }

    const search = interaction.options.getString("query");
    let res;

    try {
      res = await client.manager.resolve({ query: search, requester: interaction.user });
      if (res.loadType === "error") {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setDescription("An error occurred while searching for the song")
              .setColor(Colors.Red),
          ],
        });
      }
    } catch (err) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: "An error occurred while searching for the song" })
            .setColor(Colors.Red),
        ],
      });
    }

    if (res.loadType === "empty" || !res.tracks || res.tracks.length === 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setDescription(`No results found for \`${search}\``)
            .setColor(Colors.Red),
        ],
      });
    } else {
      let max = 10;
      if (res.tracks.length < max) {
        max = res.tracks.length;
      }

      let resultFromSearch = [];

      res.tracks.slice(0, max).map((track) => {
        resultFromSearch.push({
          label: `${track.info.title}`.substring(0, 100),
          value: `${track.info.uri}`,
          description: track.info.isStream
            ? `LIVE`
            : `${prettyMilliseconds(track.info.length, {
                secondsDecimalDigits: 0,
              })} - ${track.info.author}`.substring(0, 100),
        });
      });

      const menus = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("select")
          .setPlaceholder("Select a song")
          .addOptions(resultFromSearch)
      );

      let choosenTracks = await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setDescription(
              `Here are some of the results I found for \`${search}\`. Please select track within \`30 seconds\``
            ),
        ],
        components: [menus],
      });
      const filter = (button) => button.user.id === interaction.user.id;

      const tracksCollector = choosenTracks.createMessageComponentCollector({
        filter,
        time: 30000,
      });
      
      tracksCollector.on("collect", async (i) => {
        if (i.isStringSelectMenu()) {
          await i.deferUpdate();
          let uriFromCollector = i.values[0];
          let trackForPlay;

          trackForPlay = await client.manager.resolve({
            query: uriFromCollector,
            requester: interaction.user
          });
          
          if (trackForPlay.tracks && trackForPlay.tracks.length > 0) {
            player.queue.add(trackForPlay.tracks[0]);
            if (!player.playing && !player.paused && player.queue.length === 0) {
              player.play();
            }
            
            const selectedTrack = trackForPlay.tracks[0];
            const thumbnail = selectedTrack.info.artworkUrl;
            const hasValidThumbnail = thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('http');
            
            const embed = new EmbedBuilder()
                  .setAuthor({
                    name: "Added to queue",
                    iconURL: client.config.iconURL,
                  })
                  .setURL(selectedTrack.info.uri)
                  .setDescription(
                    `[${selectedTrack.info.title}](${selectedTrack.info.uri})` || "No Title"
              );
            
            if (hasValidThumbnail) {
              embed.setThumbnail(thumbnail);
            }
            
            embed.addFields(
                    {
                      name: "Added by",
                      value: `<@${interaction.user.id}>`,
                      inline: true,
                    },
                    {
                      name: "Duration",
                      value: selectedTrack.info.isStream
                        ? `\`LIVE \`${emojiTag("live")}`
                        : `\`${client.ms(selectedTrack.info.length, {
                            colonNotation: true,
                          })}\``,
                      inline: true,
                    }
            ).setColor(client.config.embedColor);
            
            i.editReply({
              content: null,
              embeds: [embed],
              components: [],
            });
          }
        }
      });
      
      tracksCollector.on("end", async (i) => {
        if (i.size == 0) {
          choosenTracks.edit({
            content: null,
            embeds: [
              new EmbedBuilder()
                .setDescription(
                  `No track selected. You took too long to select a track.`
                )
                .setColor(client.config.embedColor),
            ],
            components: [],
          });
        }
      });
    }
  });

module.exports = command;
