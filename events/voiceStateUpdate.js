const { EmbedBuilder, Colors } = require("discord.js");

/**
 *
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {import("discord.js").VoiceState} oldState
 * @param {import("discord.js").VoiceState} newState
 * @returns {Promise<void>}
 */
module.exports = async (client, oldState, newState) => {
	let guildId = newState.guild.id;
	const player = client.manager.players.get(guildId);
	
	// check if the bot is active
	if (!player || !player.connected) {
		return;
	}
	
	const stateChange = {};
	
	if (oldState.channel === null && newState.channel !== null) {
		stateChange.type = "JOIN";
	}
	if (oldState.channel !== null && newState.channel === null) {
		stateChange.type = "LEAVE";
	}
	if (oldState.channel !== null && newState.channel !== null) {
		stateChange.type = "MOVE";
	}
	if (oldState.channel === null && newState.channel === null) {
		return;
	}
	
	// Handle server mute/unmute
	if (
		newState.serverMute == true &&
		oldState.serverMute == false &&
		newState.id === client.config.clientId
	) {
		return player.pause(true);
	}
	if (
		newState.serverMute == false &&
		oldState.serverMute == true &&
		newState.id === client.config.clientId
	) {
		return player.pause(false);
	}
	
	// move check first as it changes type
	if (stateChange.type === "MOVE") {
		if (oldState.channel.id === player.voiceChannel) {
			stateChange.type = "LEAVE";
		}
		if (newState.channel.id === player.voiceChannel) {
			stateChange.type = "JOIN";
		}
	}
	
	if (stateChange.type === "JOIN") {
		stateChange.channel = newState.channel;
	}
	if (stateChange.type === "LEAVE") {
		stateChange.channel = oldState.channel;
	}
	
	// check if the bot's voice channel is involved
	if (!stateChange.channel || stateChange.channel.id !== player.voiceChannel) {
		return;
	}
	
	const textChannel = client.getPlayerData(guildId, "textChannel");
	const prevMembers = client.getPlayerData(guildId, "prevMembers") || 0;
	const members = stateChange.channel.members.filter(member => !member.user.bot).size;
	client.setPlayerData(guildId, "prevMembers", members);
	
	// Função helper para deletar a mensagem do Now Playing
	const deleteNowPlayingMessage = () => {
		try {
			const nowPlayingMessage = client.getNowPlayingMessage(guildId);
			if (nowPlayingMessage && !client.isMessageDeleted(nowPlayingMessage)) {
				nowPlayingMessage.delete().catch(() => {});
				client.markMessageAsDeleted(nowPlayingMessage);
			}
			client.setNowPlayingMessage(guildId, null);
		} catch (err) {
			// Ignorar erros ao deletar mensagem
		}
	};
	
	switch (stateChange.type) {
		case "JOIN":
			if (client.getPlayerData(guildId, "autoPause") === true) {
				if (members === 1 && player.paused && members !== prevMembers) {
					player.pause(false);
					let playerResumed = new EmbedBuilder()
						.setColor(client.config.embedColor)
						.setTitle(`Resumed!`, client.config.iconURL)
						.setDescription(
							`Playing [${player.current?.info?.title || 'Unknown'}](${player.current?.info?.uri || '#'})`,
						)
						.setFooter({ text: `The current song has been resumed.` });
					
					let resumeMessage = await client.channels.cache
						.get(textChannel)
						?.send({ embeds: [playerResumed] });
					
					if (resumeMessage) {
					setTimeout(() => {
						if (!client.isMessageDeleted(resumeMessage)) {
								resumeMessage.delete().catch(() => {});
							client.markMessageAsDeleted(resumeMessage);
						}
					}, 5000);
					}
				}
			}
			break;
			
                case "LEAVE":
			const twentyFourSeven = client.getPlayerData(guildId, "twentyFourSeven");
			const autoPause = client.getPlayerData(guildId, "autoPause");
			const autoLeave = client.getPlayerData(guildId, "autoLeave");
			
			if (autoPause === true && autoLeave === false) {
				if (members === 0 && !player.paused && player.playing) {
					player.pause(true);
					
					let playerPaused = new EmbedBuilder()
						.setColor(client.config.embedColor)
						.setTitle(`Paused!`, client.config.iconURL)
						.setFooter({
							text: `The current song has been paused because there's no one in the voice channel.`,
						});
					
					await client.channels.cache
						.get(textChannel)
						?.send({ embeds: [playerPaused] });
				}
			} else if (autoLeave === true && autoPause === false) {
				if (members === 0) {
					if (twentyFourSeven) {
						setTimeout(async () => {
							var currentMembers = stateChange.channel.members.filter(member => !member.user.bot).size;
							const currentPlayer = client.manager.players.get(guildId);
							if (currentMembers === 0 && currentPlayer && currentPlayer.connected) {
								// Deletar mensagem do Now Playing
								deleteNowPlayingMessage();
								
								let leftEmbed = new EmbedBuilder()
									.setColor(client.config.embedColor)
									.setAuthor({
									name: "Disconnected!",
									iconURL: client.config.iconURL,
									})
									.setFooter({ text: "Left because there is no one left in the voice channel." })
									.setTimestamp();
								let Disconnected = await client.channels.cache
									.get(textChannel)
									?.send({ embeds: [leftEmbed] });
								if (Disconnected) setTimeout(() => Disconnected.delete().catch(() => {}), 5000);
								currentPlayer.queue.clear();
								currentPlayer.destroy();
								client.setPlayerData(guildId, "autoQueue", false);
								client.clearPlayerData(guildId);
							}
						}, client.config.disconnectTime);
					} else {
						// Deletar mensagem do Now Playing
						deleteNowPlayingMessage();
						
						let leftEmbed = new EmbedBuilder()
							.setColor(client.config.embedColor)
							.setAuthor({
							name: "Disconnected!",
							iconURL: client.config.iconURL,
							})
							.setFooter({ text: "Left because there is no one left in the voice channel." })
							.setTimestamp();
						let Disconnected = await client.channels.cache
							.get(textChannel)
							?.send({ embeds: [leftEmbed] });
						if (Disconnected) setTimeout(() => Disconnected.delete().catch(() => {}), 5000);
						player.destroy();	
						client.clearPlayerData(guildId);
					}
				}
			} else if (autoLeave === true && autoPause === true) {
				if (members === 0 && !player.paused && player.playing && twentyFourSeven) {
					player.pause(true);
					
					let playerPaused = new EmbedBuilder()
						.setColor(client.config.embedColor)
						.setTitle(`Paused!`, client.config.iconURL)
						.setFooter({
							text: `The current song has been paused because there's no one in the voice channel.`,
						});
					
					let pausedMessage = await client.channels.cache
						.get(textChannel)
						?.send({ embeds: [playerPaused] });
					
					setTimeout(async () => {
						var currentMembers = stateChange.channel.members.filter(member => !member.user.bot).size;
						const currentPlayer = client.manager.players.get(guildId);
						if (currentMembers === 0 && currentPlayer && currentPlayer.connected) {
							// Deletar mensagem do Now Playing
							deleteNowPlayingMessage();
							
							let leftEmbed = new EmbedBuilder()
								.setColor(client.config.embedColor)
								.setAuthor({
								name: "Disconnected!",
								iconURL: client.config.iconURL,
								})
								.setFooter({ text: "Left because there is no one left in the voice channel." })
								.setTimestamp();
							let Disconnected = await client.channels.cache
								.get(textChannel)
								?.send({ embeds: [leftEmbed] });
							if (Disconnected) setTimeout(() => Disconnected.delete().catch(() => {}), 5000);
							if (pausedMessage) pausedMessage.delete().catch(() => {});
							currentPlayer.queue.clear();
							currentPlayer.destroy();
							client.setPlayerData(guildId, "autoQueue", false);
							client.clearPlayerData(guildId);
						}
					}, client.config.disconnectTime);
				} else {
					if (members === 0) {
						const currentPlayer = client.manager.players.get(guildId);
						if (currentPlayer && currentPlayer.connected) {
							// Deletar mensagem do Now Playing
							deleteNowPlayingMessage();
							
						let leftEmbed = new EmbedBuilder()
						.setColor(client.config.embedColor)
						.setAuthor({
						name: "Disconnected!",
						iconURL: client.config.iconURL,
						})
						.setFooter({ text: "Left because there is no one left in the voice channel." })
						.setTimestamp();
						let Disconnected = await client.channels.cache
								.get(textChannel)
								?.send({ embeds: [leftEmbed] });
							if (Disconnected) setTimeout(() => Disconnected.delete().catch(() => {}), 5000);
							currentPlayer.destroy();
							client.clearPlayerData(guildId);
						}
					}
				}
			}
		break;
	}
};
