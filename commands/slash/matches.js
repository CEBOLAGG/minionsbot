const SlashCommand = require("../../lib/SlashCommand");
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ContainerBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    MessageFlags
} = require("discord.js");
const fetch = require("node-fetch");
const moment = require("moment-timezone");

// Configuração de ligas da ESPN
const LEAGUES = {
    // Brasileiras
    "bra.1": { name: "Brasileirão Série A", priority: 100, emoji: "🇧🇷" },
    "bra.2": { name: "Brasileirão Série B", priority: 90, emoji: "🇧🇷" },
    "bra.3": { name: "Brasileirão Série C", priority: 85, emoji: "🇧🇷" },
    "bra.copa_do_brazil": { name: "Copa do Brasil", priority: 95, emoji: "🇧🇷🏆" },
    // Europeias
    "eng.1": { name: "Premier League", priority: 98, emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    "esp.1": { name: "La Liga", priority: 97, emoji: "🇪🇸" },
    "ita.1": { name: "Serie A", priority: 96, emoji: "🇮🇹" },
    "ger.1": { name: "Bundesliga", priority: 95, emoji: "🇩🇪" },
    "fra.1": { name: "Ligue 1", priority: 94, emoji: "🇫🇷" },
    "uefa.champions": { name: "Champions League", priority: 110, emoji: "🏆" },
    "uefa.europa": { name: "Europa League", priority: 105, emoji: "🏆" },
    "uefa.europa.conf": { name: "Conference League", priority: 100, emoji: "🏆" },
    // Mundiais / Seleções
    "fifa.world": { name: "Copa do Mundo FIFA", priority: 130, emoji: "🌍🏆" },
    "fifa.friendly": { name: "Amistosos de Seleções", priority: 70, emoji: "🌍" },
    "fifa.cwc": { name: "Mundial de Clubes", priority: 115, emoji: "🌍" },
    "fifa.intercontinental_cup": { name: "Copa Intercontinental", priority: 112, emoji: "🌍🏆" },
    // Sul-americanas
    "conmebol.libertadores": { name: "Copa Libertadores", priority: 108, emoji: "🏆" },
    "conmebol.sudamericana": { name: "Copa Sul-Americana", priority: 103, emoji: "🏆" },
    // Outras
    "arg.1": { name: "Primera División (ARG)", priority: 85, emoji: "🇦🇷" },
    "mex.1": { name: "Liga MX", priority: 80, emoji: "🇲🇽" },
    "usa.1": { name: "MLS", priority: 75, emoji: "🇺🇸" },
    "por.1": { name: "Primeira Liga", priority: 88, emoji: "🇵🇹" },
    "ned.1": { name: "Eredivisie", priority: 87, emoji: "🇳🇱" },
};

// Lista de ligas para o filtro (as principais)
const LEAGUE_CHOICES = [
    { name: "Copa do Mundo FIFA", value: "fifa.world" },
    { name: "Brasileirão Série A", value: "bra.1" },
    { name: "Brasileirão Série B", value: "bra.2" },
    { name: "Brasileirão Série C", value: "bra.3" },
    { name: "Copa do Brasil", value: "bra.copa_do_brazil" },
    { name: "Premier League", value: "eng.1" },
    { name: "La Liga", value: "esp.1" },
    { name: "Serie A (Itália)", value: "ita.1" },
    { name: "Bundesliga", value: "ger.1" },
    { name: "Ligue 1", value: "fra.1" },
    { name: "Champions League", value: "uefa.champions" },
    { name: "Europa League", value: "uefa.europa" },
    { name: "Mundial de Clubes", value: "fifa.cwc" },
    { name: "Copa Intercontinental", value: "fifa.intercontinental_cup" },
    { name: "Copa Libertadores", value: "conmebol.libertadores" },
    { name: "Copa Sul-Americana", value: "conmebol.sudamericana" },
];

// Função para normalizar texto (remove acentos, hífens, caracteres especiais)
function normalizeText(text) {
    if (!text) return "";
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-_]/g, " ")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Trunca texto para caber no limite do Discord
function truncateText(text, maxLength = 1024) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
}

// Verifica se dois textos são similares
function matchesTeam(teamName, searchTerm) {
    const normalizedTeam = normalizeText(teamName);
    const normalizedSearch = normalizeText(searchTerm);
    
    if (normalizedTeam.includes(normalizedSearch)) return true;
    
    const searchWords = normalizedSearch.split(" ").filter(w => w.length > 1);
    const teamWords = normalizedTeam.split(" ");
    
    return searchWords.every(searchWord => 
        teamWords.some(teamWord => teamWord.includes(searchWord) || searchWord.includes(teamWord))
    );
}

const command = new SlashCommand()
    .setName("matches")
    .setDescription("Mostra partidas de futebol do dia")
    .addStringOption(option => 
        option
            .setName("team")
            .setDescription("Filtrar por nome do time")
            .setRequired(false)
    )
    .addStringOption(option => 
        option
            .setName("league")
            .setDescription("Filtrar por liga")
            .setRequired(false)
            .addChoices(...LEAGUE_CHOICES)
    )
    .addStringOption(option =>
        option
            .setName("jogo")
            .setDescription("Ver detalhes de um jogo específico (ex: santos.juventude ou santos vs juventude)")
            .setRequired(false)
    )
    .setRun(async (client, interaction) => {
        await interaction.deferReply();
        
        const jogoParam = interaction.options.getString("jogo");
        const teamFilter = interaction.options.getString("team");
        const leagueFilter = interaction.options.getString("league");
        
        // Começa com a data de hoje
        const currentDate = moment().tz("America/Sao_Paulo");
        const apiDate = currentDate.format("YYYYMMDD");
        const displayDate = currentDate.format("DD/MM/YYYY");
        const dayName = getDayName(currentDate);
        
        try {
            // Se tem parâmetro "jogo", busca detalhes do jogo específico
            if (jogoParam) {
                return await handleMatchDetails(interaction, jogoParam, apiDate, displayDate);
            }
            
            // Busca partidas
            const matches = await fetchMatchesFromESPN(apiDate, leagueFilter);
            
            // Filtra por time se especificado
            let filteredMatches = matches;
            if (teamFilter && matches) {
                filteredMatches = matches.filter(m => {
                    return matchesTeam(m.homeTeam, teamFilter) || matchesTeam(m.awayTeam, teamFilter);
                });
            }
            
            // Cria componentes V2
            const components = createMatchesComponentsV2(filteredMatches || [], displayDate, dayName, teamFilter, leagueFilter, 0);
            
            const message = await interaction.editReply({ 
                components,
                flags: MessageFlags.IsComponentsV2
            });
            
            // Configura collector para navegação
            setupNavigationCollector(client, message, interaction.user.id, teamFilter, leagueFilter);
                
            } catch (error) {
            console.error("Erro ao buscar partidas:", error);
            return interaction.editReply("❌ Erro ao buscar partidas. Tente novamente mais tarde.");
        }
    });

// Cria componentes V2 com as partidas (tudo dentro de um único Container)
function createMatchesComponentsV2(matches, displayDate, dayName, teamFilter, leagueFilter, dayOffset) {
    const teamParam = teamFilter || "none";
    const leagueParam = leagueFilter || "none";
    
    // Container principal com cor de destaque (simula embed)
    const mainContainer = new ContainerBuilder()
        .setAccentColor(0x2ECC71); // Verde
    
    // Header
    let title = `⚽ **Partidas - ${dayName}, ${displayDate}**`;
    if (teamFilter) title = `⚽ **Jogos de "${teamFilter}" - ${dayName}**`;
    
    let headerText = title;
    if (leagueFilter) {
        headerText += `\n🏆 **Liga:** ${LEAGUES[leagueFilter]?.name || leagueFilter}`;
    }
    
    mainContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(headerText)
    );
    
    // Separador após header
    mainContainer.addSeparatorComponents(new SeparatorBuilder());
                
                if (!matches || matches.length === 0) {
        mainContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("❌ Nenhuma partida encontrada para esta data.")
        );
    } else {
        // Agrupa por liga
        const byLeague = {};
        for (const match of matches) {
            const key = match.leagueName;
            if (!byLeague[key]) byLeague[key] = { emoji: match.leagueEmoji, matches: [] };
            byLeague[key].matches.push(match);
        }
        
        let isFirst = true;
        for (const [leagueName, data] of Object.entries(byLeague)) {
            // Separador entre ligas (exceto primeira)
            if (!isFirst) {
                mainContainer.addSeparatorComponents(new SeparatorBuilder());
            }
            isFirst = false;
            
            // Header da liga + jogos
            let leagueContent = `${data.emoji} **${leagueName}**\n`;
            
            for (const m of data.matches) {
                const line = formatMatchLineV2(m);
                if (leagueContent.length + line.length > 1900) break;
                leagueContent += line + "\n";
            }
            
            mainContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(leagueContent.trim())
            );
        }
    }
    
    // Separador antes da navegação
    mainContainer.addSeparatorComponents(new SeparatorBuilder());
    
    // Footer com contagem
    const footerText = matches && matches.length > 0 
        ? `📊 **${matches.length}** partida(s) encontradas`
        : "Use os botões para navegar entre os dias";
    
    mainContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(footerText)
    );
    
    // Botões de navegação
    mainContainer.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`matches:prev:${dayOffset}:${teamParam}:${leagueParam}`)
                .setEmoji("⬅️")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`matches:today:${dayOffset}:${teamParam}:${leagueParam}`)
                .setLabel("Hoje")
                .setEmoji("📅")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`matches:next:${dayOffset}:${teamParam}:${leagueParam}`)
                .setEmoji("➡️")
                .setStyle(ButtonStyle.Primary)
        )
    );
    
    return [mainContainer];
}

// Formata linha de uma partida (V2)
function formatMatchLineV2(match) {
    const emoji = getStatusEmoji(match.status);
    const time = moment(match.dateTime).tz("America/Sao_Paulo").format("HH:mm");
    
    let scoreOrTime;
    if (match.status === "scheduled") {
        scoreOrTime = `\`${time}\``;
    } else if (match.homeScore !== null && match.awayScore !== null) {
        scoreOrTime = `**${match.homeScore} - ${match.awayScore}**`;
    } else {
        scoreOrTime = "vs";
    }
    
    let line = `${emoji} ${match.homeTeam} ${scoreOrTime} ${match.awayTeam}`;
    
    if (match.statusText && match.status !== "scheduled" && match.status !== "finished") {
        line += ` *(${match.statusText})*`;
    }
    
    return line;
}

// Configura collector para navegação
function setupNavigationCollector(client, message, userId, teamFilter, leagueFilter) {
    const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === userId && i.customId.startsWith("matches:"),
        time: 600000 // 10 minutos
    });
    
    collector.on("collect", async (buttonInteraction) => {
        try {
            const [, action, currentOffsetStr, teamParam, leagueParam] = buttonInteraction.customId.split(":");
            let currentOffset = parseInt(currentOffsetStr) || 0;
            
            // Calcula novo offset
            if (action === "prev") {
                currentOffset -= 1;
            } else if (action === "next") {
                currentOffset += 1;
            } else if (action === "today") {
                currentOffset = 0;
            }
            
            // Calcula data
            const targetDate = moment().tz("America/Sao_Paulo").add(currentOffset, 'days');
            const apiDate = targetDate.format("YYYYMMDD");
            const displayDate = targetDate.format("DD/MM/YYYY");
            const dayName = getDayName(targetDate);
            
            // Recupera filtros
            const team = teamParam !== "none" ? teamParam : null;
            const league = leagueParam !== "none" ? leagueParam : null;
            
            // Busca partidas
            const matches = await fetchMatchesFromESPN(apiDate, league);
            
            // Filtra por time
            let filteredMatches = matches;
            if (team && matches) {
                filteredMatches = matches.filter(m => {
                    return matchesTeam(m.homeTeam, team) || matchesTeam(m.awayTeam, team);
                });
            }
            
            // Atualiza componentes V2
            const components = createMatchesComponentsV2(filteredMatches || [], displayDate, dayName, team, league, currentOffset);
            
            await buttonInteraction.update({ 
                components,
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error("Erro na navegação:", error);
            await buttonInteraction.reply({ 
                content: "❌ Erro ao carregar partidas.", 
                ephemeral: true 
            }).catch(() => {});
        }
    });
    
    collector.on("end", () => {
        // Remove componentes quando expirar
        message.edit({ 
            components: [],
            flags: MessageFlags.IsComponentsV2 
        }).catch(() => {});
    });
}

// Retorna nome do dia da semana
function getDayName(momentDate) {
    const today = moment().tz("America/Sao_Paulo").startOf('day');
    const target = momentDate.startOf('day');
    const diff = target.diff(today, 'days');
    
    if (diff === 0) return "Hoje";
    if (diff === 1) return "Amanhã";
    if (diff === -1) return "Ontem";
    
    const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return days[momentDate.day()];
}

// Handler para detalhes de um jogo específico
async function handleMatchDetails(interaction, jogoParam, apiDate, displayDate) {
    const separators = ['.', ' vs ', ' x ', ' VS ', ' X ', '-'];
    let team1 = null, team2 = null;
    
    for (const sep of separators) {
        if (jogoParam.includes(sep)) {
            const parts = jogoParam.split(sep).map(s => s.trim()).filter(s => s);
            if (parts.length >= 2) {
                team1 = parts[0].toLowerCase();
                team2 = parts[1].toLowerCase();
                break;
            }
        }
    }
    
    if (!team1 || !team2) {
        return interaction.editReply("⚠️ Formato inválido. Use: `time1.time2` ou `time1 vs time2`\nExemplo: `/matches jogo:santos.juventude`");
    }
    
    const matches = await fetchMatchesFromESPN(apiDate, null);
    
    const foundMatch = matches.find(m => {
        return (matchesTeam(m.homeTeam, team1) && matchesTeam(m.awayTeam, team2)) || 
               (matchesTeam(m.homeTeam, team2) && matchesTeam(m.awayTeam, team1));
    });
    
    if (!foundMatch) {
        return interaction.editReply(`❌ Jogo **${team1}** vs **${team2}** não encontrado em **${displayDate}**.\n💡 Tente buscar usando \`/matches team:${team1}\` primeiro.`);
    }
    
    const matchDetails = await fetchMatchDetails(foundMatch.id, foundMatch.leagueId);
    
    if (!matchDetails) {
        const basicEmbed = createBasicMatchEmbed(foundMatch);
        return interaction.editReply({ embeds: [basicEmbed] });
    }
    
    const detailEmbed = createDetailedMatchEmbed(foundMatch, matchDetails);
    await interaction.editReply({ embeds: [detailEmbed] });
}

// Busca detalhes completos de um jogo
async function fetchMatchDetails(matchId, leagueId) {
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${matchId}`;
        const response = await fetch(url, { timeout: 10000 });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        return data;
    } catch (err) {
        console.error("Erro ao buscar detalhes do jogo:", err.message);
        return null;
    }
}

// Cria embed básico
function createBasicMatchEmbed(match) {
    const time = moment(match.dateTime).tz("America/Sao_Paulo").format("HH:mm");
    const date = moment(match.dateTime).tz("America/Sao_Paulo").format("DD/MM/YYYY");
    
    const embed = new EmbedBuilder()
        .setTitle(`${match.leagueEmoji} ${match.homeTeam} vs ${match.awayTeam}`)
        .setColor("#3498DB")
        .setDescription(`🏆 **${match.leagueName}**`)
        .addFields(
            { name: "Data", value: date, inline: true },
            { name: "Horário", value: time, inline: true },
            { name: "Status", value: getStatusText(match.status, match.statusText), inline: true }
        );
    
    if (match.homeScore !== null && match.awayScore !== null) {
        embed.addFields({
            name: "Placar",
            value: `**${match.homeTeam}** ${match.homeScore} - ${match.awayScore} **${match.awayTeam}**`,
            inline: false
        });
    }
    
    if (match.venue) {
        embed.addFields({ name: "Estádio", value: match.venue, inline: false });
    }
    
    embed.setFooter({ text: "Dados da ESPN" }).setTimestamp();
    
    return embed;
}

// Cria embed detalhado com estatísticas
function createDetailedMatchEmbed(match, details) {
    const time = moment(match.dateTime).tz("America/Sao_Paulo").format("HH:mm");
    const date = moment(match.dateTime).tz("America/Sao_Paulo").format("DD/MM/YYYY");
    
    const embed = new EmbedBuilder()
        .setTitle(`${match.leagueEmoji} ${match.homeTeam} vs ${match.awayTeam}`)
        .setColor(match.isLive ? "#E74C3C" : "#3498DB")
        .setDescription(`🏆 **${match.leagueName}**`);
    
    embed.addFields(
        { name: "Data", value: date, inline: true },
        { name: "Horário", value: time, inline: true },
        { name: "Status", value: getStatusText(match.status, match.statusText), inline: true }
    );
    
    if (match.homeScore !== null && match.awayScore !== null) {
        const scoreEmoji = match.isLive ? "🔴" : "⚽";
        embed.addFields({
            name: `${scoreEmoji} Placar`,
            value: `**${match.homeTeam}** ${match.homeScore} - ${match.awayScore} **${match.awayTeam}**`,
            inline: false
        });
    }
    
    const keyEvents = extractKeyEvents(details);
    if (keyEvents.length > 0) {
        let eventsText = keyEvents.slice(0, 8).join("\n");
        eventsText = truncateText(eventsText, 1024);
        embed.addFields({
            name: "📋 Eventos",
            value: eventsText || "Nenhum evento",
            inline: false
        });
    }
    
    const stats = extractStats(details);
    if (stats) {
        embed.addFields({
            name: "📊 Estatísticas",
            value: truncateText(stats, 1024),
            inline: false
        });
    }
    
    const formations = extractFormations(details);
    if (formations) {
        embed.addFields({
            name: "📋 Formações",
            value: truncateText(formations, 1024),
            inline: false
        });
    }
    
    const venue = details?.gameInfo?.venue?.fullName || match.venue;
    if (venue) {
        embed.addFields({ name: "🏟️ Estádio", value: truncateText(venue, 1024), inline: true });
    }
    
    const referee = details?.gameInfo?.officials?.[0]?.displayName;
    if (referee) {
        embed.addFields({ name: "👨‍⚖️ Árbitro", value: truncateText(referee, 1024), inline: true });
    }
    
    const attendance = details?.gameInfo?.attendance;
    if (attendance) {
        embed.addFields({ name: "👥 Público", value: attendance.toLocaleString('pt-BR'), inline: true });
    }
    
    embed.setFooter({ text: "Dados da ESPN • Detalhes do jogo" }).setTimestamp();
    
    return embed;
}

// Extrai eventos importantes
function extractKeyEvents(details) {
    const events = [];
    
    try {
        const keyEvents = details?.keyEvents || details?.commentary || [];
        
        for (const event of keyEvents) {
            const time = event.clock?.displayValue || event.time?.displayValue || "";
            const type = event.type?.text || event.type || "";
            const text = event.text || event.shortText || "";
            
            let emoji = "📌";
            if (type.toLowerCase().includes("goal") || text.toLowerCase().includes("gol")) {
                emoji = "⚽";
            } else if (type.toLowerCase().includes("yellow") || text.toLowerCase().includes("amarelo")) {
                emoji = "🟨";
            } else if (type.toLowerCase().includes("red") || text.toLowerCase().includes("vermelho")) {
                emoji = "🟥";
            } else if (type.toLowerCase().includes("substitution") || text.toLowerCase().includes("substituição")) {
                emoji = "🔄";
            } else if (type.toLowerCase().includes("penalty") || text.toLowerCase().includes("pênalti")) {
                emoji = "🎯";
            }
            
            if (text) {
                const truncatedText = text.length > 80 ? text.substring(0, 77) + "..." : text;
                events.push(`${emoji} \`${time}\` ${truncatedText}`);
            }
        }
        
        const scoringPlays = details?.scoringPlays || [];
        for (const play of scoringPlays) {
            const time = play.clock?.displayValue || "";
            const scorer = play.text || play.athletesInvolved?.[0]?.displayName || "";
            const team = play.team?.displayName || "";
            
            if (scorer) {
                const truncatedScorer = scorer.length > 30 ? scorer.substring(0, 27) + "..." : scorer;
                const truncatedTeam = team.length > 20 ? team.substring(0, 17) + "..." : team;
                const goalText = `⚽ \`${time}\` **GOL!** ${truncatedScorer} (${truncatedTeam})`;
                if (!events.some(e => e.includes(truncatedScorer) && e.includes(time))) {
                    events.push(goalText);
                }
            }
        }
    } catch (err) {
        console.error("Erro ao extrair eventos:", err.message);
    }
    
    return events;
}

// Extrai estatísticas do jogo
function extractStats(details) {
    try {
        const boxscore = details?.boxscore;
        if (!boxscore || !boxscore.teams) return null;
        
        const teams = boxscore.teams;
        if (teams.length < 2) return null;
        
        const home = teams[0];
        const away = teams[1];
        
        const homeStats = home.statistics || [];
        const awayStats = away.statistics || [];
        
        const statLines = [];
        
        const statsToShow = {
            "possessionPct": "Posse de Bola",
            "possession": "Posse de Bola",
            "shotsTotal": "Finalizações",
            "shots": "Finalizações",
            "shotsOnTarget": "Chutes no Gol",
            "corners": "Escanteios",
            "cornerKicks": "Escanteios",
            "fouls": "Faltas",
            "offsides": "Impedimentos",
            "yellowCards": "Cartões Amarelos",
            "redCards": "Cartões Vermelhos"
        };
        
        for (const [key, label] of Object.entries(statsToShow)) {
            const homeStat = homeStats.find(s => s.name === key || s.label?.toLowerCase().includes(label.toLowerCase()));
            const awayStat = awayStats.find(s => s.name === key || s.label?.toLowerCase().includes(label.toLowerCase()));
            
            if (homeStat && awayStat) {
                const homeVal = homeStat.displayValue || homeStat.value || "0";
                const awayVal = awayStat.displayValue || awayStat.value || "0";
                statLines.push(`${homeVal} - **${label}** - ${awayVal}`);
            }
        }
        
        if (statLines.length === 0) return null;
        
        return statLines.join("\n");
    } catch (err) {
        console.error("Erro ao extrair estatísticas:", err.message);
        return null;
    }
}

// Extrai formações
function extractFormations(details) {
    try {
        const formations = details?.rosters || details?.boxscore?.teams;
        if (!formations || formations.length < 2) return null;
        
        const homeFormation = formations[0]?.formation || formations[0]?.team?.formation;
        const awayFormation = formations[1]?.formation || formations[1]?.team?.formation;
        
        if (!homeFormation && !awayFormation) return null;
        
        const homeName = formations[0]?.team?.displayName || "Casa";
        const awayName = formations[1]?.team?.displayName || "Fora";
        
        return `**${homeName}:** ${homeFormation || "N/A"}\n**${awayName}:** ${awayFormation || "N/A"}`;
    } catch (err) {
        return null;
    }
}

// Texto de status formatado
function getStatusText(status, statusText) {
    switch (status) {
        case "live": return `🔴 ${statusText || "Ao Vivo"}`;
        case "halftime": return "🟡 Intervalo";
        case "finished": return "✅ Encerrado";
        case "postponed": return "⚠️ Adiado";
        case "cancelled": return "❌ Cancelado";
        default: return "⏰ Não iniciado";
    }
}

// Busca partidas da ESPN API
async function fetchMatchesFromESPN(date, leagueFilter) {
    const allMatches = [];
    
    const leaguesToFetch = leagueFilter ? [leagueFilter] : Object.keys(LEAGUES);
    
    const promises = leaguesToFetch.map(async (leagueId) => {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${date}`;
            const response = await fetch(url, { timeout: 10000 });
            
            if (!response.ok) return [];
            
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) return [];
            
            return data.events.map(event => parseMatch(event, leagueId));
        } catch (err) {
            console.error(`Erro ao buscar liga ${leagueId}:`, err.message);
            return [];
        }
    });
    
    const results = await Promise.all(promises);
    results.forEach(matches => allMatches.push(...matches));
    
    return allMatches.sort((a, b) => {
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        
        const priorityA = LEAGUES[a.leagueId]?.priority || 0;
        const priorityB = LEAGUES[b.leagueId]?.priority || 0;
        if (priorityB !== priorityA) return priorityB - priorityA;
        
        return new Date(a.dateTime) - new Date(b.dateTime);
    });
}

// Parse de uma partida da ESPN
function parseMatch(event, leagueId) {
    const competition = event.competitions?.[0];
    const status = event.status;
    
    const homeTeamData = competition?.competitors?.find(c => c.homeAway === "home");
    const awayTeamData = competition?.competitors?.find(c => c.homeAway === "away");
    
    let matchStatus = "scheduled";
    let statusText = "";
    let isLive = false;
    
    if (status?.type) {
        const statusType = status.type.name;
        if (statusType === "STATUS_SCHEDULED") {
            matchStatus = "scheduled";
        } else if (statusType === "STATUS_IN_PROGRESS" || statusType === "STATUS_FIRST_HALF" || statusType === "STATUS_SECOND_HALF") {
            matchStatus = "live";
            isLive = true;
            statusText = status.displayClock || "Ao Vivo";
        } else if (statusType === "STATUS_HALFTIME") {
            matchStatus = "halftime";
            isLive = true;
            statusText = "Intervalo";
        } else if (statusType === "STATUS_FINAL" || statusType === "STATUS_FULL_TIME") {
            matchStatus = "finished";
            statusText = "Encerrado";
        } else if (statusType === "STATUS_POSTPONED") {
            matchStatus = "postponed";
            statusText = "Adiado";
        } else if (statusType === "STATUS_CANCELED" || statusType === "STATUS_CANCELLED") {
            matchStatus = "cancelled";
            statusText = "Cancelado";
        } else {
            statusText = status.type.shortDetail || statusType.replace("STATUS_", "");
        }
    }
    
    return {
        id: event.id,
        leagueId: leagueId,
        leagueName: LEAGUES[leagueId]?.name || event.league?.name || "Liga",
        leagueEmoji: LEAGUES[leagueId]?.emoji || "⚽",
        homeTeam: homeTeamData?.team?.displayName || homeTeamData?.team?.name || "TBA",
        awayTeam: awayTeamData?.team?.displayName || awayTeamData?.team?.name || "TBA",
        homeScore: homeTeamData?.score ?? null,
        awayScore: awayTeamData?.score ?? null,
        dateTime: event.date,
        status: matchStatus,
        statusText: statusText,
        isLive: isLive,
        venue: competition?.venue?.fullName || null
    };
}

// Cria embed com as partidas
function createMatchesEmbed(matches, displayDate, dayName, teamFilter, leagueFilter) {
    let title = `⚽ Partidas - ${dayName}, ${displayDate}`;
    if (teamFilter) title = `⚽ Jogos de "${teamFilter}" - ${dayName}`;
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor("#2ECC71")
        .setTimestamp();
    
    // Adiciona info dos filtros
    let description = "";
    if (leagueFilter) {
        description += `🏆 **Liga:** ${LEAGUES[leagueFilter]?.name || leagueFilter}\n`;
    }
    if (description) {
        embed.setDescription(description);
    }
    
    if (!matches || matches.length === 0) {
        embed.setDescription((description || "") + "\n❌ Nenhuma partida encontrada para esta data.");
        embed.setFooter({ text: "Use os botões para navegar entre os dias" });
    return embed;
}

    // Agrupa por liga
    const byLeague = {};
    for (const match of matches) {
        const key = match.leagueName;
        if (!byLeague[key]) byLeague[key] = { emoji: match.leagueEmoji, matches: [] };
        byLeague[key].matches.push(match);
    }
    
    let fieldCount = 0;
    
    for (const [leagueName, data] of Object.entries(byLeague)) {
        if (fieldCount >= 25) break;
        
        let value = "";
        for (const m of data.matches) {
            const line = formatMatchLine(m);
            if (value.length + line.length > 1000) break;
            value += line + "\n";
        }
        
        if (value) {
            embed.addFields({ 
                name: `${data.emoji} ${leagueName}`, 
                value: value.trim(), 
                inline: false 
            });
            fieldCount++;
        }
    }
    
    embed.setFooter({ text: `${matches.length} partida(s) • Use ⬅️ ➡️ para navegar` });
    
    return embed;
}

// Formata linha de uma partida
function formatMatchLine(match) {
    const emoji = getStatusEmoji(match.status);
    const time = moment(match.dateTime).tz("America/Sao_Paulo").format("HH:mm");
    
    let scoreOrTime;
    if (match.status === "scheduled") {
        scoreOrTime = `\`${time}\``;
    } else if (match.homeScore !== null && match.awayScore !== null) {
        scoreOrTime = `**${match.homeScore} - ${match.awayScore}**`;
    } else {
        scoreOrTime = "vs";
    }
    
    let line = `${emoji} ${match.homeTeam} ${scoreOrTime} ${match.awayTeam}`;
    
    if (match.statusText && match.status !== "scheduled" && match.status !== "finished") {
        line += ` *(${match.statusText})*`;
    }
    
    return line;
}

// Emoji baseado no status
function getStatusEmoji(status) {
    switch (status) {
        case "live": return "🔴";
        case "halftime": return "🟡";
        case "finished": return "✅";
        case "postponed": return "⚠️";
        case "cancelled": return "❌";
        default: return "⏰";
    }
}

module.exports = command;
