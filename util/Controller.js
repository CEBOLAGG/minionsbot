const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, Colors, escapeMarkdown, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { emojiFor, emojiTag } = require("../lib/emojis");

/**
 *
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {import("discord.js").ButtonInteraction} interaction
 */
module.exports = async (client, interaction) => {
	const guildId = interaction.customId.split(":")[1];
	let guild = client.guilds.cache.get(guildId);
	let property = interaction.customId.split(":")[2];
	
	// Usar o guild ID da interação se o do botão estiver errado
	const actualGuildId = guildId || interaction.guild?.id;
	
	// Obter o player
	let player = null;
	if (client.manager && client.manager.players) {
		player = client.manager.players.get(actualGuildId);
	}

	// if (!player) {
	// 	console.log(`[Controller] No player found! Sending error message...`);
	// 	try {
	// 		await interaction.reply({
	// 			embeds: [
	// 				client.Embed("❌ | **There is no player to control in this server.**"),
	// 			],
	// 			ephemeral: true
	// 		});
	// 		console.log(`[Controller] Error message sent!`);
	// 	} catch (e) {
	// 		console.log(`[Controller] Failed to send error: ${e.message}`);
	// 	}
	// 	setTimeout(() => {
	// 		interaction.deleteReply().catch(() => {});
	// 	}, 5000);
	// 	return;
	// }
	
	if (!interaction.member.voice.channel) {
		const joinEmbed = new EmbedBuilder()
			.setColor(client.config.embedColor)
			.setDescription(`${emojiTag("error")} | **You must be in a voice channel to use this action!**`);
		return interaction.reply({ embeds: [joinEmbed], ephemeral: true });
	}

	if (
		interaction.guild.members.me.voice.channel &&
		!interaction.guild.members.me.voice.channel.equals(interaction.member.voice.channel)
	) {
		const sameEmbed = new EmbedBuilder()
			.setColor(client.config.embedColor)
			.setDescription(`${emojiTag("error")} | **You must be in the same voice channel as me to use this action!**`);
		return await interaction.reply({ embeds: [sameEmbed], ephemeral: true });
	}

	if (property === "Stop") {
		player.queue.clear();
		player.stop();
		client.setPlayerData(guildId, "autoQueue", false);
		client.warn(`Player: ${guildId} | Successfully stopped the player`);
		
		// Deletar a mensagem do Now Playing (que contém os botões)
		client.setNowPlayingMessage(guildId, null);
		
		const msg = await interaction.channel.send({
			embeds: [
				client.Embed(`${emojiTag("stop")} | **Successfully stopped the player**`),
			],
		});
		setTimeout(() => {
			msg.delete().catch(() => {});
		}, 5000);

		// Apenas fazer deferUpdate para evitar erro de interação
		return interaction.deferUpdate().catch(() => {});
	}

	if (property === "Replay") {
		const previousSong = player.previous;
		const currentSong = player.current || player.queue?.current;
		const nextSong = player.queue.length > 0 ? player.queue[0] : null;
		
		if (!previousSong || 
			previousSong?.info?.identifier === currentSong?.info?.identifier || 
			previousSong?.info?.identifier === nextSong?.info?.identifier) {
			return interaction.reply({
				ephemeral: true,
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription(`There is no previous song played.`),
				],
			});
		}
		
		if (currentSong) {
			player.queue.unshift(currentSong);
		}
		player.queue.unshift(previousSong);
		// player.skip() AVANÇA para a faixa que acabamos de pôr no início (a anterior).
		// player.stop() (=stopPlaying no shim) limparia a fila e pararia.
		await player.skip(0, false).catch(() => {});
		return interaction.deferUpdate();
	}

	if (property === "PlayAndPause") {
		const currentSong = player.current || player.queue?.current;
		if (!player || (!player.playing && player.queue.length === 0 && !currentSong)) {
			const msg = await interaction.channel.send({
				ephemeral: true,
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("There is no song playing right now."),
				],
			});
			setTimeout(() => {
				msg.delete();
			}, 5000);
			return interaction.deferUpdate();
		} else {
			if (player.paused) {
				player.pause(false);
			} else {
				player.pause(true);
			}
			client.warn(`Player: ${guildId} | Successfully ${player.paused ? "paused" : "resumed"} the player`);

			const showFilters = client.getPlayerData(guildId, "showFilters") || false;
			const showVolume = client.getPlayerData(guildId, "showVolume") || false;
			const useComponentsV2 = client.getPlayerData(guildId, "useComponentsV2");
			const currentPosition = client.getPlayerData(guildId, "trackStartTime") 
				? Date.now() - client.getPlayerData(guildId, "trackStartTime") 
				: 0;
			
			if (useComponentsV2) {
				return interaction.update(
					client.createPlayerV2(guildId, player, currentSong, { showFilters, showVolume, currentPosition })
				);
			} else {
				return interaction.update({
					components: client.createController(guildId, player, { showFilters, showVolume }),
				});
			}
		}
	}

	if (property === "Next") {
		const song = player.current || player.queue?.current;
		const autoQueue = client.getPlayerData(guildId, "autoQueue");
		
		if (player.queue.length === 0 && (!autoQueue || autoQueue === false)) {
			const songTitle = song?.info?.title || song?.title || 'current track';
			const songUri = song?.info?.uri || song?.uri || '#';
			return interaction.reply({
				ephemeral: true,
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription(`There is nothing after [${songTitle}](${songUri}) in the queue.`),
				],
			});
		} else {
			// player.skip() pula para a próxima da fila; player.stop() limparia tudo e pararia.
			await player.skip(0, false).catch(() => {});
			return interaction.deferUpdate();
		}
	}

	if (property === "Loop") {
		// Riffy usa "track", "queue" ou "none" para loop
		const currentLoop = player.loop;
		if (currentLoop === "track") {
			player.setLoop("queue");
		} else if (currentLoop === "queue") {
			player.setLoop("none");
		} else {
			player.setLoop("track");
		}
		client.warn(`Player: ${guildId} | Successfully toggled loop ${player.loop} the player`);

		const currentSong = player.current || player.queue?.current;
		const showFilters = client.getPlayerData(guildId, "showFilters") || false;
		const showVolume = client.getPlayerData(guildId, "showVolume") || false;
		const useComponentsV2 = client.getPlayerData(guildId, "useComponentsV2");
		const currentPosition = client.getPlayerData(guildId, "trackStartTime") 
			? Date.now() - client.getPlayerData(guildId, "trackStartTime") 
			: 0;
		
		if (currentSong) {
			if (useComponentsV2) {
				return interaction.update(
					client.createPlayerV2(guildId, player, currentSong, { showFilters, showVolume, currentPosition })
				);
			} else {
				return interaction.update({
					components: client.createController(guildId, player, { showFilters, showVolume }),
				});
			}
		}
		return interaction.deferUpdate();
	}

	if (property === "Filters") {
		const filtersMenu1 = new ActionRowBuilder().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId(`filters:${actualGuildId}`)
				.setPlaceholder('Select a filter (Page 1/2)')
				.addOptions([
					{ label: 'Reset All Filters', value: 'off', emoji: emojiFor("loop") },
					{ label: 'Nightcore', value: 'nightcore', emoji: emojiFor("filters") },
					{ label: 'Vaporwave', value: 'vaporwave', emoji: emojiFor("waves") },
					{ label: 'Slow', value: 'slow', emoji: emojiFor("slow") },
					{ label: 'Fast', value: 'fast', emoji: emojiFor("zap") },
					{ label: 'BassBoost Low', value: 'bassboost_low', emoji: emojiFor("vol0") },
					{ label: 'BassBoost Medium', value: 'bassboost_medium', emoji: emojiFor("vol1") },
					{ label: 'BassBoost High', value: 'bassboost_high', emoji: emojiFor("vol2") },
					{ label: '8D Audio', value: '8d', emoji: emojiFor("mic") },
					{ label: 'Karaoke', value: 'karaoke', emoji: emojiFor("micvocal") },
					{ label: 'Vibrato', value: 'vibrato', emoji: emojiFor("vibrate") },
					{ label: 'Tremolo', value: 'tremolo', emoji: emojiFor("vibrate") },
					{ label: 'Low Pass', value: 'lowpass', emoji: emojiFor("chevdown") },
					{ label: 'High Pass', value: 'highpass', emoji: emojiFor("chevup") },
					{ label: 'Channel Mix', value: 'channelmix', emoji: emojiFor("shuffle") },
					{ label: 'Distortion', value: 'distortion', emoji: emojiFor("guitar") },
					{ label: 'Compressor', value: 'compressor', emoji: emojiFor("stats") },
					{ label: 'Gate', value: 'gate', emoji: emojiFor("door") },
				]),
		);

		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(`${emojiTag("filters")} | **Select a filter to apply**\n\n**Available Filters:**\n${emojiTag("filters")} Speed/Pitch: Nightcore, Vaporwave, Slow, Fast\n${emojiTag("vol2")} Bass: Low, Medium, High\n${emojiTag("audio")} Effects: 8D, Karaoke, Vibrato, Tremolo\n${emojiTag("wrench")} Advanced: Low Pass, High Pass, Channel Mix, Distortion, Compressor, Gate`)
			],
			components: [filtersMenu1],
			ephemeral: true
		});
		return;
	}

	// Toggle de filtros diretamente no player
	if (property === "ToggleFilters") {
		const currentShowFilters = client.getPlayerData(guildId, "showFilters") || false;
		client.setPlayerData(guildId, "showFilters", !currentShowFilters);
		// Fechar volume e fila quando abrir filtros
		if (!currentShowFilters) {
			client.setPlayerData(guildId, "showVolume", false);
			client.setPlayerData(guildId, "showQueue", false);
			client.setPlayerData(guildId, "showEq", false);
		}
		
		const currentSong = player.current || player.queue?.current;
		const useComponentsV2 = client.getPlayerData(guildId, "useComponentsV2");
		const currentPosition = client.getPlayerData(guildId, "trackStartTime") 
			? Date.now() - client.getPlayerData(guildId, "trackStartTime") 
			: 0;
		
		if (currentSong) {
			if (useComponentsV2) {
				return interaction.update(
					client.createPlayerV2(guildId, player, currentSong, { showFilters: !currentShowFilters, showVolume: false, currentPosition })
				);
			} else {
				return interaction.update({
					components: client.createController(guildId, player, { showFilters: !currentShowFilters, showVolume: false }),
				});
			}
		}
		return interaction.deferUpdate();
	}

	if (property === "ToggleEq") {
		const useComponentsV2 = client.getPlayerData(guildId, "useComponentsV2");
		if (!useComponentsV2) {
			// player clássico não tem EQ inline → abre o painel do /equalizer (ephemeral)
			const { buildEqPanel } = require("./Equalizer");
			const gains = (client.getPlayerData(guildId, "eqGains") || [0, 0, 0, 0, 0]).slice();
			const preset = client.getPlayerData(guildId, "eqPreset") || "Custom";
			const panel = buildEqPanel(client, guildId, gains, preset);
			return interaction.reply({ ...panel, flags: panel.flags | MessageFlags.Ephemeral }).catch(() => {});
		}
		const cur = client.getPlayerData(guildId, "showEq") || false;
		client.setPlayerData(guildId, "showEq", !cur);
		if (!cur) {
			client.setPlayerData(guildId, "showVolume", false);
			client.setPlayerData(guildId, "showQueue", false);
			client.setPlayerData(guildId, "showFilters", false);
		}
		const currentSong = player.current || player.queue?.current;
		const currentPosition = client.getPlayerData(guildId, "trackStartTime")
			? Date.now() - client.getPlayerData(guildId, "trackStartTime")
			: 0;
		if (currentSong) {
			return interaction.update(
				client.createPlayerV2(guildId, player, currentSong, {
					showFilters: client.getPlayerData(guildId, "showFilters") || false,
					showVolume: client.getPlayerData(guildId, "showVolume") || false,
					currentPosition,
				})
			);
		}
		return interaction.deferUpdate();
	}

	if (property === "EqUp" || property === "EqDown" || property === "EqPreset") {
		const arg = interaction.customId.split(":")[3];
		require("./Equalizer").applyEqStep(client, guildId, property, arg);
		const currentSong = player.current || player.queue?.current;
		const currentPosition = client.getPlayerData(guildId, "trackStartTime")
			? Date.now() - client.getPlayerData(guildId, "trackStartTime")
			: 0;
		if (currentSong) {
			return interaction.update(
				client.createPlayerV2(guildId, player, currentSong, {
					showFilters: client.getPlayerData(guildId, "showFilters") || false,
					showVolume: client.getPlayerData(guildId, "showVolume") || false,
					currentPosition,
				})
			);
		}
		return interaction.deferUpdate();
	}

	if (property === "AutoQueue") {
		if (!player) return interaction.deferUpdate().catch(() => {});

		const current = client.getPlayerData(guildId, "autoQueue") || false;
		client.setPlayerData(guildId, "autoQueue", !current);
		// requester usado nas músicas auto-adicionadas (relacionadas)
		client.setPlayerData(guildId, "requester", interaction.guild.members.me);
		client.warn(`Player: ${guildId} | AutoQueue ${!current ? "ENABLED" : "DISABLED"}`);

		const currentSong = player.current || player.queue?.current;
		const showFilters = client.getPlayerData(guildId, "showFilters") || false;
		const showVolume = client.getPlayerData(guildId, "showVolume") || false;
		const useComponentsV2 = client.getPlayerData(guildId, "useComponentsV2");
		const currentPosition = client.getPlayerData(guildId, "trackStartTime")
			? Date.now() - client.getPlayerData(guildId, "trackStartTime")
			: 0;

		if (currentSong) {
			if (useComponentsV2) {
				return interaction.update(
					client.createPlayerV2(guildId, player, currentSong, { showFilters, showVolume, currentPosition })
				);
			} else {
				return interaction.update({
					components: client.createController(guildId, player, { showFilters, showVolume }),
				});
			}
		}
		return interaction.deferUpdate();
	}

	if (property === "Search") {
		// Criar modal para buscar música
		const modal = new ModalBuilder()
			.setCustomId(`searchMusic:${guildId}`)
			.setTitle(`${emojiTag("search")} Buscar Música`);
		
		const searchInput = new TextInputBuilder()
			.setCustomId('searchQuery')
			.setLabel('Digite o nome da música ou URL')
			.setPlaceholder('Ex: Never Gonna Give You Up, https://youtube.com/...')
			.setStyle(TextInputStyle.Short)
			.setMinLength(2)
			.setMaxLength(200)
			.setRequired(true);
		
		const actionRow = new ActionRowBuilder().addComponents(searchInput);
		modal.addComponents(actionRow);
		
		await interaction.showModal(modal);
		return;
	}

	if (property === "Queue") {
		if (!player.queue || !player.queue.length) {
			let song = player.current || player.queue?.current;
			if (!song) {
				return interaction.reply({
					embeds: [
						new EmbedBuilder()
							.setColor(Colors.Red)
							.setDescription("There is no song playing right now."),
					],
					ephemeral: true
				});
			}
			
			const songTitle = song.info?.title || song.title || "Unknown";
			const songUri = song.info?.uri || song.uri || "#";
			const songLength = song.info?.length || song.length || 0;
			const songIsStream = song.info?.isStream || song.isStream || false;
			
			var title = escapeMarkdown(songTitle);
			title = title.replace(/\]/g, "");
			title = title.replace(/\[/g, "");
			
			const queueEmbed = new EmbedBuilder()
				.setColor(client.config.embedColor)
				.setDescription(`**${emojiTag("audio")} | Now playing:** [${title}](${songUri})`)
				.addFields(
					{
						name: "Duration",
						value: songIsStream
							? `\`LIVE\``
							: `\`${client.ms(player.position || 0, { colonNotation: true })} / ${client.ms(songLength, { colonNotation: true })}\``,
						inline: true,
					},
					{
						name: "Volume",
						value: `\`${player.volume || 100}\``,
						inline: true,
					},
					{
						name: "Total Tracks",
						value: `\`${player.queue.length}\``,
						inline: true,
					},
				);

			return interaction.reply({ embeds: [queueEmbed], ephemeral: true });
		}
		
		let queueList = player.queue.map(
			(t, i) => `\` ${++i} \` [${t.info?.title || t.title || 'Unknown'}](${t.info?.uri || t.uri || '#'}) [${t.info?.requester || t.requester || 'Unknown'}]`
		).slice(0, 5).join("\n");
		
		let song = player.current || player.queue?.current;
		const songTitle = song?.info?.title || song?.title || "Unknown";
		const songUri = song?.info?.uri || song?.uri || "#";
		const songLength = song?.info?.length || song?.length || 0;
		const songIsStream = song?.info?.isStream || song?.isStream || false;
		
		var title = escapeMarkdown(songTitle);
		title = title.replace(/\]/g, "");
		title = title.replace(/\[/g, "");
		
		const queueEmbed = new EmbedBuilder()
			.setColor(client.config.embedColor)
			.setDescription(`**${emojiTag("audio")} | Now playing:** [${title}](${songUri})\n\n**Queued Tracks**\n${queueList}`)
			.addFields(
				{
					name: "Duration",
					value: songIsStream
						? `\`LIVE\``
						: `\`${client.ms(player.position || 0, { colonNotation: true })} / ${client.ms(songLength, { colonNotation: true })}\``,
					inline: true,
				},
				{
					name: "Volume",
					value: `\`${player.volume || 100}\``,
					inline: true,
				},
				{
					name: "Total Tracks",
					value: `\`${player.queue.length}\``,
					inline: true,
				},
			)
			.setFooter({ text: `Page 1/${Math.ceil(player.queue.length/5)}` });
		
		let components = [];
		if (player.queue.length > 5) {
			const navigationRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`queue:${guildId}:prev:0`)
					.setEmoji(emojiFor("navleft"))
					.setStyle(ButtonStyle.Primary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId(`queue:${guildId}:next:0`)
					.setEmoji(emojiFor("navright"))
					.setStyle(ButtonStyle.Primary)
			);
			components.push(navigationRow);
		}
		
		await interaction.reply({ 
			embeds: [queueEmbed], 
			components: components,
			ephemeral: true 
		});
		return;
	}

	if (property === "Shuffle") {
		if (!player.queue || player.queue.length < 2) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("There are not enough songs in the queue to shuffle."),
				],
				ephemeral: true
			});
		}
		
		// Toggle shuffle state
		const currentShuffleState = client.getPlayerData(guildId, "shuffleEnabled") || false;
		client.setPlayerData(guildId, "shuffleEnabled", !currentShuffleState);
		
		player.queue.shuffle();
		
		const currentSong = player.current || player.queue?.current;
		const showFilters = client.getPlayerData(guildId, "showFilters") || false;
		const showVolume = client.getPlayerData(guildId, "showVolume") || false;
		const useComponentsV2 = client.getPlayerData(guildId, "useComponentsV2");
		const currentPosition = client.getPlayerData(guildId, "trackStartTime") 
			? Date.now() - client.getPlayerData(guildId, "trackStartTime") 
			: 0;
		
		if (currentSong) {
			if (useComponentsV2) {
				return interaction.update(
					client.createPlayerV2(guildId, player, currentSong, { showFilters, showVolume, currentPosition })
				);
			} else {
				return interaction.update({
					components: client.createController(guildId, player, { showFilters, showVolume }),
				});
			}
		}
		return interaction.deferUpdate();
	}

	if (property === "Volume") {
		// Toggle de volume diretamente no player
		const currentShowVolume = client.getPlayerData(guildId, "showVolume") || false;
		client.setPlayerData(guildId, "showVolume", !currentShowVolume);
		// Fechar filtros e fila quando abrir volume
		if (!currentShowVolume) {
			client.setPlayerData(guildId, "showFilters", false);
			client.setPlayerData(guildId, "showQueue", false);
			client.setPlayerData(guildId, "showEq", false);
		}
		
		const currentSong = player.current || player.queue?.current;
		const useComponentsV2 = client.getPlayerData(guildId, "useComponentsV2");
		const currentPosition = client.getPlayerData(guildId, "trackStartTime") 
			? Date.now() - client.getPlayerData(guildId, "trackStartTime") 
			: 0;
		
		if (currentSong) {
			if (useComponentsV2) {
				return interaction.update(
					client.createPlayerV2(guildId, player, currentSong, { 
						showFilters: false, 
						showVolume: !currentShowVolume,
						currentPosition 
					})
				);
			} else {
				return interaction.update({
					components: client.createController(guildId, player, { 
						showFilters: false, 
						showVolume: !currentShowVolume 
					}),
				});
			}
		}
		return interaction.deferUpdate();
	}

	// ===== FILA INLINE: toggle, paginação e remover =====
	const rerenderPlayer = () => {
		const currentSong = player.current || player.queue?.current;
		const showFilters = client.getPlayerData(guildId, "showFilters") || false;
		const showVolume = client.getPlayerData(guildId, "showVolume") || false;
		const useComponentsV2 = client.getPlayerData(guildId, "useComponentsV2");
		const currentPosition = client.getPlayerData(guildId, "trackStartTime")
			? Date.now() - client.getPlayerData(guildId, "trackStartTime")
			: 0;
		if (!currentSong) return interaction.deferUpdate().catch(() => {});
		if (useComponentsV2) {
			return interaction.update(client.createPlayerV2(guildId, player, currentSong, { showFilters, showVolume, currentPosition }));
		}
		return interaction.update({ components: client.createController(guildId, player, { showFilters, showVolume }) });
	};

	if (property === "ToggleQueue") {
		if (!player) return interaction.deferUpdate().catch(() => {});
		const showQueue = client.getPlayerData(guildId, "showQueue") || false;
		client.setPlayerData(guildId, "showQueue", !showQueue);
		if (!showQueue) {
			// abrindo a fila: fecha volume/filtros/eq e volta pra página 0
			client.setPlayerData(guildId, "showVolume", false);
			client.setPlayerData(guildId, "showFilters", false);
			client.setPlayerData(guildId, "showEq", false);
			client.setPlayerData(guildId, "queuePage", 0);
		}
		return rerenderPlayer();
	}

	if (property === "QPage") {
		if (!player) return interaction.deferUpdate().catch(() => {});
		const dir = interaction.customId.split(":")[3];
		const total = Math.max(1, Math.ceil((player.queue?.tracks?.length || 0) / 4));
		let qpage = client.getPlayerData(guildId, "queuePage") || 0;
		qpage = dir === "next" ? Math.min(qpage + 1, total - 1) : Math.max(qpage - 1, 0);
		client.setPlayerData(guildId, "queuePage", qpage);
		return rerenderPlayer();
	}

	if (property === "QRemove") {
		if (!player) return interaction.deferUpdate().catch(() => {});
		const idx = parseInt(interaction.customId.split(":")[3]);
		const upcoming = player.queue?.tracks || [];
		if (!isNaN(idx) && idx >= 0 && idx < upcoming.length) {
			try { player.queue.remove(idx); } catch (e) { client.warn?.(`QRemove: ${e.message}`); }
			const total = Math.max(1, Math.ceil((player.queue?.tracks?.length || 0) / 4));
			let qpage = client.getPlayerData(guildId, "queuePage") || 0;
			if (qpage > total - 1) client.setPlayerData(guildId, "queuePage", total - 1);
		}
		return rerenderPlayer();
	}

	return interaction.reply({
		ephemeral: true,
		content: `${emojiTag("error")} | **Unknown controller option**`,
	});
};
