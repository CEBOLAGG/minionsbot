const Controller = require("../util/Controller");
const yt = require("youtube-sr").default;
const FilterSelector = require("../util/FilterSelector");
const VolumeSelector = require("../util/VolumeSelector");
const QueueNavigator = require("../util/QueueNavigator");
const { EmbedBuilder, Colors } = require("discord.js");
const {
    getOrCreateWallet,
    updateWalletBalance,
    createBet,
    getUserBetOnMatch
} = require("../util/mongodb");
const { handleButton } = require("../lib/download/buttons");

/**
 *
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {import("discord.js").Interaction}interaction
 */
module.exports = async (client, interaction) => {
    if (interaction.isChatInputCommand()) {
        let command = client.slashCommands.find(
            (x) => x.name == interaction.commandName,
        );
        if (!command || !command.run) {
            return interaction.reply(
                "Sorry the command you used doesn't have any run function",
            );
        }
        client.commandsRan++;
        command.run(client, interaction, interaction.options);
        return;
    }

    // ===================== DOWNLOAD: botoes dl:/pk: =====================
    if (interaction.isButton() && (interaction.customId.startsWith("dl:") || interaction.customId.startsWith("pk:"))) {
        try { return await handleButton(interaction); } catch (e) { console.error("[download] botao:", e); return; }
    }

    // ===================== MODAL HANDLER: MINIONS BET =====================
    if (interaction.isModalSubmit() && interaction.customId.startsWith("betmodal:")) {
        await handleBetModal(client, interaction);
        return;
    }

    // Modal handler para busca de música
    if (interaction.isModalSubmit() && interaction.customId.startsWith("searchMusic:")) {
        const guildId = interaction.customId.split(":")[1];
        const searchQuery = interaction.fields.getTextInputValue('searchQuery');
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // Verificar se o usuário está em um canal de voz
            if (!interaction.member.voice.channel) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription("❌ | **Você precisa estar em um canal de voz!**")
                    ]
                });
            }
            
            // Obter ou criar o player
            let player = client.manager.players.get(guildId);
            
            if (!player) {
                player = client.createPlayer(interaction.channel, interaction.member.voice.channel);
            }
            
            // Buscar a música
            const result = await client.manager.resolve({ query: searchQuery, requester: interaction.user });
            
            if (!result || result.loadType === "empty" || result.loadType === "error") {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setDescription("❌ | **Nenhum resultado encontrado para:** `" + searchQuery + "`")
                    ]
                });
            }
            
            if (result.loadType === "playlist") {
                // Adicionar playlist inteira
                for (const track of result.tracks) {
                    track.info.requester = interaction.user;
                    player.queue.add(track);
                }
                
                // Se não estiver tocando, iniciar
                if (!player.playing && !player.paused) {
                    player.play();
                }
                
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(client.config.embedColor)
                            .setDescription(`✅ | **Playlist adicionada:** \`${result.playlistInfo.name}\`\n📋 **${result.tracks.length}** músicas adicionadas à fila!`)
                    ]
                });
            } else {
                // Adicionar música única
                const track = result.tracks[0];
                track.info.requester = interaction.user;
                player.queue.add(track);
                
                // Se não estiver tocando, iniciar
                if (!player.playing && !player.paused) {
                    player.play();
                    
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(client.config.embedColor)
                                .setDescription(`🎵 | **Tocando agora:** [${track.info.title}](${track.info.uri})`)
                        ]
                    });
                } else {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(client.config.embedColor)
                                .setDescription(`✅ | **Adicionado à fila:** [${track.info.title}](${track.info.uri})\n📋 Posição na fila: **#${player.queue.length}**`)
                        ]
                    });
                }
            }
        } catch (error) {
            console.error("Search modal error:", error);
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription("❌ | **Erro ao buscar música.** Tente novamente.")
                ]
            });
        }
    }

    // Select Menu handlers
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith("filters:")) {
        return FilterSelector(client, interaction);
        }
        if (interaction.customId.startsWith("volume:")) {
            return VolumeSelector(client, interaction);
        }
    }

    // Button handlers para navegação (queue)
    if (interaction.isButton() && interaction.customId.startsWith("queue:")) {
        return QueueNavigator(client, interaction);
    }

    if (interaction.isContextMenuCommand()) {
        let command = client.contextCommands.find(
            (x) => x.command.name == interaction.commandName,
        );
        if (!command || !command.run) {
            return interaction.reply(
                "Sorry the command you used doesn't have any run function",
            );
        }
        client.commandsRan++;
        command.run(client, interaction, interaction.options);
        return;
    }

    if (interaction.isButton()) {
        if (interaction.customId.startsWith("controller")) {
            return Controller(client, interaction);
        }
    }

    if (interaction.isAutocomplete()) {
        const url = interaction.options.getString("query")
        if (url === "") return;

        const match = [
            /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(-nocookie)?\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/,
            /^(?:spotify:|https:\/\/[a-z]+\.spotify\.com\/(track\/|user\/(.*)\/playlist\/|playlist\/))(.*)$/,
            /^https?:\/\/(?:www\.)?deezer\.com\/[a-z]+\/(track|album|playlist)\/(\d+)$/,
            /^(?:(https?):\/\/)?(?:(?:www|m)\.)?(soundcloud\.com|snd\.sc)\/(.*)$/,
            /(?:https:\/\/music\.apple\.com\/)(?:.+)?(artist|album|music-video|playlist)\/([\w\-\.]+(\/)+[\w\-\.]+|[^&]+)\/([\w\-\.]+(\/)+[\w\-\.]+|[^&]+)/
        ].some(function (match) {
            return match.test(url) == true;
        });

        async function checkRegex() {
            if (match == true) {
                let choice = []
                choice.push({ name: url, value: url })
                await interaction.respond(choice).catch(() => { });
            }
        }

        const Random = "ytsearch"[Math.floor(Math.random() * "ytsearch".length)];

        if (interaction.commandName == "play") {
            checkRegex()
            let choice = []
            await yt.search(url || Random, { safeSearch: false, limit: 25 }).then(result => {
                result.forEach(x => { choice.push({ name: x.title, value: x.url }) })
            });
            return await interaction.respond(choice).catch(() => { });
        } else if (result.loadType === "LOAD_FAILED" || "NO_MATCHES")
            return;
    }
};

// ===================== MINIONS BET MODAL HANDLER =====================

const fetch = require("node-fetch");
const moment = require("moment-timezone");

const BANANA_EMOJI = "🍌";
const MINION_EMOJI = "🟡";
const BET_MIN = 10;
const BET_MAX = 100000;

const LEAGUES = {
    "bra.1": { name: "Brasileirão Série A", emoji: "🇧🇷" },
    "bra.2": { name: "Brasileirão Série B", emoji: "🇧🇷" },
    "bra.3": { name: "Copa do Brasil", emoji: "🇧🇷" },
    "eng.1": { name: "Premier League", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    "esp.1": { name: "La Liga", emoji: "🇪🇸" },
    "ita.1": { name: "Serie A", emoji: "🇮🇹" },
    "ger.1": { name: "Bundesliga", emoji: "🇩🇪" },
    "fra.1": { name: "Ligue 1", emoji: "🇫🇷" },
    "uefa.champions": { name: "Champions League", emoji: "🏆" },
    "uefa.europa": { name: "Europa League", emoji: "🏆" },
    "conmebol.libertadores": { name: "Copa Libertadores", emoji: "🏆" },
    "conmebol.sudamericana": { name: "Copa Sul-Americana", emoji: "🏆" },
    "arg.1": { name: "Primera División (ARG)", emoji: "🇦🇷" },
    "mex.1": { name: "Liga MX", emoji: "🇲🇽" },
    "por.1": { name: "Primeira Liga", emoji: "🇵🇹" },
};

/**
 * Handler para modal de aposta
 */
async function handleBetModal(client, interaction) {
    // betmodal:matchId:betType:odds
    const [, matchId, betType, oddsStr] = interaction.customId.split(":");
    const odds = parseFloat(oddsStr);
    
    // Pega o valor da aposta do modal
    const amountStr = interaction.fields.getTextInputValue("amount");
    const amount = parseInt(amountStr.replace(/\D/g, "")); // Remove não-numéricos
    
    // Validações
    if (isNaN(amount) || amount <= 0) {
        return interaction.reply({
            content: "❌ Valor inválido! Digite apenas números.",
            ephemeral: true
        });
    }
    
    if (amount < BET_MIN) {
        return interaction.reply({
            content: `❌ Aposta mínima: **${BET_MIN}** ${BANANA_EMOJI}`,
            ephemeral: true
        });
    }
    
    if (amount > BET_MAX) {
        return interaction.reply({
            content: `❌ Aposta máxima: **${BET_MAX.toLocaleString("pt-BR")}** ${BANANA_EMOJI}`,
            ephemeral: true
        });
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        // Verifica saldo
        const wallet = await getOrCreateWallet(interaction.user.id);
        
        if (wallet.balance < amount) {
            return interaction.editReply({
                content: `❌ Saldo insuficiente!\nVocê tem **${wallet.balance.toLocaleString("pt-BR")}** ${BANANA_EMOJI} mas tentou apostar **${amount.toLocaleString("pt-BR")}** ${BANANA_EMOJI}`,
            });
        }
        
        // Busca dados do jogo novamente para garantir atualização.
        // Resolve por ID estável (não por índice): entre o clique do botão e o envio
        // do modal o array pode reordenar/refetchar, o que apostava no jogo errado.
        const today = moment().tz("America/Sao_Paulo").format("YYYYMMDD");
        const matches = await fetchBettableMatchesForModal(today);
        const match = matches?.find(m => String(m.id) === String(matchId));

        if (!match) {
            return interaction.editReply({
                content: "❌ Jogo não encontrado ou já começou!",
            });
        }
        
        // Verifica se jogo não começou
        if (match.status !== "scheduled") {
            return interaction.editReply({
                content: "❌ Este jogo já começou! Não é possível apostar.",
            });
        }
        
        // Verifica se já apostou
        const existingBet = await getUserBetOnMatch(interaction.user.id, match.id);
        if (existingBet) {
            return interaction.editReply({
                content: "❌ Você já apostou neste jogo!",
            });
        }
        
        // Calcula ganho potencial
        const potentialWin = Math.floor(amount * odds);
        
        // Deduz do saldo
        await updateWalletBalance(interaction.user.id, -amount);
        
        // Cria aposta
        const bet = await createBet({
            odId: interaction.user.id,
            odGuildId: interaction.guildId,
            channelId: interaction.channelId,
            matchId: match.id,
            leagueId: match.leagueId,
            homeTeam: match.homeTeamFull || match.homeTeam,
            awayTeam: match.awayTeamFull || match.awayTeam,
            matchDate: new Date(match.dateTime),
            betType: betType,
            betAmount: amount,
            odds: odds,
            potentialWin: potentialWin,
            status: "pending"
        });
        
        if (!bet) {
            // Reembolsa se falhou
            await updateWalletBalance(interaction.user.id, amount);
            return interaction.editReply({
                content: "❌ Erro ao registrar aposta. Tente novamente.",
            });
        }
        
        // Texto do tipo de aposta
        const betTypeText = getBetTypeTextForModal(betType, match);
        const matchTime = moment(match.dateTime).tz("America/Sao_Paulo").format("DD/MM HH:mm");
        
        const newBalance = wallet.balance - amount;
        
        const embed = new EmbedBuilder()
            .setTitle(`${MINION_EMOJI} Aposta Confirmada!`)
            .setColor(Colors.Green)
            .setDescription(`Sua aposta foi registrada com sucesso!`)
            .addFields(
                { 
                    name: "⚽ Jogo", 
                    value: `**${match.homeTeam}** vs **${match.awayTeam}**\n${match.leagueEmoji} ${match.leagueName}`, 
                    inline: false 
                },
                { 
                    name: "🎯 Aposta", 
                    value: betTypeText, 
                    inline: true 
                },
                { 
                    name: "💰 Valor", 
                    value: `${amount.toLocaleString("pt-BR")} ${BANANA_EMOJI}`, 
                    inline: true 
                },
                { 
                    name: "📊 Odds", 
                    value: `${odds.toFixed(2)}x`, 
                    inline: true 
                },
                { 
                    name: "🏆 Ganho Potencial", 
                    value: `**${potentialWin.toLocaleString("pt-BR")}** ${BANANA_EMOJI}`, 
                    inline: true 
                },
                { 
                    name: "📅 Início", 
                    value: matchTime, 
                    inline: true 
                },
                { 
                    name: `${BANANA_EMOJI} Novo Saldo`, 
                    value: `${newBalance.toLocaleString("pt-BR")} bananas`, 
                    inline: true 
                }
            )
            .setFooter({ text: "Boa sorte! Os resultados serão processados automaticamente." })
            .setTimestamp();
        
        return interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        console.error("Erro ao processar aposta:", error);
        return interaction.editReply({
            content: "❌ Erro ao processar aposta. Tente novamente.",
        });
    }
}

/**
 * Busca jogos para o modal
 */
async function fetchBettableMatchesForModal(date) {
    const allMatches = [];
    
    const promises = Object.keys(LEAGUES).map(async (leagueId) => {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${date}`;
            const response = await fetch(url, { timeout: 10000 });
            
            if (!response.ok) return [];
            
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) return [];
            
            return data.events
                .map(event => parseMatchForModal(event, leagueId))
                .filter(m => m.status === "scheduled");
        } catch (err) {
            return [];
        }
    });
    
    const results = await Promise.all(promises);
    results.forEach(matches => allMatches.push(...matches));
    
    return allMatches.sort((a, b) => {
        return new Date(a.dateTime) - new Date(b.dateTime);
    });
}

/**
 * Parse de partida para modal
 */
function parseMatchForModal(event, leagueId) {
    const competition = event.competitions?.[0];
    const status = event.status;
    
    const homeTeamData = competition?.competitors?.find(c => c.homeAway === "home");
    const awayTeamData = competition?.competitors?.find(c => c.homeAway === "away");
    
    let matchStatus = "scheduled";
    
    if (status?.type) {
        const statusType = status.type.name;
        if (statusType === "STATUS_SCHEDULED") {
            matchStatus = "scheduled";
        } else {
            matchStatus = "started";
        }
    }
    
    return {
        id: event.id,
        leagueId: leagueId,
        leagueName: LEAGUES[leagueId]?.name || "Liga",
        leagueEmoji: LEAGUES[leagueId]?.emoji || "⚽",
        homeTeam: homeTeamData?.team?.shortDisplayName || homeTeamData?.team?.name || "TBA",
        awayTeam: awayTeamData?.team?.shortDisplayName || awayTeamData?.team?.name || "TBA",
        homeTeamFull: homeTeamData?.team?.displayName || homeTeamData?.team?.name || "TBA",
        awayTeamFull: awayTeamData?.team?.displayName || awayTeamData?.team?.name || "TBA",
        dateTime: event.date,
        status: matchStatus
    };
}

/**
 * Texto do tipo de aposta para modal
 */
function getBetTypeTextForModal(betType, match) {
    switch (betType) {
        case "home": return `🏠 Vitória ${match.homeTeam}`;
        case "draw": return "🤝 Empate";
        case "away": return `✈️ Vitória ${match.awayTeam}`;
        default: return betType;
    }
}
