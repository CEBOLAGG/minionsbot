const SlashCommand = require("../../lib/SlashCommand");
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    Colors 
} = require("discord.js");
const moment = require("moment-timezone");
const {
    getOrCreateWallet,
    updateWalletBalance,
    claimDaily,
    getUserPendingBets,
    Wallet
} = require("../../util/mongodb");

const BANANA_EMOJI = "🍌";
const MINION_EMOJI = "🟡";

const command = new SlashCommand()
    .setName("bananas")
    .setDescription(`${BANANA_EMOJI} Gerencie suas bananas do Minions Bet`)
    .addSubcommand(sub =>
        sub.setName("saldo")
            .setDescription("Ver seu saldo de bananas")
    )
    .addSubcommand(sub =>
        sub.setName("daily")
            .setDescription("Coletar suas bananas diárias (+500)")
    )
    .addSubcommand(sub =>
        sub.setName("transferir")
            .setDescription("Transferir bananas para outro usuário")
            .addUserOption(opt =>
                opt.setName("usuario")
                    .setDescription("Usuário que receberá as bananas")
                    .setRequired(true)
            )
            .addIntegerOption(opt =>
                opt.setName("quantidade")
                    .setDescription("Quantidade de bananas para transferir")
                    .setRequired(true)
                    .setMinValue(1)
            )
    )
    .addSubcommand(sub =>
        sub.setName("top")
            .setDescription("Ver ranking de bananas")
    )
    .setRun(async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case "saldo":
                return handleBalance(client, interaction);
            case "daily":
                return handleDaily(client, interaction);
            case "transferir":
                return handleTransfer(client, interaction);
            case "top":
                return handleTop(client, interaction);
            default:
                return interaction.reply({ content: "❌ Subcomando inválido.", ephemeral: true });
        }
    });

/**
 * Handler para ver saldo
 */
async function handleBalance(client, interaction) {
    await interaction.deferReply();

    try {
        const wallet = await getOrCreateWallet(interaction.user.id);
        const pendingBets = await getUserPendingBets(interaction.user.id);
        
        const pendingValue = pendingBets.reduce((sum, bet) => sum + bet.betAmount, 0);
        const potentialWin = pendingBets.reduce((sum, bet) => sum + bet.potentialWin, 0);
        
        const winRate = wallet.totalBets > 0 
            ? ((wallet.winCount / wallet.totalBets) * 100).toFixed(1) 
            : "0.0";
        
        const profit = wallet.totalWon - wallet.totalLost;
        const profitSign = profit >= 0 ? "+" : "";

        const embed = new EmbedBuilder()
            .setTitle(`${BANANA_EMOJI} Carteira de ${interaction.user.displayName}`)
            .setColor(Colors.Yellow)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { 
                    name: `${BANANA_EMOJI} Saldo`, 
                    value: `**${wallet.balance.toLocaleString("pt-BR")}** bananas`, 
                    inline: true 
                },
                { 
                    name: "🎰 Em Apostas", 
                    value: `**${pendingValue.toLocaleString("pt-BR")}** bananas`, 
                    inline: true 
                },
                { 
                    name: "💰 Potencial", 
                    value: `**${potentialWin.toLocaleString("pt-BR")}** bananas`, 
                    inline: true 
                }
            );
        
        if (wallet.totalBets > 0) {
            embed.addFields(
                { name: "\u200b", value: "**📊 Estatísticas de Apostas**", inline: false },
                { 
                    name: "📈 Taxa de Acerto", 
                    value: `**${winRate}%** (${wallet.winCount}/${wallet.totalBets})`, 
                    inline: true 
                },
                { 
                    name: "💵 Lucro/Prejuízo", 
                    value: `**${profitSign}${profit.toLocaleString("pt-BR")}** ${BANANA_EMOJI}`, 
                    inline: true 
                },
                { 
                    name: "🏆 Total Ganho", 
                    value: `**${wallet.totalWon.toLocaleString("pt-BR")}** ${BANANA_EMOJI}`, 
                    inline: true 
                }
            );
        }

        // Verifica se daily está disponível
        const now = new Date();
        const lastDaily = wallet.lastDaily ? new Date(wallet.lastDaily) : null;
        const canClaim = !lastDaily || (now - lastDaily) >= 24 * 60 * 60 * 1000;

        if (canClaim) {
            embed.setFooter({ text: "💡 Seu daily está disponível! Use /bananas daily" });
        } else {
            const nextClaim = new Date(lastDaily.getTime() + 24 * 60 * 60 * 1000);
            const timeLeft = moment(nextClaim).fromNow();
            embed.setFooter({ text: `⏰ Próximo daily ${timeLeft}` });
        }

        embed.setTimestamp();

        // Botão de daily se disponível
        const components = [];
        if (canClaim) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("bananas:daily")
                    .setLabel("Coletar Daily (+500)")
                    .setEmoji(BANANA_EMOJI)
                    .setStyle(ButtonStyle.Success)
            );
            components.push(row);
        }

        const message = await interaction.editReply({ embeds: [embed], components });

        // Collector para botão de daily
        if (components.length > 0) {
            const collector = message.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 60000
            });

            collector.on("collect", async (i) => {
                if (i.customId === "bananas:daily") {
                    const result = await claimDaily(interaction.user.id);
                    
                    if (result.success) {
                        const freshWallet = await getOrCreateWallet(interaction.user.id);
                        await i.reply({
                            content: `✅ Você coletou **500** ${BANANA_EMOJI}!\nNovo saldo: **${freshWallet.balance.toLocaleString("pt-BR")}** bananas`,
                            ephemeral: true
                        });
                        
                        // Remove botão
                        await message.edit({ components: [] }).catch(() => {});
                    } else {
                        const timeLeft = result.nextClaim ? moment(result.nextClaim).fromNow() : "em breve";
                        await i.reply({
                            content: `❌ Você já coletou seu daily! Próximo: **${timeLeft}**`,
                            ephemeral: true
                        });
                    }
                }
            });

            collector.on("end", () => {
                message.edit({ components: [] }).catch(() => {});
            });
        }

    } catch (error) {
        console.error("Erro ao verificar saldo:", error);
        return interaction.editReply("❌ Erro ao verificar saldo.");
    }
}

/**
 * Handler para daily
 */
async function handleDaily(client, interaction) {
    await interaction.deferReply();

    try {
        const result = await claimDaily(interaction.user.id);

        if (result.success) {
            const wallet = await getOrCreateWallet(interaction.user.id);
            
            const embed = new EmbedBuilder()
                .setTitle(`${MINION_EMOJI} Daily Coletado!`)
                .setDescription([
                    `Você recebeu **${result.amount}** ${BANANA_EMOJI}!`,
                    "",
                    `${BANANA_EMOJI} **Novo saldo:** ${wallet.balance.toLocaleString("pt-BR")} bananas`
                ].join("\n"))
                .setColor(Colors.Green)
                .setThumbnail("https://i.imgur.com/GYfYG9e.png")
                .setFooter({ text: "Volte amanhã para coletar mais!" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } else {
            const nextClaim = result.nextClaim ? new Date(result.nextClaim) : null;
            let timeLeftText = "em breve";
            
            if (nextClaim) {
                const diff = nextClaim - new Date();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                timeLeftText = `${hours}h ${minutes}m`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`${MINION_EMOJI} Daily Já Coletado!`)
                .setDescription([
                    `Você já coletou seu daily hoje.`,
                    "",
                    `⏰ Próximo daily em: **${timeLeftText}**`
                ].join("\n"))
                .setColor(Colors.Red)
                .setFooter({ text: "Volte mais tarde!" });

            return interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error("Erro ao coletar daily:", error);
        return interaction.editReply("❌ Erro ao coletar daily.");
    }
}

/**
 * Handler para transferência
 */
async function handleTransfer(client, interaction) {
    const targetUser = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("quantidade");

    if (targetUser.id === interaction.user.id) {
        return interaction.reply({ content: "❌ Você não pode transferir para si mesmo!", ephemeral: true });
    }

    if (targetUser.bot) {
        return interaction.reply({ content: "❌ Você não pode transferir para bots!", ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const senderWallet = await getOrCreateWallet(interaction.user.id);

        if (senderWallet.balance < amount) {
            return interaction.editReply(`❌ Saldo insuficiente!\nVocê tem **${senderWallet.balance.toLocaleString("pt-BR")}** ${BANANA_EMOJI}`);
        }

        // Realiza transferência
        await updateWalletBalance(interaction.user.id, -amount);
        await updateWalletBalance(targetUser.id, amount);

        const newSenderBalance = senderWallet.balance - amount;
        const receiverWallet = await getOrCreateWallet(targetUser.id);

        const embed = new EmbedBuilder()
            .setTitle(`${BANANA_EMOJI} Transferência Realizada!`)
            .setColor(Colors.Green)
            .addFields(
                { 
                    name: "📤 De", 
                    value: interaction.user.toString(), 
                    inline: true 
                },
                { 
                    name: "📥 Para", 
                    value: targetUser.toString(), 
                    inline: true 
                },
                { 
                    name: `${BANANA_EMOJI} Valor`, 
                    value: `**${amount.toLocaleString("pt-BR")}** bananas`, 
                    inline: true 
                },
                { 
                    name: "💰 Seu Novo Saldo", 
                    value: `${newSenderBalance.toLocaleString("pt-BR")} ${BANANA_EMOJI}`, 
                    inline: false 
                }
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Erro na transferência:", error);
        return interaction.editReply("❌ Erro ao realizar transferência.");
    }
}

/**
 * Handler para ranking
 */
async function handleTop(client, interaction) {
    await interaction.deferReply();

    try {
        const topWallets = await Wallet.find({})
            .sort({ balance: -1 })
            .limit(10);

        if (!topWallets || topWallets.length === 0) {
            return interaction.editReply("❌ Nenhum jogador encontrado ainda!");
        }

        const lines = await Promise.all(topWallets.map(async (w, i) => {
            const user = await client.users.fetch(w.odId).catch(() => null);
            const name = user ? user.username : `Usuário ${w.odId.slice(-4)}`;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
            const highlight = w.odId === interaction.user.id ? " ⬅️" : "";
            return `${medal} **${name}** - ${w.balance.toLocaleString("pt-BR")} ${BANANA_EMOJI}${highlight}`;
        }));

        // Encontra posição do usuário se não estiver no top 10
        let userPosition = topWallets.findIndex(w => w.odId === interaction.user.id);
        let userLine = "";
        
        if (userPosition === -1) {
            const userWallet = await getOrCreateWallet(interaction.user.id);
            const position = await Wallet.countDocuments({ balance: { $gt: userWallet.balance } }) + 1;
            userLine = `\n---\n**${position}.** ${interaction.user.username} - ${userWallet.balance.toLocaleString("pt-BR")} ${BANANA_EMOJI} ⬅️`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${BANANA_EMOJI} Top 10 - Minions Bet`)
            .setDescription(lines.join("\n") + userLine)
            .setColor(Colors.Gold)
            .setFooter({ text: "Ranking por saldo de bananas" })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Erro ao buscar ranking:", error);
        return interaction.editReply("❌ Erro ao buscar ranking.");
    }
}

module.exports = command;

