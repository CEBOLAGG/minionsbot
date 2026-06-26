const { ContextMenuCommandBuilder, ApplicationCommandType } = require("discord.js");
const { EmbedBuilder, Colors, ChannelType, escapeMarkdown } = require("discord.js");

module.exports = {
  command: new ContextMenuCommandBuilder().setName("Play Song").setType(ApplicationCommandType.Message),

  /**
   * This function will handle context menu interaction
   * @param {import("../lib/DiscordMusicBot")} client
   * @param {import("discord.js").MessageContextMenuCommandInteraction} interaction
   */
  run: async (client, interaction, options) => {
    let channel = await client.getChannel(client, interaction);
    if (!channel) {
      return;
    }

    let node = await client.getLavalink(client);
    if (!node) {
      return interaction.reply({
        embeds: [client.ErrorEmbed("Lavalink node is not connected")],
      });
    }

    // Responder imediatamente
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setDescription(":mag_right: **Searching...**"),
      ],
    });

    let player = client.manager.players.get(interaction.guild.id);
    
    if (!player) {
      player = client.createPlayer(interaction.channel, channel);
    }

    if (!player.connected) {
      player.connect();
    }

    if (channel.type == ChannelType.GuildStageVoice) {
      setTimeout(() => {
        if (interaction.guild.members.me.voice.suppress == true) {
          try {
            interaction.guild.members.me.voice.setSuppressed(false);
          } catch (e) {
            interaction.guild.members.me.voice.setRequestToSpeak(true);
          }
        }
      }, 2000);
    }

    const query =
      interaction.channel.messages.cache.get(interaction.targetId)?.content ??
      (await interaction.channel.messages.fetch(interaction.targetId))?.content;
      
    if (!query) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription("Could not get the message content"),
        ],
      });
    }

    let res;
    try {
      res = await client.manager.resolve({ query, requester: interaction.user });
    } catch (err) {
      client.error(err);
      res = { loadType: "error" };
    }

    if (res.loadType === "error" || res.loadType === "empty" || !res.tracks || res.tracks.length === 0) {
      if (!player.current && player.queue.length === 0) {
        player.destroy();
        client.clearPlayerData(interaction.guild.id);
      }
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription(res.loadType === "error" ? "There was an error while searching" : "No results were found"),
        ],
      }).catch(() => {});
      return;
    }

    if (res.loadType === "track" || res.loadType === "search") {
      const track = res.tracks[0];
      player.queue.add(track);

      if (!player.playing && !player.paused && player.queue.length === 0) {
        player.play();
      }
      
      var title = escapeMarkdown(track.info.title);
      title = title.replace(/\]/g, "");
      title = title.replace(/\[/g, "");
      
      let addQueueEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor)
        .setAuthor({ name: "Added to queue", iconURL: client.config.iconURL })
        .setDescription(`[${title}](${track.info.uri})` || "No Title")
        .setURL(track.info.uri)
        .addFields(
          {
            name: "Added by",
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
          {
            name: "Duration",
            value: track.info.isStream
              ? `\`LIVE 🔴 \``
              : `\`${client.ms(track.info.length, {
                  colonNotation: true,
                  secondsDecimalDigits: 0,
                })}\``,
            inline: true,
          }
        );

      if (track.info.artworkUrl) {
        addQueueEmbed.setThumbnail(track.info.artworkUrl);
      }

      if (player.queue.length > 0) {
        addQueueEmbed.addFields({
          name: "Position in queue",
          value: `${player.queue.length}`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [addQueueEmbed] }).catch(() => {});
      
      setTimeout(() => {
        interaction.deleteReply().catch(() => {});
      }, 20000);
    }

    if (res.loadType === "playlist") {
      for (const track of res.tracks) {
        player.queue.add(track);
      }

      if (!player.playing && !player.paused) {
        player.play();
      }

      let playlistEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor)
        .setAuthor({
          name: "Playlist added to queue",
          iconURL: client.config.iconURL,
        })
        .setDescription(`[${res.playlistInfo?.name || "Playlist"}](${query})`)
        .addFields(
          {
            name: "Enqueued",
            value: `\`${res.tracks.length}\` songs`,
            inline: true,
          },
          {
            name: "Playlist duration",
            value: `\`${client.ms(res.tracks.reduce((acc, t) => acc + (t.info.length || 0), 0), {
              colonNotation: true,
              secondsDecimalDigits: 0,
            })}\``,
            inline: true,
          }
        );

      if (res.tracks[0]?.info?.artworkUrl) {
        playlistEmbed.setThumbnail(res.tracks[0].info.artworkUrl);
      }

      await interaction.editReply({ embeds: [playlistEmbed] }).catch(() => {});
      
      setTimeout(() => {
        interaction.deleteReply().catch(() => {});
      }, 20000);
    }
  },
};
