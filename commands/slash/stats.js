const SlashCommand = require("../../lib/SlashCommand");
const moment = require("moment");
require("moment-duration-format");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");
const os = require("os");

const command = new SlashCommand()
	.setName("stats")
	.setDescription("Get information about the bot")
	.setRun(async (client, interaction) => {
		try {
			// get OS info
			const osver = os.platform() + " " + os.release();
			
			// Get nodejs version
			const nodeVersion = process.version;
			
			// get the uptime in a human readable format
			const runtime = moment
				.duration(client.uptime)
				.format("d[ Days]・h[ Hrs]・m[ Mins]・s[ Secs]");
				
			// Tentar obter stats do Lavalink
			let lavauptime = "N/A";
			let lavaram = "N/A";
			let lavamemalocated = "N/A";
			let playingPlayers = 0;
			let totalPlayers = 0;
			let nodeStatus = "Disconnected";
			let nodeName = "N/A";
			
			try {
				// Usar a função getLavalink que já existe no client
				const node = await client.getLavalink(client);
				
				if (node) {
					nodeName = node.name || node.options?.identifier || "Main Node";
					nodeStatus = node.connected ? "Connected" : "Disconnected";
					
					// Riffy armazena stats diretamente no node ou em node.stats
					const stats = node.stats || node;
					
					if (stats) {
						// Uptime pode estar em stats.uptime ou stats.info?.uptime
						const uptime = stats.uptime || stats.info?.uptime;
						if (uptime) {
							lavauptime = moment
								.duration(uptime)
								.format("D[d], H[h], m[m]");
						}
						
						// Memory pode estar em stats.memory
						const memory = stats.memory;
						if (memory) {
							lavaram = (memory.used / 1024 / 1024).toFixed(2);
							lavamemalocated = (memory.allocated / 1024 / 1024).toFixed(2);
						}
						
						// Players
						playingPlayers = stats.playingPlayers || 0;
						totalPlayers = stats.players || 0;
					}
				}
				
				// Se não conseguiu do node, tenta pegar direto do manager
				if (lavauptime === "N/A" && client.manager) {
					// Contar players ativos do manager
					if (client.manager.players) {
						totalPlayers = client.manager.players.size || 0;
						playingPlayers = Array.from(client.manager.players.values())
							.filter(p => p.playing).length || 0;
					}
				}
			} catch (e) {
				console.error("Error getting Lavalink stats:", e.message);
			}
				
			// show system uptime
			var sysuptime = moment
				.duration(os.uptime() * 1000)
				.format("d[ Days]・h[ Hrs]・m[ Mins]・s[ Secs]");
			
			// get commit hash and date
			let gitHash = "unknown";
			try {
				gitHash = require("child_process")
					.execSync("git rev-parse HEAD")
					.toString()
					.trim();
			} catch (e) {
				gitHash = "unknown";
			}
			
			const statsEmbed = new EmbedBuilder()
				.setTitle(`${client.user.username} Information`)
				.setColor(client.config.embedColor)
				.setDescription(
					`\`\`\`yml\nName: ${client.user.username}#${client.user.discriminator} [${client.user.id}]\nAPI: ${client.ws.ping}ms\nRuntime: ${runtime}\`\`\``,
				)
				.setFields([
					{
						name: `Lavalink stats`,
						value: `\`\`\`yml\nNode: ${nodeName}\nStatus: ${nodeStatus}\nUptime: ${lavauptime}\nRAM: ${lavaram} MB\nPlaying: ${playingPlayers} out of ${totalPlayers}\`\`\``,
						inline: true,
					},
					{
						name: "Bot stats",
						value: `\`\`\`yml\nGuilds: ${client.guilds.cache.size}\nNodeJS: ${nodeVersion}\nDiscordMusicBot: v${require("../../package.json").version}\`\`\``,
						inline: true,
					},
					{
						name: "System stats",
						value: `\`\`\`yml\nOS: ${osver}\nUptime: ${sysuptime}\`\`\``,
						inline: false,
					},
				])
				.setFooter({ text: `Build: ${gitHash}` });
				
			return interaction.reply({ embeds: [statsEmbed] });
		} catch (error) {
			console.error("Stats command error:", error);
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("An error occurred while getting stats.")
				],
				flags: MessageFlags.Ephemeral
			});
		}
	});

module.exports = command;
