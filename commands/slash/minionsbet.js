const SlashCommand = require("../../lib/SlashCommand");
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    Colors,
    StringSelectMenuBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    MessageFlags
} = require("discord.js");
const fetch = require("node-fetch");
const moment = require("moment-timezone");
const { emojiTag, emojiFor } = require("../../lib/emojis");
const {
    getOrCreateWallet,
    updateWalletBalance,
    createBet,
    getUserBetOnMatch,
    getUserPendingBets,
    getUserBets,
    claimDaily
} = require("../../util/mongodb");

// ===================== BANDEIRAS DE SELEÇÕES =====================

const COUNTRY_FLAGS = {
  "Brazil":"🇧🇷","Argentina":"🇦🇷","Germany":"🇩🇪","France":"🇫🇷","Spain":"🇪🇸","Portugal":"🇵🇹","England":"🏴",
  "Netherlands":"🇳🇱","Italy":"🇮🇹","Belgium":"🇧🇪","Croatia":"🇭🇷","Uruguay":"🇺🇾","Colombia":"🇨🇴","Mexico":"🇲🇽",
  "United States":"🇺🇸","USA":"🇺🇸","Japan":"🇯🇵","South Korea":"🇰🇷","Korea Republic":"🇰🇷","Australia":"🇦🇺",
  "Morocco":"🇲🇦","Senegal":"🇸🇳","Ivory Coast":"🇨🇮","Ghana":"🇬🇭","Nigeria":"🇳🇬","Cameroon":"🇨🇲","Egypt":"🇪🇬",
  "Switzerland":"🇨🇭","Denmark":"🇩🇰","Sweden":"🇸🇪","Poland":"🇵🇱","Türkiye":"🇹🇷","Turkey":"🇹🇷","Serbia":"🇷🇸",
  "Austria":"🇦🇹","Ukraine":"🇺🇦","Wales":"🏴","Scotland":"🏴","Ecuador":"🇪🇨","Paraguay":"🇵🇾","Peru":"🇵🇪",
  "Chile":"🇨🇱","Canada":"🇨🇦","Costa Rica":"🇨🇷","Qatar":"🇶🇦","Saudi Arabia":"🇸🇦","Iran":"🇮🇷","Iraq":"🇮🇶",
  "Tunisia":"🇹🇳","Algeria":"🇩🇿","Curaçao":"🇨🇼","Curacao":"🇨🇼","Panama":"🇵🇦","Honduras":"🇭🇳","Jamaica":"🇯🇲",
  "New Zealand":"🇳🇿","South Africa":"🇿🇦","Norway":"🇳🇴","Greece":"🇬🇷","Czechia":"🇨🇿","Czech Republic":"🇨🇿",
  "Romania":"🇷🇴","Hungary":"🇭🇺","Russia":"🇷🇺","Cape Verde":"🇨🇻","Uzbekistan":"🇺🇿","Jordan":"🇯🇴"
};
function flagFor(teamName) {
  if (!teamName) return "";
  return COUNTRY_FLAGS[teamName] || COUNTRY_FLAGS[teamName.trim()] || "";
}

// ===================== CONFIGURAÇÕES =====================

const BANANA_EMOJI = "🍌";
const MINION_EMOJI = "🟡";
const BET_MIN = 10;
const BET_MAX = 100000;
const MATCHES_PER_PAGE = 4; // Components V2 permite mais flexibilidade

// Cache de odds (para não fazer muitas requisições)
const oddsCache = new Map();
const ODDS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

// Armazena embeds ativos por canal (para deletar quando alguém executar novamente)
const activeBettingEmbeds = new Map(); // channelId -> { message, collector, interval }

// Ligas disponíveis para apostas com mapeamento para The Odds API
const LEAGUES = {
    "bra.1": { name: "Brasileirão Série A", priority: 100, emoji: "🇧🇷", oddsKey: "soccer_brazil_campeonato" },
    "bra.2": { name: "Brasileirão Série B", priority: 90, emoji: "🇧🇷", oddsKey: "soccer_brazil_serie_b" },
    "bra.3": { name: "Brasileirão Série C", priority: 85, emoji: "🇧🇷", oddsKey: null },
    "bra.copa_do_brazil": { name: "Copa do Brasil", priority: 95, emoji: "🇧🇷🏆", oddsKey: null },
    "eng.1": { name: "Premier League", priority: 98, emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", oddsKey: "soccer_epl" },
    "esp.1": { name: "La Liga", priority: 97, emoji: "🇪🇸", oddsKey: "soccer_spain_la_liga" },
    "ita.1": { name: "Serie A", priority: 96, emoji: "🇮🇹", oddsKey: "soccer_italy_serie_a" },
    "ger.1": { name: "Bundesliga", priority: 95, emoji: "🇩🇪", oddsKey: "soccer_germany_bundesliga" },
    "fra.1": { name: "Ligue 1", priority: 94, emoji: "🇫🇷", oddsKey: "soccer_france_ligue_one" },
    "uefa.champions": { name: "Champions League", priority: 110, emoji: "🏆", oddsKey: "soccer_uefa_champs_league" },
    "uefa.europa": { name: "Europa League", priority: 105, emoji: "🏆", oddsKey: "soccer_uefa_europa_league" },
    "fifa.world": { name: "Copa do Mundo FIFA", priority: 130, emoji: "🌍🏆", oddsKey: "soccer_fifa_world_cup" },
    "fifa.friendly": { name: "Amistosos de Seleções", priority: 70, emoji: "🌍", oddsKey: null },
    "fifa.cwc": { name: "Mundial de Clubes", priority: 115, emoji: "🌍", oddsKey: null },
    "fifa.intercontinental_cup": { name: "Copa Intercontinental", priority: 112, emoji: "🌍🏆", oddsKey: null },
    "conmebol.libertadores": { name: "Copa Libertadores", priority: 108, emoji: "🏆", oddsKey: "soccer_conmebol_copa_libertadores" },
    "conmebol.sudamericana": { name: "Copa Sul-Americana", priority: 103, emoji: "🏆", oddsKey: null },
    "arg.1": { name: "Primera División (ARG)", priority: 85, emoji: "🇦🇷", oddsKey: "soccer_argentina_primera_division" },
    "mex.1": { name: "Liga MX", priority: 80, emoji: "🇲🇽", oddsKey: "soccer_mexico_ligamx" },
    "por.1": { name: "Primeira Liga", priority: 88, emoji: "🇵🇹", oddsKey: "soccer_portugal_primeira_liga" },
};

// ===================== COMANDO PRINCIPAL =====================

const command = new SlashCommand()
    .setName("minionsbet")
    .setDescription(`${MINION_EMOJI} Sistema de apostas Minions Bet - Aposte suas bananas!`)
    .addSubcommand(sub =>
        sub.setName("apostar")
            .setDescription("Ver jogos disponíveis para apostar")
    )
    .addSubcommand(sub =>
        sub.setName("saldo")
            .setDescription("Ver seu saldo de bananas")
    )
    .addSubcommand(sub =>
        sub.setName("apostas")
            .setDescription("Ver suas apostas ativas e histórico")
    )
    .addSubcommand(sub =>
        sub.setName("daily")
            .setDescription("Coletar suas bananas diárias (500 🍌)")
    )
    .addSubcommand(sub =>
        sub.setName("ranking")
            .setDescription("Ver ranking de apostadores")
    )
    .setRun(async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case "apostar":
                return handleBetting(client, interaction);
            case "saldo":
                return handleBalance(client, interaction);
            case "apostas":
                return handleMyBets(client, interaction);
            case "daily":
                return handleDaily(client, interaction);
            case "ranking":
                return handleRanking(client, interaction);
            default:
                return interaction.reply({ content: `${emojiTag("error")} Subcomando inválido.`, ephemeral: true });
        }
    });

// ===================== HANDLERS =====================

/**
 * Handler para visualizar e apostar em jogos
 */
async function handleBetting(client, interaction) {
    await interaction.deferReply();

    try {
        const channelId = interaction.channel.id;
        
        // Deleta embed anterior se existir no mesmo canal
        const existingSession = activeBettingEmbeds.get(channelId);
        if (existingSession) {
            try {
                // Para o interval de refresh
                if (existingSession.interval) {
                    clearInterval(existingSession.interval);
                }
                // Para o collector
                if (existingSession.collector) {
                    existingSession.collector.stop("new_command");
                }
                // Deleta a mensagem antiga
                if (existingSession.message) {
                    await existingSession.message.delete().catch(() => {});
                }
            } catch (err) {
                // Ignora erros ao limpar sessão antiga
            }
            activeBettingEmbeds.delete(channelId);
        }
        
        // Busca jogos do dia
        const today = moment().tz("America/Sao_Paulo").format("YYYYMMDD");
        const matches = await fetchBettableMatches(today);

        if (!matches || matches.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${MINION_EMOJI} Minions Bet`)
                .setDescription(`${emojiTag("error")} Nenhum jogo disponível para apostas no momento.\nOs jogos aparecerão aqui quando estiverem agendados!`)
                .setColor(Colors.Yellow)
                .setFooter({ text: "Use /minionsbet saldo para ver suas bananas" });
            
            return interaction.editReply({ embeds: [embed] });
        }

        // Cria embed com página inicial
        const page = 0;
        const { components, useComponentsV2 } = await createBettingEmbed(matches, page);

        const messageOptions = { components };
        if (useComponentsV2) {
            messageOptions.flags = MessageFlags.IsComponentsV2;
        }

        const message = await interaction.editReply(messageOptions);

        // Setup collector
        setupBettingCollector(client, message, interaction, matches);

    } catch (error) {
        console.error("Erro no minionsbet:", error);
        return interaction.editReply(`${emojiTag("error")} Erro ao carregar jogos. Tente novamente mais tarde.`);
    }
}

/**
 * Handler para verificar saldo
 */
async function handleBalance(client, interaction) {
    await interaction.deferReply();

    try {
        const wallet = await getOrCreateWallet(interaction.user.id);
        const pendingBets = await getUserPendingBets(interaction.user.id);

        // Calcula valor em apostas pendentes
        const pendingValue = pendingBets.reduce((sum, bet) => sum + bet.betAmount, 0);
        const potentialWin = pendingBets.reduce((sum, bet) => sum + bet.potentialWin, 0);

        // Calcula taxa de vitória
        const winRate = wallet.totalBets > 0 
            ? ((wallet.winCount / wallet.totalBets) * 100).toFixed(1) 
            : "0.0";

        const embed = new EmbedBuilder()
            .setTitle(`${MINION_EMOJI} Carteira Minions Bet`)
            .setColor(Colors.Yellow)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { 
                    name: `${BANANA_EMOJI} Saldo Disponível`, 
                    value: `**${wallet.balance.toLocaleString("pt-BR")}** bananas`, 
                    inline: true 
                },
                { 
                    name: "🎰 Em Apostas", 
                    value: `**${pendingValue.toLocaleString("pt-BR")}** bananas`, 
                    inline: true 
                },
                {
                    name: `${emojiTag("coins")} Potencial`,
                    value: `**${potentialWin.toLocaleString("pt-BR")}** bananas`,
                    inline: true
                },
                { name: "\u200b", value: "\u200b", inline: false },
                {
                    name: `${emojiTag("stats")} Estatísticas`,
                    value: [
                        `**Total de Apostas:** ${wallet.totalBets}`,
                        `**Vitórias:** ${wallet.winCount} | **Derrotas:** ${wallet.loseCount}`,
                        `**Taxa de Acerto:** ${winRate}%`,
                        `**Total Ganho:** ${wallet.totalWon.toLocaleString("pt-BR")} ${BANANA_EMOJI}`,
                        `**Total Perdido:** ${wallet.totalLost.toLocaleString("pt-BR")} ${BANANA_EMOJI}`,
                        `**Lucro/Prejuízo:** ${(wallet.totalWon - wallet.totalLost).toLocaleString("pt-BR")} ${BANANA_EMOJI}`
                    ].join("\n"),
                    inline: false 
                }
            )
            .setFooter({ text: "Use /minionsbet daily para coletar bananas diárias!" })
            .setTimestamp();

        // Botão para daily se disponível
        const components = [];
        const now = new Date();
        const lastDaily = wallet.lastDaily ? new Date(wallet.lastDaily) : null;
        const canClaim = !lastDaily || (now - lastDaily) >= 24 * 60 * 60 * 1000;

        if (canClaim) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("minionsbet:daily")
                    .setLabel("Coletar Daily (+500)")
                    .setEmoji(BANANA_EMOJI)
                    .setStyle(ButtonStyle.Success)
            );
            components.push(row);
        }

        return interaction.editReply({ embeds: [embed], components });

    } catch (error) {
        console.error("Erro ao verificar saldo:", error);
        return interaction.editReply(`${emojiTag("error")} Erro ao verificar saldo.`);
    }
}

/**
 * Handler para ver apostas do usuário
 */
async function handleMyBets(client, interaction) {
    await interaction.deferReply();

    try {
        const allBets = await getUserBets(interaction.user.id, 15);

        if (!allBets || allBets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${MINION_EMOJI} Suas Apostas`)
                .setDescription("Você ainda não fez nenhuma aposta!\nUse `/minionsbet apostar` para começar.")
                .setColor(Colors.Yellow);

            return interaction.editReply({ embeds: [embed] });
        }

        const pendingBets = allBets.filter(b => b.status === "pending");
        const settledBets = allBets.filter(b => b.status !== "pending");

        const embed = new EmbedBuilder()
            .setTitle(`${MINION_EMOJI} Suas Apostas`)
            .setColor(Colors.Yellow)
            .setTimestamp();

        // Apostas pendentes
        if (pendingBets.length > 0) {
            const pendingText = pendingBets.slice(0, 5).map(bet => {
                const betTypeText = getBetTypeText(bet.betType);
                const date = moment(bet.matchDate).tz("America/Sao_Paulo").format("DD/MM HH:mm");
                return `${emojiTag("expired")} **${bet.homeTeam} vs ${bet.awayTeam}**\n` +
                       `└ ${betTypeText} | ${bet.betAmount.toLocaleString("pt-BR")} ${BANANA_EMOJI} → ${bet.potentialWin.toLocaleString("pt-BR")} ${BANANA_EMOJI} (${bet.odds.toFixed(2)}x)\n` +
                       `└ ${emojiTag("calendar")} ${date}`;
            }).join("\n\n");

            embed.addFields({
                name: `${emojiTag("dice")} Apostas Pendentes (${pendingBets.length})`,
                value: pendingText || "Nenhuma",
                inline: false
            });
        }

        // Histórico (últimas 5)
        if (settledBets.length > 0) {
            const historyText = settledBets.slice(0, 5).map(bet => {
                const betTypeText = getBetTypeText(bet.betType);
                const statusEmoji = bet.status === "won" ? emojiTag("success") : bet.status === "lost" ? emojiTag("error") : "🔄";
                const resultText = bet.result 
                    ? `${bet.result.homeScore}-${bet.result.awayScore}` 
                    : "N/A";
                const profit = bet.status === "won" 
                    ? `+${bet.potentialWin.toLocaleString("pt-BR")}` 
                    : `-${bet.betAmount.toLocaleString("pt-BR")}`;
                
                return `${statusEmoji} **${bet.homeTeam} vs ${bet.awayTeam}** (${resultText})\n` +
                       `└ ${betTypeText} | ${profit} ${BANANA_EMOJI}`;
            }).join("\n\n");

            embed.addFields({
                name: "📜 Histórico Recente",
                value: historyText || "Nenhum",
                inline: false
            });
        }

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Erro ao buscar apostas:", error);
        return interaction.editReply(`${emojiTag("error")} Erro ao buscar suas apostas.`);
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
                .setDescription(`Você recebeu **${result.amount.toLocaleString("pt-BR")}** ${BANANA_EMOJI}!\n\nSeu novo saldo: **${wallet.balance.toLocaleString("pt-BR")}** ${BANANA_EMOJI}`)
                .setColor(Colors.Green)
                .setThumbnail("https://i.imgur.com/GYfYG9e.png") // Banana image
                .setFooter({ text: "Volte amanhã para coletar mais!" })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } else {
            const timeLeft = result.nextClaim 
                ? moment(result.nextClaim).fromNow() 
                : "em breve";

            const embed = new EmbedBuilder()
                .setTitle(`${MINION_EMOJI} Daily Já Coletado!`)
                .setDescription(`Você já coletou seu daily hoje.\n\nPróximo daily disponível **${timeLeft}**.`)
                .setColor(Colors.Red)
                .setFooter({ text: "Volte mais tarde!" });

            return interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error("Erro ao coletar daily:", error);
        return interaction.editReply(`${emojiTag("error")} Erro ao coletar daily.`);
    }
}

/**
 * Handler para ranking
 */
async function handleRanking(client, interaction) {
    await interaction.deferReply();

    try {
        const { Wallet } = require("../../util/mongodb");
        
        // Top 10 por saldo
        const topBalance = await Wallet.find({})
            .sort({ balance: -1 })
            .limit(10);

        // Top 10 por lucro
        const topProfit = await Wallet.aggregate([
            { $addFields: { profit: { $subtract: ["$totalWon", "$totalLost"] } } },
            { $sort: { profit: -1 } },
            { $limit: 10 }
        ]);

        const embed = new EmbedBuilder()
            .setTitle(`${MINION_EMOJI} Ranking Minions Bet`)
            .setColor(Colors.Gold)
            .setTimestamp();

        // Ranking por saldo
        if (topBalance.length > 0) {
            const balanceText = await Promise.all(topBalance.map(async (w, i) => {
                const user = await client.users.fetch(w.odId).catch(() => null);
                const name = user ? user.username : `Usuário ${w.odId.slice(-4)}`;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                return `${medal} **${name}** - ${w.balance.toLocaleString("pt-BR")} ${BANANA_EMOJI}`;
            }));

            embed.addFields({
                name: `${BANANA_EMOJI} Top Saldo`,
                value: balanceText.join("\n") || "Nenhum",
                inline: true
            });
        }

        // Ranking por lucro
        if (topProfit.length > 0) {
            const profitText = await Promise.all(topProfit.map(async (w, i) => {
                const user = await client.users.fetch(w.odId).catch(() => null);
                const name = user ? user.username : `Usuário ${w.odId.slice(-4)}`;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                const profit = w.profit || 0;
                const sign = profit >= 0 ? "+" : "";
                return `${medal} **${name}** - ${sign}${profit.toLocaleString("pt-BR")} ${BANANA_EMOJI}`;
            }));

            embed.addFields({
                name: "📈 Top Lucro",
                value: profitText.join("\n") || "Nenhum",
                inline: true
            });
        }

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Erro ao buscar ranking:", error);
        return interaction.editReply(`${emojiTag("error")} Erro ao buscar ranking.`);
    }
}

// ===================== FUNÇÕES DE EMBED =====================

/**
 * Cria componentes V2 com jogos e botões integrados (tudo dentro de um único Container)
 */
async function createBettingEmbed(matches, page) {
    const totalPages = Math.ceil(matches.length / MATCHES_PER_PAGE);
    const startIdx = page * MATCHES_PER_PAGE;
    const pageMatches = matches.slice(startIdx, startIdx + MATCHES_PER_PAGE);

    // Container principal com cor de destaque (simula embed)
    const mainContainer = new ContainerBuilder()
        .setAccentColor(0xFFD700); // Amarelo/Dourado (cor dos Minions)

    // Header
    mainContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${MINION_EMOJI} Minions Bet\n` +
            `${emojiTag("calendar")} **${moment().tz("America/Sao_Paulo").format("DD/MM/YYYY")}** • Página ${page + 1}/${totalPages}\n` +
            `${emojiTag("stats")} *Odds: Bet365*`
        )
    );

    // Separador após header
    mainContainer.addSeparatorComponents(new SeparatorBuilder());

    // Adiciona cada jogo
    for (let i = 0; i < pageMatches.length; i++) {
        const match = pageMatches[i];
        const globalIdx = startIdx + i;
        const time = moment(match.dateTime).tz("America/Sao_Paulo").format("HH:mm");

        // Calcula odds estimadas
        const odds = match.odds || estimateOdds(match);
        match.odds = odds;
        
        // Determina texto baseado no status do jogo (usa nome completo na embed)
        let matchText;
        let statusEmoji;
        
        // Prefixo de bandeira (apenas seleções; clubes retornam "")
        const homeFlag = flagFor(match.homeTeam);
        const awayFlag = flagFor(match.awayTeam);
        const homePrefix = homeFlag ? `${homeFlag} ` : "";
        const awayPrefix = awayFlag ? `${awayFlag} ` : "";

        if (match.status === "live") {
            // Jogo ao vivo - mostra placar e minuto
            statusEmoji = emojiTag("live");
            const clockDisplay = match.matchClock || match.statusDetail || "AO VIVO";
            matchText = `${statusEmoji} ${homePrefix}**${match.homeTeam}** \`${match.homeScore ?? 0}\` - \`${match.awayScore ?? 0}\` ${awayPrefix}**${match.awayTeam}**\n` +
                       `${emojiTag("expired")} \`${clockDisplay}\` • ${match.leagueEmoji} ${match.leagueName}\n` +
                       `🔒 *Apostas encerradas*`;
        } else if (match.status === "finished") {
            // Jogo finalizado - mostra placar final
            statusEmoji = "🏁";
            matchText = `${statusEmoji} ${homePrefix}**${match.homeTeam}** \`${match.homeScore ?? 0}\` - \`${match.awayScore ?? 0}\` ${awayPrefix}**${match.awayTeam}**\n` +
                       `${emojiTag("success")} \`ENCERRADO\` • ${match.leagueEmoji} ${match.leagueName}\n` +
                       `🔒 *Jogo finalizado*`;
        } else {
            // Jogo agendado - mostra horário e odds
            statusEmoji = emojiTag("expired");
            matchText = `${match.leagueEmoji} ${homePrefix}**${match.homeTeam}** vs ${awayPrefix}**${match.awayTeam}**\n` +
                       `${statusEmoji} \`${time}\` • ${match.leagueName}\n` +
                       `${emojiTag("home")} **${odds.home.toFixed(2)}** | ${emojiTag("draw")} **${odds.draw.toFixed(2)}** | ${emojiTag("away")} **${odds.away.toFixed(2)}**`;
        }

        // Texto do jogo
        mainContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(matchText)
        );

        // Botões sempre presentes, mas desabilitados se não for scheduled
        // Trunca nomes apenas para os botões (limite de caracteres do Discord)
        const homeName = truncateTeamName(match.homeTeam);
        const awayName = truncateTeamName(match.awayTeam);
        const isDisabled = match.status !== "scheduled";

        mainContainer.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`bet:${match.id}:home`)
                    .setLabel(isDisabled ? homeName : `${homeName} (${odds.home.toFixed(2)}x)`)
                    .setStyle(isDisabled ? ButtonStyle.Secondary : ButtonStyle.Success)
                    .setEmoji(emojiFor("home"))
                    .setDisabled(isDisabled),
                new ButtonBuilder()
                    .setCustomId(`bet:${match.id}:draw`)
                    .setLabel(isDisabled ? "Empate" : `Empate (${odds.draw.toFixed(2)}x)`)
                    .setStyle(isDisabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    .setEmoji(emojiFor("draw"))
                    .setDisabled(isDisabled),
                new ButtonBuilder()
                    .setCustomId(`bet:${match.id}:away`)
                    .setLabel(isDisabled ? awayName : `${awayName} (${odds.away.toFixed(2)}x)`)
                    .setStyle(isDisabled ? ButtonStyle.Secondary : ButtonStyle.Success)
                    .setEmoji(emojiFor("away"))
                    .setDisabled(isDisabled)
            )
        );

        // Separador entre jogos (não no último)
        if (i < pageMatches.length - 1) {
            mainContainer.addSeparatorComponents(new SeparatorBuilder());
        }
    }

    // Separador antes da navegação
    mainContainer.addSeparatorComponents(new SeparatorBuilder());

    // Botões de navegação
    mainContainer.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`betpage:${page - 1}`)
                .setEmoji("⬅️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`betpage:refresh`)
                .setEmoji("🔄")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`betpage:${page + 1}`)
                .setEmoji("➡️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1)
        )
    );

    return { components: [mainContainer], useComponentsV2: true };
}

// ===================== COLLECTOR =====================

/**
 * Configura collector para interações - QUALQUER USUÁRIO pode apostar
 * Retorna { collector, interval } para controle externo
 */
function setupBettingCollector(client, message, interaction, matches) {
    const channelId = interaction.channel.id;
    
    const collector = message.createMessageComponentCollector({
        // Sem filtro de usuário - qualquer um pode interagir
        // Sem limite de tempo - fica ativo até novo comando ou bot reiniciar
    });

    // Auto-refresh para jogos ao vivo (a cada 60 segundos)
    let liveRefreshInterval = null;
    let currentPage = 0;
    
    const startLiveRefresh = () => {
        if (liveRefreshInterval) return; // Já está ativo
        
        liveRefreshInterval = setInterval(async () => {
            try {
                // Verifica se ainda há jogos ao vivo
                const hasLiveMatches = matches.some(m => m.status === "live");
                
                if (!hasLiveMatches) {
                    // Não há jogos ao vivo, para o refresh
                    if (liveRefreshInterval) {
                        clearInterval(liveRefreshInterval);
                        liveRefreshInterval = null;
                    }
                    return;
                }
                
                // Recarrega dados
                const today = moment().tz("America/Sao_Paulo").format("YYYYMMDD");
                const freshMatches = await fetchBettableMatches(today);
                
                const { components, useComponentsV2 } = await createBettingEmbed(freshMatches, currentPage);
                const updateOptions = { components };
                if (useComponentsV2) {
                    updateOptions.flags = MessageFlags.IsComponentsV2;
                }
                
                await message.edit(updateOptions).catch(() => {});
                
                // Atualiza referências
                matches.length = 0;
                matches.push(...freshMatches);
                
                // Verifica se agora tem jogos ao vivo
                const stillHasLive = freshMatches.some(m => m.status === "live");
                if (!stillHasLive && liveRefreshInterval) {
                    clearInterval(liveRefreshInterval);
                    liveRefreshInterval = null;
                }
            } catch (err) {
                console.error("Erro no live refresh:", err);
            }
        }, 60000); // 60 segundos
    };

    collector.on("collect", async (componentInteraction) => {
        try {
            const [action, param, param2] = componentInteraction.customId.split(":");
            const userId = componentInteraction.user.id; // Usuário que clicou

            // Navegação de página - qualquer um pode navegar
            if (action === "betpage") {
                if (param === "refresh") {
                    // Recarrega dados
                    const today = moment().tz("America/Sao_Paulo").format("YYYYMMDD");
                    const freshMatches = await fetchBettableMatches(today);
                    
                    currentPage = 0; // Reset para página 0 no refresh
                    const { components, useComponentsV2 } = await createBettingEmbed(freshMatches, currentPage);
                    const updateOptions = { components };
                    if (useComponentsV2) {
                        updateOptions.flags = MessageFlags.IsComponentsV2;
                    }
                    await componentInteraction.update(updateOptions);
                    
                    // Atualiza referências
                    matches.length = 0;
                    matches.push(...freshMatches);
                    
                    // Inicia/para live refresh baseado nos novos dados
                    const session = activeBettingEmbeds.get(channelId);
                    if (freshMatches.some(m => m.status === "live")) {
                        startLiveRefresh();
                        if (session) session.interval = liveRefreshInterval;
                    } else if (liveRefreshInterval) {
                        clearInterval(liveRefreshInterval);
                        liveRefreshInterval = null;
                        if (session) session.interval = null;
                    }
                } else {
                    const newPage = parseInt(param);
                    currentPage = newPage; // Atualiza página atual
                    const { components, useComponentsV2 } = await createBettingEmbed(matches, newPage);
                    const updateOptions = { components };
                    if (useComponentsV2) {
                        updateOptions.flags = MessageFlags.IsComponentsV2;
                    }
                    await componentInteraction.update(updateOptions);
                }
                return;
            }

            // Clicou para apostar - busca wallet do usuário que clicou
            if (action === "bet") {
                const matchId = param;
                const betType = param2; // home, draw, away
                const match = matches.find(m => String(m.id) === String(matchId));

                if (!match) {
                    return componentInteraction.reply({ content: `${emojiTag("error")} Jogo não encontrado.`, ephemeral: true });
                }

                // Busca wallet do usuário que clicou
                const userWallet = await getOrCreateWallet(userId);

                // Verifica se já apostou
                const existingBet = await getUserBetOnMatch(userId, match.id);
                if (existingBet) {
                    return componentInteraction.reply({ content: `${emojiTag("error")} Você já apostou neste jogo!`, ephemeral: true });
                }

                // Calcula odds
                const odds = match.odds || estimateOdds(match);
                const selectedOdds = odds[betType];

                // Cria modal para valor da aposta
                const modal = new ModalBuilder()
                    .setCustomId(`betmodal:${match.id}:${betType}:${selectedOdds}`)
                    .setTitle(`${MINION_EMOJI} Apostar em ${getBetTypeTextShort(betType, match)}`);

                const amountInput = new TextInputBuilder()
                    .setCustomId("amount")
                    .setLabel(`Quanto apostar? (Saldo: ${userWallet.balance.toLocaleString("pt-BR")} 🍌)`)
                    .setPlaceholder(`Mínimo: ${BET_MIN} | Máximo: ${Math.min(BET_MAX, userWallet.balance)}`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(10);

                const row = new ActionRowBuilder().addComponents(amountInput);
                modal.addComponents(row);

                await componentInteraction.showModal(modal);
            }

            // Daily button
            if (action === "minionsbet" && param === "daily") {
                const result = await claimDaily(userId);
                
                if (result.success) {
                    const freshWallet = await getOrCreateWallet(userId);
                    await componentInteraction.reply({
                        content: `${emojiTag("success")} Você coletou **${result.amount}** ${BANANA_EMOJI}!\nNovo saldo: **${freshWallet.balance.toLocaleString("pt-BR")}** ${BANANA_EMOJI}`,
                        ephemeral: true
                    });
                } else {
                    const timeLeft = result.nextClaim ? moment(result.nextClaim).fromNow() : "em breve";
                    await componentInteraction.reply({
                        content: `${emojiTag("error")} Você já coletou seu daily! Próximo: **${timeLeft}**`,
                        ephemeral: true
                    });
                }
            }

        } catch (error) {
            console.error("Erro no collector de apostas:", error);
            await componentInteraction.reply({
                content: `${emojiTag("error")} Erro ao processar. Tente novamente.`,
                ephemeral: true
            }).catch(() => {});
        }
    });

    collector.on("end", (collected, reason) => {
        // Limpa interval de live refresh
        if (liveRefreshInterval) {
            clearInterval(liveRefreshInterval);
            liveRefreshInterval = null;
        }
        
        // Remove do mapa de sessões ativas
        activeBettingEmbeds.delete(channelId);
        
        // Só edita a mensagem se não foi deletada por novo comando
        if (reason !== "new_command") {
            message.edit({ 
                components: [],
                flags: MessageFlags.IsComponentsV2 
            }).catch(() => {});
        }
    });
    
    // Armazena sessão ativa no mapa
    const session = {
        message,
        collector,
        interval: null
    };
    activeBettingEmbeds.set(channelId, session);
    
    // Inicia refresh se houver jogos ao vivo e atualiza referência
    if (matches.some(m => m.status === "live")) {
        startLiveRefresh();
        session.interval = liveRefreshInterval;
    }
}

// ===================== FUNÇÕES AUXILIARES =====================

/**
 * Busca jogos do dia (todos os status: scheduled, live, finished)
 */
async function fetchBettableMatches(date) {
    const allMatches = [];
    
    // Busca jogos de todas as ligas
    const promises = Object.keys(LEAGUES).map(async (leagueId) => {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${date}`;
            const response = await fetch(url, { timeout: 10000 });
            
            if (!response.ok) return [];
            
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) return [];
            
            // Retorna todos os jogos (não filtra por status)
            return data.events
                .map(event => parseMatch(event, leagueId))
                .filter(m => m.status !== "postponed" && m.status !== "cancelled");
        } catch (err) {
            console.error(`Erro ao buscar liga ${leagueId}:`, err.message);
            return [];
        }
    });
    
    const results = await Promise.all(promises);
    results.forEach(matches => allMatches.push(...matches));
    
    // Busca odds reais para cada liga que temos
    const uniqueLeagues = [...new Set(allMatches.map(m => m.leagueId))];
    const oddsPromises = uniqueLeagues.map(async (leagueId) => {
        const oddsKey = LEAGUES[leagueId]?.oddsKey;
        if (oddsKey) {
            const oddsMap = await fetchOddsFromAPI(oddsKey);
            return { leagueId, oddsMap };
        }
        return { leagueId, oddsMap: new Map() };
    });
    
    const oddsResults = await Promise.all(oddsPromises);
    const oddsByLeague = new Map(oddsResults.map(r => [r.leagueId, r.oddsMap]));
    
    // Anexa odds a cada jogo
    for (const match of allMatches) {
        const oddsMap = oddsByLeague.get(match.leagueId);
        match.odds = getOddsForMatch(match, oddsMap);
    }
    
    // Ordena: por horário (quem joga primeiro)
    // Dentro do mesmo horário: scheduled > live > finished
    const statusPriority = { "scheduled": 0, "live": 1, "finished": 2 };
    
    return allMatches.sort((a, b) => {
        // Primeiro ordena por horário
        const timeA = new Date(a.dateTime).getTime();
        const timeB = new Date(b.dateTime).getTime();
        if (timeA !== timeB) return timeA - timeB;
        
        // Depois por status
        const statusA = statusPriority[a.status] ?? 3;
        const statusB = statusPriority[b.status] ?? 3;
        return statusA - statusB;
    });
}

/**
 * Parse de uma partida da ESPN
 */
function parseMatch(event, leagueId) {
    const competition = event.competitions?.[0];
    const status = event.status;
    
    const homeTeamData = competition?.competitors?.find(c => c.homeAway === "home");
    const awayTeamData = competition?.competitors?.find(c => c.homeAway === "away");
    
    let matchStatus = "scheduled";
    let matchClock = null;
    let statusDetail = null;
    
    if (status?.type) {
        const statusType = status.type.name;
        statusDetail = status.type.shortDetail || status.type.detail || null;
        
        if (statusType === "STATUS_SCHEDULED") {
            matchStatus = "scheduled";
        } else if (statusType.includes("IN_PROGRESS") || statusType.includes("HALF")) {
            matchStatus = "live";
            // Pega o minuto do jogo
            matchClock = status.displayClock || null;
        } else if (statusType.includes("FINAL") || statusType.includes("FULL_TIME")) {
            matchStatus = "finished";
        } else if (statusType.includes("POSTPONED")) {
            matchStatus = "postponed";
        } else if (statusType.includes("CANCEL")) {
            matchStatus = "cancelled";
        }
    }
    
    return {
        id: event.id,
        leagueId: leagueId,
        leagueName: LEAGUES[leagueId]?.name || "Liga",
        leagueEmoji: LEAGUES[leagueId]?.emoji || "⚽",
        homeTeam: homeTeamData?.team?.displayName || homeTeamData?.team?.name || "TBA",
        awayTeam: awayTeamData?.team?.displayName || awayTeamData?.team?.name || "TBA",
        homeScore: homeTeamData?.score ?? null,
        awayScore: awayTeamData?.score ?? null,
        dateTime: event.date,
        status: matchStatus,
        matchClock: matchClock,
        statusDetail: statusDetail,
        odds: null // Será preenchido com odds estimadas ou da API
    };
}

/**
 * Trunca nome do time para caber nos botões
 */
function truncateTeamName(name) {
    if (name.length <= 12) return name;
    return name.substring(0, 10) + "..";
}

/**
 * Busca odds reais da The Odds API
 * @param {string} oddsKey - Chave da liga na The Odds API
 * @returns {Promise<Map>} - Map de odds por jogo
 */
async function fetchOddsFromAPI(oddsKey) {
    if (!oddsKey) return new Map();
    
    // Verifica cache
    const cacheKey = `odds:${oddsKey}`;
    const cached = oddsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ODDS_CACHE_DURATION) {
        return cached.data;
    }
    
    try {
        // Pega a API key do config
        const config = require("../../config");
        const apiKey = config.oddsApiKey;
        
        if (!apiKey || apiKey === "SUA_API_KEY_AQUI") {
            console.log("[MinionssBet] Odds API key não configurada");
            return new Map();
        }
        
        // Endpoint correto conforme documentação: https://the-odds-api.com/liveapi/guides/v4/
        // GET /v4/sports/{sport}/odds?apiKey={apiKey}&regions={regions}&markets={markets}&oddsFormat={oddsFormat}
        const url = `https://api.the-odds-api.com/v4/sports/${oddsKey}/odds?apiKey=${apiKey}&regions=uk,eu&markets=h2h&oddsFormat=decimal`;
        
        console.log(`[MinionsBet] Buscando odds: ${oddsKey}`);
        
        const response = await fetch(url, { timeout: 15000 });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            console.error(`[MinionsBet] Odds API error ${response.status}: ${errorText}`);
            return new Map();
        }
        
        const data = await response.json();
        
        // Log headers de uso da API
        const remaining = response.headers.get("x-requests-remaining");
        const used = response.headers.get("x-requests-used");
        if (remaining) {
            console.log(`[MinionsBet] API quota: ${used} usado, ${remaining} restante`);
        }
        
        const oddsMap = new Map();
        
        // Processa cada jogo retornado
        for (const game of data) {
            if (!game.bookmakers || game.bookmakers.length === 0) continue;
            
            const homeTeam = normalizeTeamName(game.home_team);
            const awayTeam = normalizeTeamName(game.away_team);
            
            // Prioriza Bet365, senão pega primeiro disponível
            let bookmaker = game.bookmakers.find(b => b.key === "bet365");
            if (!bookmaker) {
                // Fallback: pinnacle, unibet, ou primeiro disponível
                bookmaker = game.bookmakers.find(b => b.key === "pinnacle") ||
                           game.bookmakers.find(b => b.key === "unibet") ||
                           game.bookmakers[0];
            }
            if (!bookmaker) continue;
            
            // Busca mercado h2h (head-to-head / 1x2)
            const market = bookmaker.markets?.find(m => m.key === "h2h");
            if (!market || !market.outcomes) continue;
            
            const outcomes = market.outcomes;
            
            // Inicializa odds com valores padrão
            let homeOdds = null, drawOdds = null, awayOdds = null;
            
            // Processa cada outcome
            for (const outcome of outcomes) {
                const name = outcome.name;
                const price = outcome.price;
                
                if (name === game.home_team) {
                    homeOdds = price;
                } else if (name === game.away_team) {
                    awayOdds = price;
                } else if (name.toLowerCase() === "draw") {
                    drawOdds = price;
                }
            }
            
            // Verifica se tem odds válidas (pelo menos home e away)
            if (homeOdds === null || awayOdds === null) continue;
            
            // Draw pode ser null em alguns esportes, mas futebol sempre tem
            if (drawOdds === null) drawOdds = 3.5; // Fallback
            
            // Usa múltiplas chaves para melhor matching
            const key1 = `${homeTeam}:${awayTeam}`;
            const key2 = `${game.home_team}:${game.away_team}`.toLowerCase();
            const key3 = `${game.id}`; // ID único do jogo
            
            const oddsData = {
                home: parseFloat(homeOdds.toFixed(2)),
                draw: parseFloat(drawOdds.toFixed(2)),
                away: parseFloat(awayOdds.toFixed(2)),
                source: bookmaker.key === "bet365" ? "bet365" : "api",
                bookmaker: bookmaker.title,
                gameId: game.id,
                commenceTime: game.commence_time
            };
            
            oddsMap.set(key1, oddsData);
            oddsMap.set(key2, oddsData);
            oddsMap.set(key3, oddsData);
        }
        
        // Salva no cache
        oddsCache.set(cacheKey, { data: oddsMap, timestamp: Date.now() });
        
        const bookmakerName = data[0]?.bookmakers?.find(b => b.key === "bet365")?.title || "API";
        console.log(`[MinionsBet] ✅ ${oddsMap.size / 3} jogos com odds de ${bookmakerName} para ${oddsKey}`);
        return oddsMap;
        
    } catch (error) {
        console.error(`[MinionsBet] Erro ao buscar odds:`, error.message);
        return new Map();
    }
}

/**
 * Normaliza nome do time para comparação
 */
function normalizeTeamName(name) {
    if (!name) return "";
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

/**
 * Obtém odds para um jogo (API real ou estimada)
 * @param {object} match - Dados do jogo
 * @param {Map} oddsMap - Map de odds da API (opcional)
 * @returns {object} - { home, draw, away, source }
 */
function getOddsForMatch(match, oddsMap = null) {
    if (oddsMap && oddsMap.size > 0) {
        // Tenta encontrar odds reais (homeTeam e awayTeam agora têm nome completo)
        const homeNorm = normalizeTeamName(match.homeTeam);
        const awayNorm = normalizeTeamName(match.awayTeam);
        
        // Tenta várias combinações
        const keys = [
            `${homeNorm}:${awayNorm}`,
            `${match.homeTeam}:${match.awayTeam}`.toLowerCase()
        ];
        
        for (const key of keys) {
            if (oddsMap.has(key)) {
                return oddsMap.get(key);
            }
        }
        
        // Busca parcial por nome do time
        for (const [mapKey, odds] of oddsMap) {
            if (mapKey.includes(homeNorm) && mapKey.includes(awayNorm)) {
                return odds;
            }
        }
    }
    
    // Fallback: odds estimadas
    return estimateFallbackOdds();
}

/**
 * Estima odds quando não há dados da API
 */
function estimateFallbackOdds() {
    // Odds base com variação
    const variation = () => (Math.random() * 0.4 - 0.2);
    
    let homeOdds = 2.0 + variation();
    let drawOdds = 3.2 + variation();
    let awayOdds = 3.5 + variation();
    
    // Garante odds mínimas
    homeOdds = Math.max(1.1, homeOdds);
    drawOdds = Math.max(1.1, drawOdds);
    awayOdds = Math.max(1.1, awayOdds);
    
    return {
        home: parseFloat(homeOdds.toFixed(2)),
        draw: parseFloat(drawOdds.toFixed(2)),
        away: parseFloat(awayOdds.toFixed(2)),
        source: "estimated"
    };
}

/**
 * Wrapper para compatibilidade - usa API quando disponível
 */
function estimateOdds(match) {
    // Se match já tem odds da Bet365/API, usa elas
    if (match.odds && (match.odds.source === "bet365" || match.odds.source === "api")) {
        return match.odds;
    }
    return estimateFallbackOdds();
}

/**
 * Texto do tipo de aposta
 */
function getBetTypeText(betType) {
    switch (betType) {
        case "home": return `${emojiTag("home")} Vitória Casa`;
        case "draw": return `${emojiTag("draw")} Empate`;
        case "away": return `${emojiTag("away")} Vitória Fora`;
        default: return betType;
    }
}

/**
 * Texto curto do tipo de aposta
 */
function getBetTypeTextShort(betType, match) {
    switch (betType) {
        case "home": return match.homeTeam;
        case "draw": return "Empate";
        case "away": return match.awayTeam;
        default: return betType;
    }
}

module.exports = command;

