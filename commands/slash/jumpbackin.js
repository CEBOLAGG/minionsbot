const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle, Colors, escapeMarkdown } = require("discord.js");
const { getUserHistory, clearUserHistory: clearUserHistoryDb } = require("../../util/mongodb");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
  .setName("jumpbackin")
  .setDescription("🎵 Smart recommendations based on your current music and recent styles")
  .setRun(async (client, interaction, options) => {
    try {
      // Verificar se há um player ativo
      const player = client.manager?.players?.get(interaction.guild.id);
      
      // Obter histórico do usuário do MongoDB
      const userId = interaction.user.id;
      const userHistory = await getUserHistory(userId);

      // Analisar música atual e estilos recentes
      const currentTrack = player?.current;
      const recentStyles = analyzeRecentStyles(userHistory);
      
      // Criar embed principal com análise de estilos
      const jumpBackEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor || "#5865F2")
        .setAuthor({ 
          name: "🎵 Jump back in", 
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
        })
        .setDescription("**Smart Recommendations based on your recent listening**\n" +
          "🎨 Select a style to continue the vibe\n" +
          "🎵 Click numbered buttons to replay tracks\n" +
          "🎛️ Use controls to manage playback")
        .setTimestamp();

      // Não mostrar música atual (removido conforme solicitado)

      // Adicionar estilos recentes detectados
      if (recentStyles.length > 0) {
        const stylesText = recentStyles.slice(0, 4).map(style => 
          `**${style.name}** (${style.count} tracks)`
        ).join(" • ");
        jumpBackEmbed.addFields("🎨 Recent Styles", stylesText, false);
      }

      // Pegar as últimas 5 músicas únicas do histórico
      const recentTracks = [];
      const seenTracks = new Set();
      
      for (let i = userHistory.length - 1; i >= 0 && recentTracks.length < 5; i--) {
        const track = userHistory[i];
        const trackId = `${track.title}_${track.author}`;
        
        if (!seenTracks.has(trackId)) {
          seenTracks.add(trackId);
          recentTracks.push(track);
        }
      }

      // Adicionar lista de músicas recentes (mais compacta)
      if (recentTracks.length > 0) {
        let tracksList = "";
        recentTracks.slice(0, 3).forEach((track, index) => { // Mostrar apenas 3 músicas na embed
          const shortTitle = track.title.length > 25 ? track.title.substring(0, 22) + "..." : track.title;
          const shortAuthor = track.author.length > 15 ? track.author.substring(0, 12) + "..." : track.author;
          tracksList += `**${index + 1}.** ${escapeMarkdown(shortTitle)} - ${escapeMarkdown(shortAuthor)}\n`;
        });
        jumpBackEmbed.addFields("📜 Recent Tracks", tracksList, false);
      }

      jumpBackEmbed.setFooter({ 
        text: `${userHistory.length} total tracks • ${recentStyles.length} styles detected`,
        iconURL: client.user.displayAvatarURL({ dynamic: true })
      });

      // Criar menu de seleção para estilos
      const styleMenu = new StringSelectMenuBuilder()
        .setCustomId("style_select")
        .setPlaceholder("� Continue queue with same style...")
        .setMinValues(1)
        .setMaxValues(1);

      // Adicionar opções de estilos
      recentStyles.slice(0, 10).forEach((style, index) => {
        styleMenu.addOptions({
          label: style.name,
          description: `${style.count} tracks in your history`,
          value: `style_${index}`,
          emoji: getStyleEmoji(style.name)
        });
      });

      // Botões de controle do player (com Clear History na primeira linha)
      const controlRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("clear_history")
            .setLabel("Clear History")
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojiFor("trash")),
          new ButtonBuilder()
            .setCustomId("add_music_modal")
            .setLabel("Add Music")
            .setStyle(ButtonStyle.Success)
            .setEmoji(emojiFor("plus")),
          new ButtonBuilder()
            .setCustomId("pause_resume")
            .setLabel(player?.paused ? "Resume" : "Pause")
            .setStyle(ButtonStyle.Primary)
            .setEmoji(player?.paused ? emojiFor("play") : emojiFor("pause"))
            .setDisabled(!player?.current),
          new ButtonBuilder()
            .setCustomId("stop_music")
            .setLabel("Stop")
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojiFor("stop"))
            .setDisabled(!player?.current)
        );

      // Menu para selecionar músicas específicas (voltando com dropdown)
      const trackMenu = new StringSelectMenuBuilder()
        .setCustomId("track_select")
        .setPlaceholder("🎵 Select a track to play...")
        .setMinValues(1)
        .setMaxValues(1);

      recentTracks.forEach((track, index) => {
        const duration = track.duration ? client.ms(track.duration, { colonNotation: true, secondsDecimalDigits: 0 }) : "🔴 LIVE";
        trackMenu.addOptions({
          label: track.title.length > 90 ? track.title.substring(0, 87) + "..." : track.title,
          description: `${track.author} • ${duration}`,
          value: `track_${index}`,
          emoji: "🎵"
        });
      });

      // Organizar componentes
      const components = [];
      
      // 1. Menu de estilos (se houver)
      if (recentStyles.length > 0) {
        components.push(new ActionRowBuilder().addComponents(styleMenu));
      }
      
      // 2. Menu de músicas (se houver)
      if (recentTracks.length > 0) {
        components.push(new ActionRowBuilder().addComponents(trackMenu));
      }
      
      // 3. Botões de controle do player (já inclui Clear History)
      components.push(controlRow);

      const reply = await interaction.reply({
        embeds: [jumpBackEmbed],
        components: components,
        fetchReply: true
      });

      // Collector para interações
      const collector = reply.createMessageComponentCollector({
        time: 300000 // 5 minutos
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: "❌ Only the command user can interact with this menu!",
            ephemeral: true
          });
        }

        // Lidar com modal
        if (i.customId === "add_music_modal") {
          await showAddMusicModal(i);
          return;
        }

        await i.deferUpdate();

        if (i.customId === "style_select") {
          const selectedIndex = parseInt(i.values[0].split("_")[1]);
          const selectedStyle = recentStyles[selectedIndex];
          await continueWithStyle(client, i, selectedStyle, userHistory);
        } 
        else if (i.customId === "track_select") {
          const selectedIndex = parseInt(i.values[0].split("_")[1]);
          const selectedTrack = recentTracks[selectedIndex];
          await playSelectedTrack(client, i, selectedTrack);
        }
        else if (i.customId === "pause_resume") {
          await handlePauseResume(client, i);
        }
        else if (i.customId === "stop_music") {
          await handleStopMusic(client, i);
        }
        else if (i.customId === "clear_history") {
          await clearUserHistory(client, i, userId);
        }
      });

      // Collector para modals
      const modalCollector = interaction.client.on('interactionCreate', async (modalInteraction) => {
        if (!modalInteraction.isModalSubmit()) return;
        if (modalInteraction.user.id !== interaction.user.id) return;
        
        if (modalInteraction.customId === 'add_music_modal') {
          await handleAddMusicModal(client, modalInteraction);
        }
      });

      collector.on("end", () => {
        // Desabilitar componentes quando o collector expirar
        const disabledComponents = components.map(row => {
          if (row.components) {
            row.components.forEach(component => component.setDisabled(true));
          }
          return row;
        });

        interaction.editReply({
          components: disabledComponents
        }).catch(() => {});
      });

    } catch (error) {
      console.error("Error in jumpbackin command:", error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("❌ Error")
        .setDescription("An error occurred while loading your music analysis.")
        .setFooter({ text: "Please try again later." });

      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errorEmbed], components: [] });
      } else {
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  });

// Função para analisar estilos musicais recentes
function analyzeRecentStyles(userHistory) {
  const styleCount = {};
  
  // Analisar últimas 20 músicas
  const recentTracks = userHistory.slice(-20);
  
  recentTracks.forEach(track => {
    const style = detectMusicStyle(track.title, track.author);
    styleCount[style] = (styleCount[style] || 0) + 1;
  });

  // Ordenar por popularidade
  return Object.entries(styleCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .filter(style => style.count > 1); // Apenas estilos com mais de 1 música
}

// Função para detectar estilo musical
function detectMusicStyle(title, author) {
  const text = `${title} ${author}`.toLowerCase();
  
  // Brazilian Funk
  if (text.includes('mc ') || text.includes('funk') || text.includes('baile') || 
      /mc\s+\w+/i.test(text) || text.includes('putaria') || text.includes('beat')) {
    return '🇧🇷 Brazilian Funk';
  }
  
  // Brazilian Trap
  if ((text.includes('trap') && (text.includes('br') || text.includes('brasil'))) ||
      text.includes('veigh') || text.includes('teto') || text.includes('cabelinho')) {
    return '🇧🇷 Brazilian Trap';
  }
  
  // Trap
  if (text.includes('trap') || text.includes('travis scott') || text.includes('future') ||
      text.includes('lil ') || text.includes('young ') || text.includes('21 savage')) {
    return '🎵 Trap';
  }
  
  // Rage Trap
  if (text.includes('playboi carti') || text.includes('carti') || text.includes('yeat') ||
      text.includes('ken carson') || text.includes('destroy lonely') || text.includes('rage')) {
    return '🔥 Rage Trap';
  }
  
  // Hip Hop/Rap
  if (text.includes('rap') || text.includes('hip hop') || text.includes('kendrick') ||
      text.includes('drake') || text.includes('j cole') || text.includes('eminem')) {
    return '🎤 Hip Hop';
  }
  
  // Rock
  if (text.includes('rock') || text.includes('metal') || text.includes('punk') ||
      text.includes('alternative') || text.includes('indie')) {
    return '🎸 Rock';
  }
  
  // Pop
  if (text.includes('pop') || text.includes('taylor swift') || text.includes('ariana') ||
      text.includes('dua lipa') || text.includes('billie eilish')) {
    return '🎹 Pop';
  }
  
  // Electronic
  if (text.includes('electronic') || text.includes('edm') || text.includes('house') ||
      text.includes('techno') || text.includes('dubstep') || text.includes('remix')) {
    return '🎵 Electronic';
  }
  
  return '🎶 Other';
}

// Função para obter emoji do estilo
function getStyleEmoji(style) {
  const emojis = {
    '🇧🇷 Brazilian Funk': '🇧🇷',
    '🇧🇷 Brazilian Trap': '🔥',
    '🎵 Trap': '🎵',
    '🔥 Rage Trap': '🔥',
    '🎤 Hip Hop': '🎤',
    '🎸 Rock': '🎸',
    '🎹 Pop': '🎹',
    '🎵 Electronic': '⚡',
    '🎶 Other': '🎶'
  };
  
  return emojis[style] || '🎶';
}

// Função para mostrar modal de adicionar música
async function showAddMusicModal(interaction) {
  const modal = new Modal()
    .setCustomId('add_music_modal')
    .setTitle('🎵 Add Music to Queue');

  const musicInput = new TextInputComponent()
    .setCustomId('music_query')
    .setLabel('Song name, artist or URL')
    .setStyle('SHORT')
    .setPlaceholder('Enter song name, artist, YouTube/Spotify URL...')
    .setRequired(true)
    .setMaxLength(200);

  const firstActionRow = new ActionRowBuilder().addComponents(musicInput);
  modal.addComponents(firstActionRow);

  await interaction.showModal(modal);
}

// Função para lidar com o modal de adicionar música
async function handleAddMusicModal(client, interaction) {
  try {
    const query = interaction.fields.getTextInputValue('music_query');
    
    let channel = await client.getChannel(client, interaction);
    if (!channel) {
      return interaction.reply({
        content: "❌ You need to be in a voice channel to play music!",
        ephemeral: true
      });
    }

    let node = await client.getLavalink(client);
    if (!node) {
      return interaction.reply({
        embeds: [client.ErrorEmbed("Lavalink node is not connected")],
        ephemeral: true
      });
    }

    let player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      player = client.createPlayer(interaction.channel, channel);
    }

    if (!player.connected) {
      player.connect();
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setDescription(`${emojiTag("search")} **Searching for:** \`` + query + "`")
      ]
    });

    let res;
    try {
      res = await client.manager.resolve({ query, requester: interaction.user });
    } catch (err) {
      client.error(err);
      res = { loadType: "error" };
    }

    if (res.loadType === "error" || res.loadType === "empty") {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription("❌ No results found for: `" + query + "`")
        ]
      });
    }

    if (res.loadType === "track" || res.loadType === "search") {
      const track = res.tracks[0];
      player.queue.add(track);

      if (!player.playing && !player.paused && player.queue.length === 0) {
        player.play();
      }

      const addEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor || "#00FF00")
        .setAuthor({ name: "✅ Added to Queue", iconURL: client.config.iconURL })
        .setDescription(`**[${escapeMarkdown(track.info.title)}](${track.info.uri})**`)
        .addFields(
          {
            name: "👤 Artist",
            value: escapeMarkdown(track.info.author || 'Unknown'),
            inline: true
          },
          {
            name: "⏱️ Duration",
            value: track.info.isStream ? `${emojiTag("live")} \`LIVE\`` : `\`${client.ms(track.info.length, { colonNotation: true, secondsDecimalDigits: 0 })}\``,
            inline: true
          },
          {
            name: "📍 Position",
            value: player.queue.length > 0 ? `${player.queue.length} in queue` : "Now playing",
            inline: true
          }
        );

      if (track.info.artworkUrl) {
        addEmbed.setThumbnail(track.info.artworkUrl);
      }

      return interaction.editReply({ embeds: [addEmbed] });
    }
  } catch (error) {
    console.error("Error in add music modal:", error);
    return interaction.reply({
      content: "❌ An error occurred while adding the music.",
      ephemeral: true
    });
  }
}

// Função para pausar/resumir música
async function handlePauseResume(client, interaction) {
  try {
    const player = client.manager?.players?.get(interaction.guild.id);
    
    if (!player || !player.current) {
      return interaction.followUp({
        content: "❌ No music is currently playing!",
        ephemeral: true
      });
    }

    if (player.paused) {
      player.pause(false);
      return interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor("#00FF00")
            .setDescription(`${emojiTag("play")} **Resumed** the current track!`)
        ]
      });
    } else {
      player.pause(true);
      return interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor("#FFA500")
            .setDescription(`${emojiTag("pause")} **Paused** the current track!`)
        ]
      });
    }
  } catch (error) {
    console.error("Error in pause/resume:", error);
    return interaction.followUp({
      content: "❌ An error occurred while pausing/resuming.",
      ephemeral: true
    });
  }
}

// Função para parar música
async function handleStopMusic(client, interaction) {
  try {
    const player = client.manager?.players?.get(interaction.guild.id);
    
    if (!player || !player.current) {
      return interaction.followUp({
        content: "❌ No music is currently playing!",
        ephemeral: true
      });
    }

    const currentTrack = player.current;
    player.destroy();
    client.clearPlayerData(interaction.guild.id);

    return interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setColor("#FF0000")
          .setAuthor({ name: `${emojiTag("stop")} Music Stopped`, iconURL: client.config.iconURL })
          .setDescription(`Stopped playing **${escapeMarkdown(currentTrack.info.title)}**\n\nDisconnected from voice channel.`)
          .setFooter({ text: "Use /play to start playing music again!" })
      ]
    });
  } catch (error) {
    console.error("Error stopping music:", error);
    return interaction.followUp({
      content: "❌ An error occurred while stopping the music.",
      ephemeral: true
    });
  }
}

// Função para tocar uma música selecionada
async function playSelectedTrack(client, interaction, track) {
  try {
    let channel = await client.getChannel(client, interaction);
    if (!channel) {
      return interaction.followUp({
        content: "❌ You need to be in a voice channel to play music!",
        ephemeral: true
      });
    }

    let node = await client.getLavalink(client);
    if (!node) {
      return interaction.followUp({
        embeds: [client.ErrorEmbed("Lavalink node is not connected")],
        ephemeral: true
      });
    }

    let player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      player = client.createPlayer(interaction.channel, channel);
    }

    if (!player.connected) {
      player.connect();
    }

    let res;
    try {
      res = await client.manager.resolve({ query: track.uri || track.title, requester: interaction.user });
    } catch {
      res = { loadType: "error" };
    }

    if (res.loadType === "error" || res.loadType === "empty") {
      return interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setDescription(`❌ Could not load **${escapeMarkdown(track.title)}**`)
        ],
        ephemeral: true
      });
    }

    if (res.loadType === "track" || res.loadType === "search") {
      const foundTrack = res.tracks[0];
      player.queue.add(foundTrack);

      if (!player.playing && !player.paused && player.queue.length === 0) {
        player.play();
      }

      const style = detectMusicStyle(track.title, track.author);
      const playEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor || "#00FF00")
        .setAuthor({ name: "🎵 Jump Back In - Playing", iconURL: client.config.iconURL })
        .setDescription(`${emojiTag("play")} **[${escapeMarkdown(foundTrack.info.title)}](${foundTrack.info.uri})**`)
        .addFields(
          {
            name: "👤 Artist",
            value: escapeMarkdown(track.author || 'Unknown'),
            inline: true
          },
          {
            name: "⏱️ Duration", 
            value: foundTrack.info.isStream ? `${emojiTag("live")} \`LIVE\`` : `\`${client.ms(foundTrack.info.length, { colonNotation: true, secondsDecimalDigits: 0 })}\``,
            inline: true
          },
          {
            name: "🏷️ Style",
            value: style,
            inline: true
          },
          {
            name: "📍 Queue Position",
            value: player.queue.length > 0 ? `${player.queue.length} in queue` : "Now playing",
            inline: true
          }
        )
        .setFooter({ text: "From your listening history" });

      if (foundTrack.info.artworkUrl) {
        playEmbed.setThumbnail(foundTrack.info.artworkUrl);
      }

      return interaction.followUp({ embeds: [playEmbed] });
    }
  } catch (error) {
    console.error("Error playing selected track:", error);
    return interaction.followUp({
      content: "❌ An error occurred while trying to play this track.",
      ephemeral: true
    });
  }
}

// Função para continuar com o mesmo estilo (buscar músicas novas)
async function continueWithStyle(client, interaction, selectedStyle, userHistory) {
  try {
    let channel = await client.getChannel(client, interaction);
    if (!channel) {
      return interaction.followUp({
        content: "❌ You need to be in a voice channel to play music!",
        ephemeral: true
      });
    }

    let node = await client.getLavalink(client);
    if (!node) {
      return interaction.followUp({
        embeds: [client.ErrorEmbed("Lavalink node is not connected")],
        ephemeral: true
      });
    }

    let player = client.manager.players.get(interaction.guild.id);
    if (!player) {
      player = client.createPlayer(interaction.channel, channel);
    }

    if (!player.connected) {
      player.connect();
    }

    // Buscar músicas novas baseadas no estilo selecionado
    const styleQueries = getStyleSearchQueries(selectedStyle.name);
    let addedCount = 0;

    for (const query of styleQueries.slice(0, 3)) {
      try {
        let res = await client.manager.resolve({ query, requester: interaction.user });
        
        if (res.loadType === "track" || res.loadType === "search") {
          const track = res.tracks[0];
          // Verificar se a música já não está no histórico
          const trackExists = userHistory.some(historyTrack => 
            historyTrack.title.toLowerCase() === track.info.title.toLowerCase() &&
            historyTrack.author.toLowerCase() === (track.info.author || '').toLowerCase()
          );

          if (!trackExists) {
            player.queue.add(track);
            addedCount++;
          }
        }
      } catch (error) {
        console.error(`Error searching for ${query}:`, error);
      }
    }

    // Se não encontrou músicas novas, buscar mais genéricas do estilo
    if (addedCount === 0) {
      const genericQuery = getGenericStyleQuery(selectedStyle.name);
      try {
        let res = await client.manager.resolve({ query: genericQuery, requester: interaction.user });
        
        if (res.loadType === "search" && res.tracks.length > 0) {
          // Adicionar as primeiras 2 músicas que não estão no histórico
          for (const track of res.tracks.slice(0, 2)) {
            const trackExists = userHistory.some(historyTrack => 
              historyTrack.title.toLowerCase() === track.info.title.toLowerCase() &&
              historyTrack.author.toLowerCase() === (track.info.author || '').toLowerCase()
            );

            if (!trackExists) {
              player.queue.add(track);
              addedCount++;
              if (addedCount >= 2) break;
            }
          }
        }
      } catch (error) {
        console.error(`Error with generic search:`, error);
      }
    }

    if (!player.playing && !player.paused && addedCount > 0) {
      player.play();
    }

    const styleEmbed = new EmbedBuilder()
      .setColor(client.config.embedColor || "#9B59B6")
      .setAuthor({ name: `🎨 Discovering ${selectedStyle.name}`, iconURL: client.config.iconURL })
      .setDescription(addedCount > 0 ? 
        `🎵 Added **${addedCount}** new ${selectedStyle.name} tracks to expand your playlist!` :
        `❌ No new ${selectedStyle.name} tracks found. Try playing more music to improve recommendations.`)
      .addFields(`${emojiTag("search")} Style Search`, `Looking for fresh **${selectedStyle.name}** music based on your taste`, false)
      .setFooter({ text: "Discovering new music in your favorite style!" });

    return interaction.followUp({ embeds: [styleEmbed] });
  } catch (error) {
    console.error("Error continuing with style:", error);
    return interaction.followUp({
      content: "❌ An error occurred while searching for new songs of this style.",
      ephemeral: true
    });
  }
}

// Função para obter consultas de busca por estilo
function getStyleSearchQueries(styleName) {
  const styleQueries = {
    '🇧🇷 Brazilian Funk': [
      'MC Ryan SP funk 2024',
      'MC Hariel novo funk',
      'MC Poze funk pesado',
      'funk brasileiro 2024',
      'baile funk novo'
    ],
    '🇧🇷 Brazilian Trap': [
      'Veigh trap brasileiro',
      'Teto novo trap',
      'MC Cabelinho trap',
      'trap nacional 2024',
      'trap brasil novo'
    ],
    '🎵 Trap': [
      'Travis Scott new song',
      'Future trap 2024',
      'Lil Baby new track',
      'trap music 2024',
      'new trap songs'
    ],
    '🔥 Rage Trap': [
      'Playboi Carti rage',
      'Yeat new song',
      'Ken Carson rage',
      'rage trap 2024',
      'new rage music'
    ],
    '🎤 Hip Hop': [
      'new hip hop 2024',
      'rap music new',
      'hip hop songs',
      'latest rap',
      'new rap tracks'
    ],
    '🎸 Rock': [
      'new rock songs 2024',
      'rock music new',
      'alternative rock',
      'indie rock new',
      'rock hits'
    ],
    '🎹 Pop': [
      'new pop songs 2024',
      'pop music hits',
      'latest pop',
      'pop songs new',
      'trending pop'
    ],
    '🎵 Electronic': [
      'new electronic music',
      'EDM 2024',
      'house music new',
      'electronic songs',
      'dance music'
    ]
  };

  return styleQueries[styleName] || ['new music 2024'];
}

// Função para obter consulta genérica por estilo
function getGenericStyleQuery(styleName) {
  const genericQueries = {
    '🇧🇷 Brazilian Funk': 'funk brasileiro',
    '🇧🇷 Brazilian Trap': 'trap brasileiro',
    '🎵 Trap': 'trap music',
    '🔥 Rage Trap': 'rage trap',
    '🎤 Hip Hop': 'hip hop',
    '🎸 Rock': 'rock music',
    '🎹 Pop': 'pop music',
    '🎵 Electronic': 'electronic music'
  };

  return genericQueries[styleName] || 'music';
}

// Função para limpar o histórico do usuário
async function clearUserHistory(client, interaction, userId) {
  try {
    await clearUserHistoryDb(userId);

    const clearEmbed = new EmbedBuilder()
      .setColor("#FFA500")
      .setAuthor({ name: `${emojiTag("trash")} History Cleared`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setDescription("✅ Your listening history has been cleared!\n\nStart playing music to build new recommendations.")
      .setFooter({ text: "Your fresh start begins now!" });

    return interaction.followUp({ embeds: [clearEmbed] });
  } catch (error) {
    console.error("Error clearing history:", error);
    return interaction.followUp({
      content: "❌ An error occurred while clearing your history.",
      ephemeral: true
    });
  }
}

module.exports = command;
