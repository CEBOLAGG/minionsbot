const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder, Colors, ChannelType, escapeMarkdown } = require("discord.js");
const { addToUserHistory, addManyToUserHistory } = require("../../util/mongodb");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
  .setName("play")
  .setDescription(
    "Searches and plays the requested song \nSupports: \nYoutube, Spotify, Deezer, Apple Music"
  )
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("What am I looking for?")
      .setAutocomplete(true)
      .setRequired(true)
  )
  .setRun(async (client, interaction, options) => {
    try {
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

      // Responder imediatamente para evitar timeout
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(client.config.embedColor)
            .setDescription(`${emojiTag("search")} **Searching...**`),
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

      let query = options.getString("query", true);
      
      // Armazenar requester para uso posterior
      client.setPlayerData(interaction.guild.id, "requester", interaction.user);
      
      let res;
      try {
        // Riffy usa manager.resolve() para buscar músicas
        res = await client.manager.resolve({ query, requester: interaction.user });
      } catch (err) {
        console.error("Search error:", err);
        res = { loadType: "error" };
      }

      // Riffy loadTypes: "track", "search", "playlist", "empty", "error"
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
        
        // Verificar se já está tocando antes de adicionar
        const shouldPlay = !player.playing && !player.paused;
        
        player.queue.add(track);

        // Salvar no histórico do usuário (MongoDB)
        try {
          const trackData = {
            title: track.info.title,
            author: track.info.author,
            uri: track.info.uri,
            duration: track.info.length,
            thumbnail: track.info.artworkUrl,
            addedAt: new Date(),
            addedBy: interaction.user.id
          };

          await addToUserHistory(interaction.user.id, trackData);
        } catch (error) {
          console.error("Error saving to user history:", error);
        }

        // Se não estava tocando, iniciar reprodução
        if (shouldPlay) {
          try {
            if (!player.connected) {
              await player.connect();
            }
            await player.play();
          } catch (error) {
            console.error("Error starting playback:", error);
            client.warn(`Error starting playback: ${error.message}`);
          }
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
                ? `\`LIVE \`${emojiTag("live")}`
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
        
        // Deletar mensagem após 20 segundos
        setTimeout(() => {
          interaction.deleteReply().catch(() => {});
        }, 20000);
      }

      if (res.loadType === "playlist") {
        // Verificar se já está tocando antes de adicionar
        const shouldPlay = !player.playing && !player.paused;
        
        for (const track of res.tracks) {
          player.queue.add(track);
        }

        // Salvar playlist no histórico (MongoDB)
        try {
          const tracksData = res.tracks.map(track => ({
              title: track.info.title,
              author: track.info.author,
              uri: track.info.uri,
              duration: track.info.length,
              thumbnail: track.info.artworkUrl,
            addedAt: new Date(),
              addedBy: interaction.user.id,
              fromPlaylist: res.playlistInfo?.name
          }));

          await addManyToUserHistory(interaction.user.id, tracksData);
        } catch (error) {
          console.error("Error saving playlist to user history:", error);
        }

        // Se não estava tocando, iniciar reprodução
        if (shouldPlay) {
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
              value: `\`${client.ms(res.tracks.reduce((acc, track) => acc + (track.info.length || 0), 0), {
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
        
        // Deletar mensagem após 20 segundos
        setTimeout(() => {
          interaction.deleteReply().catch(() => {});
        }, 20000);
      }
    } catch (error) {
      console.error("Play command error:", error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription("An error occurred while processing your request."),
            ],
          }).catch(() => {});
        } else {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription("An error occurred while processing your request."),
            ],
          }).catch(() => {});
        }
      } catch (e) {
        console.error("Error sending error message:", e);
      }
    }
  });

module.exports = command;
