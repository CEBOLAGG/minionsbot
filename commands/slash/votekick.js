const SlashCommand = require("../../lib/SlashCommand");
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require("discord.js");

// Armazena votações ativas para evitar duplicatas
const activeVotes = new Map();

const command = new SlashCommand()
	.setName("votekick")
    .setDescription("Inicia uma votação para expulsar um usuário do canal de voz")
	.addUserOption((option) =>
		option
			.setName("user")
            .setDescription("O usuário que você quer expulsar")
			.setRequired(true)
	)
    .addStringOption((option) =>
        option
            .setName("reason")
            .setDescription("Motivo da votação (opcional)")
            .setRequired(false)
    )
	.setRun(async (client, interaction) => {
		const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "Sem motivo especificado";
		const member = interaction.guild.members.cache.get(target.id);
        const initiator = interaction.member;
        
        // Verifica se o iniciador está em um canal de voz
        if (!initiator.voice.channel) {
            return interaction.reply({
                content: "❌ Você precisa estar em um canal de voz para iniciar uma votação!",
                ephemeral: true
            });
        }
        
        // Verifica se o alvo está no mesmo canal de voz
        if (!member?.voice.channel) {
            return interaction.reply({
                content: "❌ Este usuário não está em um canal de voz!",
                ephemeral: true
            });
        }
        
        if (member.voice.channel.id !== initiator.voice.channel.id) {
            return interaction.reply({
                content: "❌ Este usuário não está no mesmo canal de voz que você!",
                ephemeral: true
            });
        }
        
        // Verifica se já existe uma votação ativa para este usuário
        const voteKey = `${interaction.guild.id}_${target.id}`;
        if (activeVotes.has(voteKey)) {
            return interaction.reply({
                content: "❌ Já existe uma votação em andamento para este usuário!",
                ephemeral: true
            });
        }
        
        // Não pode votar para expulsar a si mesmo
        if (target.id === interaction.user.id) {
            return interaction.reply({
                content: "❌ Você não pode iniciar uma votação para expulsar a si mesmo!",
                ephemeral: true
            });
        }
        
        // Não pode votar para expulsar o bot
        if (target.id === client.user.id) {
			return interaction.reply({
                content: "❌ Você não pode me expulsar assim! 😤",
				ephemeral: true
			});
		}
		
        // Lista de admin IDs
		const adminIds = client.config.adminId || [];
		
        // Tempo de votação (2 minutos)
        const voteTime = 120000;
        const votesNeeded = 4;
        
        // Inicializa contadores
        const votes = {
            yes: new Set(),
            no: new Set()
        };
        
        // O iniciador automaticamente vota SIM
        votes.yes.add(interaction.user.id);
        
        // Marca votação como ativa
        activeVotes.set(voteKey, true);
        
        // Cria os botões
        const createButtons = (disabled = false) => {
            return new ActionRowBuilder().addComponents(
			new ButtonBuilder()
                    .setCustomId(`votekick_yes_${target.id}`)
                    .setLabel(`SIM (${votes.yes.size})`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("✅")
                    .setDisabled(disabled),
			new ButtonBuilder()
                    .setCustomId(`votekick_no_${target.id}`)
                    .setLabel(`NÃO (${votes.no.size})`)
				.setStyle(ButtonStyle.Danger)
                    .setEmoji("❌")
                    .setDisabled(disabled)
            );
        };
        
        // Cria a embed
        const createEmbed = (status = "voting", result = "") => {
            const embed = new EmbedBuilder()
                .setTitle("🗳️ Votação para Expulsar")
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            
            if (status === "voting") {
                embed.setColor(0xFFA500)
                    .setDescription(
                        `**${interaction.user}** iniciou uma votação para expulsar **${target}** do canal de voz.\n\n` +
                        `📋 **Motivo:** ${reason}\n\n` +
                        `📊 **Votos necessários:** ${votesNeeded} votos SIM`
                    )
                    .setFooter({ text: `Alvo: ${target.tag} • Clique nos botões para votar` });
            } else if (status === "approved") {
                embed.setColor(0x2ECC71)
                    .setDescription(
                        `✅ **VOTAÇÃO APROVADA**\n\n` +
                        `**${target}** foi expulso do canal de voz!\n\n` +
                        `${result}`
                    )
                    .setFooter({ text: "Votação encerrada" });
            } else if (status === "rejected") {
                embed.setColor(0xE74C3C)
                    .setDescription(
                        `❌ **VOTAÇÃO REJEITADA**\n\n` +
                        `**${target}** permanecerá no canal de voz.\n\n` +
                        `${result}`
                    )
                    .setFooter({ text: "Votação encerrada" });
            } else if (status === "expired") {
                embed.setColor(0x95A5A6)
                    .setDescription(
                        `⏱️ **TEMPO ESGOTADO**\n\n` +
                        `A votação expirou sem votos suficientes.\n` +
                        `**${target}** permanecerá no canal de voz.`
                    )
                    .setFooter({ text: "Votação expirada" });
            }
            
            return embed;
        };
        
        // Envia a mensagem inicial
		const message = await interaction.reply({
            embeds: [createEmbed("voting")],
            components: [createButtons()],
			fetchReply: true
		});
		
        // Cria o collector
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
            time: voteTime
        });
        
        // Atualiza o tempo restante periodicamente
        const updateInterval = setInterval(async () => {
            if (!activeVotes.has(voteKey)) {
                clearInterval(updateInterval);
                return;
            }
            
            try {
                await message.edit({
                    embeds: [createEmbed("voting")],
                    components: [createButtons()]
                });
            } catch (e) {
                // Ignora erros de edição
            }
        }, 15000); // Atualiza a cada 15 segundos
        
        // Handler de votos
		collector.on("collect", async (i) => {
            const oderId = i.user.id;
            
            // Verifica se já votou
            if (votes.yes.has(oderId) || votes.no.has(oderId)) {
				return i.reply({
                    content: "❌ Você já votou nesta votação!",
					ephemeral: true
				});
			}
			
            // Verifica se é admin
            const isAdmin = adminIds.includes(oderId);
			
            if (i.customId.startsWith("votekick_yes")) {
                votes.yes.add(oderId);
				
				if (isAdmin) {
					await i.reply({
                        content: "✅ Você votou **SIM** como administrador. Seu voto é decisivo!",
						ephemeral: true
					});
					collector.stop("admin_approved");
                    return;
				} else {
					await i.reply({
                        content: "✅ Você votou **SIM** para expulsar o usuário.",
						ephemeral: true
					});
				}
            } else if (i.customId.startsWith("votekick_no")) {
                votes.no.add(oderId);
				
				if (isAdmin) {
					await i.reply({
                        content: "❌ Você votou **NÃO** como administrador. Seu voto é decisivo!",
						ephemeral: true
					});
					collector.stop("admin_rejected");
                    return;
				} else {
					await i.reply({
                        content: "❌ Você votou **NÃO** para expulsar o usuário.",
						ephemeral: true
					});
				}
			}
			
            // Atualiza a embed
            await message.edit({
                embeds: [createEmbed("voting")],
                components: [createButtons()]
            });
			
            // Verifica se atingiu os votos necessários
            if (votes.yes.size >= votesNeeded) {
				collector.stop("approved");
            } else if (votes.no.size >= votesNeeded) {
				collector.stop("rejected");
			}
		});
		
        // Quando a votação termina
		collector.on("end", async (collected, reason) => {
            clearInterval(updateInterval);
            activeVotes.delete(voteKey);
			
            let status = "expired";
			let result = "";
			
			if (reason === "approved" || reason === "admin_approved") {
                status = "approved";
                
                try {
                    // Verifica se o usuário ainda está no canal
                    const updatedMember = interaction.guild.members.cache.get(target.id);
                    if (updatedMember?.voice.channel) {
                        await updatedMember.voice.disconnect("Expulso por votação");
                        result = reason === "admin_approved" 
                            ? "🔨 Um administrador aprovou a expulsão." 
                            : `🗳️ A votação atingiu ${votesNeeded} votos SIM.`;
					} else {
                        result = "⚠️ O usuário já saiu do canal de voz.";
					}
				} catch (error) {
                    status = "rejected";
                    result = `⚠️ Erro ao expulsar: ${error.message}`;
				}
			} else if (reason === "rejected" || reason === "admin_rejected") {
                status = "rejected";
                result = reason === "admin_rejected"
                    ? "🔨 Um administrador rejeitou a expulsão."
                    : `🗳️ A votação atingiu ${votesNeeded} votos NÃO.`;
			}
			
            // Atualiza a mensagem final
            try {
			await message.edit({
                    embeds: [createEmbed(status, result)],
                    components: [createButtons(true)]
			});
			
                // Apaga a mensagem após 10 segundos
			setTimeout(async () => {
				try {
					await message.delete();
                    } catch (e) {
                        // Ignora erro se já foi deletada
                    }
                }, 10000);
				} catch (error) {
                console.error("Erro ao finalizar votação:", error);
				}
		});
	});

module.exports = command;
