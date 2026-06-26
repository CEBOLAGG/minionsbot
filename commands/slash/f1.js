const {
    EmbedBuilder,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    MessageFlags
} = require("discord.js");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const moment = require("moment-timezone");

// Configuração
const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/racing/f1";
const ESPN_CORE_URL = "https://sports.core.api.espn.com/v2/sports/racing/leagues/f1";
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/racing/f1/standings";

// Cores das equipes F1 2025
const TEAM_COLORS = {
    "Red Bull": { color: "#1E41FF", emoji: "🔵" },
    "Ferrari": { color: "#DC0000", emoji: "🔴" },
    "McLaren": { color: "#FF8700", emoji: "🟠" },
    "Mercedes": { color: "#00D2BE", emoji: "🩵" },
    "Aston Martin": { color: "#006F62", emoji: "🟢" },
    "Alpine": { color: "#0090FF", emoji: "💙" },
    "Williams": { color: "#005AFF", emoji: "🔷" },
    "Haas": { color: "#B6BABD", emoji: "⚪" },
    "RB": { color: "#2B4562", emoji: "🔹" },
    "Kick Sauber": { color: "#52E252", emoji: "💚" },
    "Sauber": { color: "#52E252", emoji: "💚" }
};

// Emojis de posição
const POSITION_EMOJIS = {
    1: "🥇",
    2: "🥈",
    3: "🥉"
};

// Cache para dados
const cache = {
    scoreboard: { data: null, timestamp: 0 },
    standings: { data: null, timestamp: 0 },
    constructors: { data: null, timestamp: 0 }
};
const CACHE_DURATION = 60000; // 1 minuto

// Armazena monitoramentos ativos
const activeMonitors = new Map();

module.exports = {
    name: "f1",
    description: "Comandos de Fórmula 1 - Calendário, Classificação, Resultados e Ao Vivo",
    permissions: "0",
    options: [
        {
            name: "calendario",
            description: "📅 Ver o calendário da temporada de F1",
            type: 1, // Subcommand
            options: []
        },
        {
            name: "proxima",
            description: "🏁 Ver detalhes da próxima corrida",
            type: 1,
            options: []
        },
        {
            name: "pilotos",
            description: "🏆 Ver classificação dos pilotos no campeonato",
            type: 1,
            options: []
        },
        {
            name: "equipes",
            description: "🏎️ Ver classificação das equipes (Construtores)",
            type: 1,
            options: []
        },
        {
            name: "resultado",
            description: "📊 Ver resultado de uma corrida específica",
            type: 1,
            options: [
                {
                    name: "gp",
                    description: "Selecione o GP (deixe vazio para o mais recente)",
                    type: 3, // String
                    required: false,
                    autocomplete: true
                }
            ]
        },
        {
            name: "aovivo",
            description: "🔴 Monitorar sessão ao vivo (Treino/Quali/Corrida)",
            type: 1,
            options: []
        }
    ],
    autocomplete: async (interaction) => {
        const focusedOption = interaction.options.getFocused(true);
        
        if (focusedOption.name === "gp") {
            try {
                const data = await fetchScoreboard();
                if (!data || !data.leagues || !data.leagues[0]) return interaction.respond([]);
                
                const calendar = data.leagues[0].calendar || [];
                const choices = calendar
                    .filter(event => {
                        const endDate = new Date(event.endDate);
                        return endDate < new Date(); // Apenas GPs passados
                    })
                    .slice(-25) // Últimos 25
                    .reverse()
                    .map(event => ({
                        name: event.label.replace(" Grand Prix", " GP").substring(0, 100),
                        value: event.event.$ref.match(/events\/(\d+)/)?.[1] || ""
                    }))
                    .filter(c => c.value && c.name.toLowerCase().includes(focusedOption.value.toLowerCase()));
                
                await interaction.respond(choices.slice(0, 25));
            } catch (error) {
                console.error("Autocomplete error:", error);
                await interaction.respond([]);
            }
        }
    },
    run: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            switch (subcommand) {
                case "calendario":
                    await handleCalendario(interaction);
                    break;
                case "proxima":
                    await handleProxima(interaction);
                    break;
                case "pilotos":
                    await handlePilotos(interaction);
                    break;
                case "equipes":
                    await handleEquipes(interaction);
                    break;
                case "resultado":
                    await handleResultado(interaction);
                    break;
                case "aovivo":
                    await handleAoVivo(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: "❌ Subcomando não reconhecido.",
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error(`Erro no comando F1 (${subcommand}):`, error);
            const errorMessage = "❌ Ocorreu um erro ao processar o comando. Tente novamente.";
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
    SlashCommandBuilder: new SlashCommandBuilder()
        .setName("f1")
        .setDescription("Comandos de Fórmula 1")
};

// ==================== FUNÇÕES DE FETCH ====================

async function fetchScoreboard() {
    const now = Date.now();
    if (cache.scoreboard.data && (now - cache.scoreboard.timestamp) < CACHE_DURATION) {
        return cache.scoreboard.data;
    }
    
    try {
        const response = await fetch(`${ESPN_BASE_URL}/scoreboard`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        cache.scoreboard = { data, timestamp: now };
        return data;
    } catch (error) {
        console.error("Erro ao buscar scoreboard:", error);
        return cache.scoreboard.data; // Retorna cache antigo se houver erro
    }
}

async function fetchStandings() {
    const now = Date.now();
    if (cache.standings.data && (now - cache.standings.timestamp) < CACHE_DURATION * 5) {
        return cache.standings.data;
    }
    
    try {
        const response = await fetch(STANDINGS_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        cache.standings = { data, timestamp: now };
        return data;
    } catch (error) {
        console.error("Erro ao buscar standings:", error);
        return cache.standings.data;
    }
}

async function fetchEventDetails(eventId, competitionId) {
    try {
        const url = `${ESPN_CORE_URL}/events/${eventId}/competitions/${competitionId}?lang=en`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar detalhes do evento:", error);
        return null;
    }
}

async function fetchCompetitorStats(eventId, competitionId, athleteId) {
    try {
        const url = `${ESPN_CORE_URL}/events/${eventId}/competitions/${competitionId}/competitors/${athleteId}/statistics?lang=en`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function fetchAthleteInfo(athleteId) {
    try {
        const url = `https://sports.core.api.espn.com/v2/sports/racing/athletes/${athleteId}?lang=en`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

// ==================== HANDLERS ====================

async function handleCalendario(interaction) {
    await interaction.deferReply();
    
    const data = await fetchScoreboard();
    if (!data || !data.leagues || !data.leagues[0]) {
        return interaction.editReply({ content: "❌ Não foi possível obter o calendário." });
    }
    
    const calendar = data.leagues[0].calendar || [];
    const now = new Date();
    
    // Processa todas as corridas em ordem cronológica
    const allRaces = calendar.map(event => {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        const isPast = endDate < now;
        const isOngoing = startDate <= now && endDate >= now;
        
        return {
            name: event.label.replace(" Grand Prix", " GP"),
            startDate,
            endDate,
            isPast,
            isOngoing,
            eventId: event.event.$ref.match(/events\/(\d+)/)?.[1]
        };
    });
    
    // Paginação
    const RACES_PER_PAGE = 8;
    const totalPages = Math.ceil(allRaces.length / RACES_PER_PAGE);
    
    // Encontra a página com a próxima corrida (primeira não passada)
    const nextRaceIndex = allRaces.findIndex(race => !race.isPast);
    let currentPage = nextRaceIndex >= 0 ? Math.floor(nextRaceIndex / RACES_PER_PAGE) : 0;
    
    const createCalendarEmbed = (page) => {
        const start = page * RACES_PER_PAGE;
        const pageRaces = allRaces.slice(start, start + RACES_PER_PAGE);
        
        const embed = new EmbedBuilder()
            .setTitle("🏎️ Calendário F1 2025")
            .setColor("#E10600")
            .setThumbnail("https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png")
            .setFooter({ text: `Página ${page + 1}/${totalPages} • ${calendar.length} corridas na temporada` });
        
        let description = "";
        
        // Encontra índice global da próxima corrida
        const nextGlobalIdx = allRaces.findIndex(race => !race.isPast && !race.isOngoing);
        
        pageRaces.forEach((race, idx) => {
            const globalIdx = start + idx;
            const dateStr = moment(race.startDate).tz("America/Sao_Paulo").format("DD/MM");
            
            let status = "";
            if (race.isOngoing) {
                status = " 🔴 **AO VIVO**";
            } else if (race.isPast) {
                status = " ✅";
            } else if (globalIdx === nextGlobalIdx) {
                status = " 👉 **PRÓXIMA**";
            }
            
            description += `\`${String(globalIdx + 1).padStart(2, "0")}\` **${race.name}**${status}\n`;
            description += `     📅 ${dateStr}\n\n`;
        });
        
        embed.setDescription(description || "Nenhuma corrida encontrada.");
        return embed;
    };
    
    const createButtons = (page) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("f1_cal_first")
                .setLabel("⏮️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId("f1_cal_prev")
                .setLabel("◀️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId("f1_cal_page")
                .setLabel(`${page + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId("f1_cal_next")
                .setLabel("▶️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages - 1),
            new ButtonBuilder()
                .setCustomId("f1_cal_last")
                .setLabel("⏭️")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1)
        );
    };
    
    const message = await interaction.editReply({
        embeds: [createCalendarEmbed(currentPage)],
        components: [createButtons(currentPage)]
    });
    
    const collector = message.createMessageComponentCollector({
        time: 300000 // 5 minutos
    });
    
    collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
            return i.reply({ content: "❌ Apenas quem executou o comando pode navegar.", ephemeral: true });
        }
        
        switch (i.customId) {
            case "f1_cal_first": currentPage = 0; break;
            case "f1_cal_prev": currentPage = Math.max(0, currentPage - 1); break;
            case "f1_cal_next": currentPage = Math.min(totalPages - 1, currentPage + 1); break;
            case "f1_cal_last": currentPage = totalPages - 1; break;
        }
        
        await i.update({
            embeds: [createCalendarEmbed(currentPage)],
            components: [createButtons(currentPage)]
        });
    });
    
    collector.on("end", () => {
        interaction.editReply({ components: [] }).catch(() => {});
    });
}

async function handleProxima(interaction) {
    await interaction.deferReply();
    
    const data = await fetchScoreboard();
    if (!data || !data.events || data.events.length === 0) {
        return interaction.editReply({ content: "❌ Não foi possível obter informações da próxima corrida." });
    }
    
    const event = data.events[0];
    const competitions = event.competitions || [];
    
    // Informações do circuito
    const circuit = event.circuit || {};
    const circuitName = circuit.fullName || "Circuito não informado";
    const circuitCity = circuit.address?.city || "";
    const circuitCountry = circuit.address?.country || "";
    
    const embed = new EmbedBuilder()
        .setTitle(`🏁 ${event.name}`)
        .setColor("#E10600")
        .setThumbnail("https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png");
    
    // Descrição com info do circuito
    let description = `📍 **${circuitName}**\n`;
    if (circuitCity || circuitCountry) {
        description += `🌍 ${circuitCity}${circuitCity && circuitCountry ? ", " : ""}${circuitCountry}\n`;
    }
    description += "\n";
    
    // Sessões
    const sessionOrder = ["FP1", "FP2", "FP3", "Sprint Shootout", "Sprint", "Qual", "Race"];
    const sortedCompetitions = competitions.sort((a, b) => {
        const aIdx = sessionOrder.indexOf(a.type?.abbreviation || "");
        const bIdx = sessionOrder.indexOf(b.type?.abbreviation || "");
        if (aIdx === -1 && bIdx === -1) return new Date(a.date) - new Date(b.date);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
    });
    
    description += "**📋 Programação (Horário de Brasília):**\n\n";
    
    const now = new Date();
    
    sortedCompetitions.forEach(comp => {
        const sessionType = comp.type?.abbreviation || "Sessão";
        const sessionDate = new Date(comp.date);
        const dateStr = moment(sessionDate).tz("America/Sao_Paulo").format("ddd DD/MM HH:mm");
        
        const status = comp.status?.type;
        let statusIcon = "⏳";
        
        if (status?.state === "post" || status?.completed) {
            statusIcon = "✅";
        } else if (status?.state === "in") {
            statusIcon = "🔴";
        } else if (sessionDate < now) {
            statusIcon = "✅";
        }
        
        // Tradução das sessões
        const sessionNames = {
            "FP1": "Treino Livre 1",
            "FP2": "Treino Livre 2",
            "FP3": "Treino Livre 3",
            "Qual": "Classificação",
            "Race": "Corrida",
            "Sprint": "Sprint",
            "Sprint Shootout": "Sprint Shootout"
        };
        
        const sessionName = sessionNames[sessionType] || sessionType;
        description += `${statusIcon} **${sessionName}**\n`;
        description += `     📅 ${dateStr}\n\n`;
    });
    
    embed.setDescription(description);
    
    // Status geral do evento
    const eventStatus = event.status?.type;
    if (eventStatus?.state === "in") {
        embed.addFields({
            name: "🔴 Status",
            value: "Evento em andamento!",
            inline: true
        });
    }
    
    await interaction.editReply({ embeds: [embed] });
}

async function handlePilotos(interaction) {
    await interaction.deferReply();
    
    // Busca standings e dados da última corrida em paralelo
    const [standingsData, scoreboardData] = await Promise.all([
        fetchStandings(),
        fetchScoreboard()
    ]);
    
    if (!standingsData || !standingsData.children) {
        return interaction.editReply({ content: "❌ Não foi possível obter a classificação dos pilotos." });
    }
    
    // Encontra standings de pilotos
    const driverStandings = standingsData.children.find(c => c.name === "Driver Standings" || c.id === "0");
    if (!driverStandings || !driverStandings.standings?.entries) {
        return interaction.editReply({ content: "❌ Classificação de pilotos não encontrada." });
    }
    
    // Busca mapeamento de pilotos para equipes da última corrida
    const driverTeamMap = new Map();
    
    if (scoreboardData?.events?.[0]) {
        const event = scoreboardData.events[0];
        const raceComp = event.competitions?.find(c => c.type?.abbreviation === "Race");
        
        if (raceComp) {
            // Busca detalhes da corrida para obter equipes
            try {
                const raceDetails = await fetchEventDetails(event.id, raceComp.id);
                if (raceDetails?.competitors) {
                    raceDetails.competitors.forEach(comp => {
                        if (comp.id && comp.vehicle?.manufacturer) {
                            driverTeamMap.set(comp.id, {
                                team: comp.vehicle.manufacturer,
                                number: comp.vehicle.number
                            });
                        }
                    });
                }
            } catch (e) {
                console.error("Erro ao buscar detalhes da corrida:", e);
            }
        }
    }
    
    const entries = driverStandings.standings.entries;
    
    const embed = new EmbedBuilder()
        .setTitle("🏆 Classificação de Pilotos - F1 2025")
        .setColor("#E10600")
        .setThumbnail("https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png")
        .setFooter({ text: `${entries.length} pilotos • Atualizado agora` });
    
    let description = "```\n";
    description += "POS  PILOTO               EQUIPE        PTS\n";
    description += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    entries.slice(0, 22).forEach((entry, idx) => {
        // Rank está no stats com name "rank"
        const rankStat = entry.stats?.find(s => s.name === "rank");
        const pos = String(rankStat?.displayValue || idx + 1).padStart(2, " ");
        
        // Points está no stats com name "championshipPts"
        const pointsStat = entry.stats?.find(s => s.name === "championshipPts");
        const points = pointsStat?.displayValue || "0";
        
        const driverName = (entry.athlete?.displayName || "N/A").substring(0, 17).padEnd(17, " ");
        
        // Busca equipe do mapeamento
        const driverId = entry.athlete?.id;
        const driverInfo = driverTeamMap.get(driverId);
        const teamName = (driverInfo?.team || "").substring(0, 10).padEnd(10, " ");
        
        const posEmoji = POSITION_EMOJIS[parseInt(pos)] || "  ";
        
        description += `${posEmoji}${pos}  ${driverName}  ${teamName}  ${points.padStart(4, " ")}\n`;
    });
    
    description += "```";
    embed.setDescription(description);
    
    // Top 3 em destaque
    const top3 = entries.slice(0, 3).map((entry, idx) => {
        const pointsStat = entry.stats?.find(s => s.name === "championshipPts");
        const points = pointsStat?.displayValue || "0";
        const name = entry.athlete?.shortName || entry.athlete?.displayName || "N/A";
        
        const driverId = entry.athlete?.id;
        const driverInfo = driverTeamMap.get(driverId);
        const team = driverInfo?.team || "";
        const teamInfo = TEAM_COLORS[team] || { emoji: "🏎️" };
        
        return `${POSITION_EMOJIS[idx + 1]} ${teamInfo.emoji} **${name}** - ${points} pts`;
    });
    
    embed.addFields({
        name: "🏆 Top 3",
        value: top3.join("\n"),
        inline: false
    });
    
    await interaction.editReply({ embeds: [embed] });
}

async function handleEquipes(interaction) {
    await interaction.deferReply();
    
    const data = await fetchStandings();
    if (!data || !data.children) {
        return interaction.editReply({ content: "❌ Não foi possível obter a classificação das equipes." });
    }
    
    // Encontra standings de construtores
    const constructorStandings = data.children.find(c => c.name === "Constructor Standings" || c.id === "1");
    if (!constructorStandings || !constructorStandings.standings?.entries) {
        return interaction.editReply({ content: "❌ Classificação de construtores não encontrada." });
    }
    
    const entries = constructorStandings.standings.entries;
    
    const embed = new EmbedBuilder()
        .setTitle("🏎️ Classificação de Construtores - F1 2025")
        .setColor("#E10600")
        .setThumbnail("https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png")
        .setFooter({ text: `${entries.length} equipes • Atualizado agora` });
    
    let description = "";
    
    entries.forEach((entry, idx) => {
        const pos = idx + 1;
        const points = entry.stats?.find(s => s.name === "points")?.displayValue || "0";
        const teamName = entry.team?.displayName || "N/A";
        const teamInfo = TEAM_COLORS[teamName] || { emoji: "🏎️", color: "#FFFFFF" };
        
        const posEmoji = POSITION_EMOJIS[pos] || `\`${String(pos).padStart(2, " ")}\``;
        
        // Barra de progresso baseada em pontos
        const maxPoints = parseInt(entries[0]?.stats?.find(s => s.name === "points")?.displayValue || "1");
        const currentPoints = parseInt(points);
        const barLength = 10;
        const filledLength = Math.round((currentPoints / maxPoints) * barLength);
        const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
        
        description += `${posEmoji} ${teamInfo.emoji} **${teamName}**\n`;
        description += `     \`${bar}\` **${points}** pts\n\n`;
    });
    
    embed.setDescription(description);
    
    await interaction.editReply({ embeds: [embed] });
}

async function handleResultado(interaction) {
    await interaction.deferReply();
    
    const gpId = interaction.options.getString("gp");
    
    const data = await fetchScoreboard();
    if (!data || !data.events) {
        return interaction.editReply({ content: "❌ Não foi possível obter os resultados." });
    }
    
    let event;
    let raceCompetition;
    
    if (gpId) {
        // Busca evento específico
        const calendar = data.leagues?.[0]?.calendar || [];
        const calendarEvent = calendar.find(e => e.event.$ref.includes(gpId));
        
        if (!calendarEvent) {
            return interaction.editReply({ content: "❌ GP não encontrado." });
        }
        
        // Busca detalhes do evento
        try {
            const eventResponse = await fetch(`${ESPN_BASE_URL}/scoreboard?event=${gpId}`);
            const eventData = await eventResponse.json();
            event = eventData.events?.[0];
        } catch (error) {
            return interaction.editReply({ content: "❌ Erro ao buscar detalhes do GP." });
        }
    } else {
        // Usa o evento atual/mais recente
        event = data.events[0];
    }
    
    if (!event) {
        return interaction.editReply({ content: "❌ Evento não encontrado." });
    }
    
    // Encontra a corrida principal
    raceCompetition = event.competitions?.find(c => c.type?.abbreviation === "Race");
    
    if (!raceCompetition) {
        return interaction.editReply({ content: "❌ Dados da corrida não disponíveis." });
    }
    
    const competitors = raceCompetition.competitors || [];
    const status = raceCompetition.status?.type;
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 ${event.name} - Resultado`)
        .setColor("#E10600")
        .setThumbnail("https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png");
    
    // Status da corrida
    let statusText = "Agendada";
    if (status?.state === "post" || status?.completed) {
        statusText = "Finalizada ✅";
    } else if (status?.state === "in") {
        statusText = "🔴 AO VIVO";
    }
    
    embed.setDescription(`**Status:** ${statusText}\n**Voltas:** ${raceCompetition.status?.period || "N/A"}`);
    
    // Tabela de resultados
    let resultText = "```\n";
    resultText += "POS  #   PILOTO              EQUIPE\n";
    resultText += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    
    // Busca detalhes adicionais se disponível
    const eventId = event.id;
    const compId = raceCompetition.id;
    
    for (const comp of competitors.slice(0, 20)) {
        const pos = String(comp.order || "").padStart(2, " ");
        const driverName = (comp.athlete?.shortName || comp.athlete?.displayName || "N/A").substring(0, 16).padEnd(16, " ");
        const vehicleNum = (comp.vehicle?.number || "").padStart(2, " ");
        const team = (comp.vehicle?.manufacturer || "").substring(0, 10).padEnd(10, " ");
        
        const posEmoji = POSITION_EMOJIS[parseInt(pos)] || "  ";
        
        resultText += `${posEmoji}${pos}  ${vehicleNum}  ${driverName}  ${team}\n`;
    }
    
    resultText += "```";
    
    embed.addFields({
        name: "🏁 Classificação Final",
        value: resultText,
        inline: false
    });
    
    // Pódio em destaque
    const podium = competitors.slice(0, 3);
    if (podium.length >= 3) {
        const podiumText = podium.map((p, i) => {
            const emoji = POSITION_EMOJIS[i + 1];
            const name = p.athlete?.displayName || "N/A";
            const team = p.vehicle?.manufacturer || "";
            const teamInfo = TEAM_COLORS[team] || { emoji: "🏎️" };
            return `${emoji} **${name}** ${teamInfo.emoji}`;
        }).join("\n");
        
        embed.addFields({
            name: "🏆 Pódio",
            value: podiumText,
            inline: true
        });
    }
    
    await interaction.editReply({ embeds: [embed] });
}

async function handleAoVivo(interaction) {
    await interaction.deferReply();
    
    const channelId = interaction.channel.id;
    
    // Verifica se já existe um monitor ativo no canal
    if (activeMonitors.has(channelId)) {
        const existingMonitor = activeMonitors.get(channelId);
        try {
            await existingMonitor.message.delete();
        } catch (e) {}
        clearInterval(existingMonitor.interval);
        activeMonitors.delete(channelId);
    }
    
    const data = await fetchScoreboard();
    if (!data || !data.events || data.events.length === 0) {
        return interaction.editReply({ content: "❌ Nenhum evento de F1 disponível no momento." });
    }
    
    const event = data.events[0];
    const competitions = event.competitions || [];
    
    // Encontra sessão ao vivo ou mais próxima
    let activeSession = competitions.find(c => c.status?.type?.state === "in");
    
    if (!activeSession) {
        // Se não há sessão ao vivo, mostra a próxima ou última
        const now = new Date();
        activeSession = competitions
            .filter(c => new Date(c.date) > now)
            .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
        
        if (!activeSession) {
            activeSession = competitions
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        }
    }
    
    if (!activeSession) {
        return interaction.editReply({ content: "❌ Nenhuma sessão disponível." });
    }
    
    const createLiveEmbed = async () => {
        // Re-fetch dados atualizados
        const freshData = await fetchScoreboard();
        const freshEvent = freshData?.events?.[0];
        const freshSession = freshEvent?.competitions?.find(c => c.id === activeSession.id);
        
        const session = freshSession || activeSession;
        const competitors = session.competitors || [];
        const status = session.status?.type;
        const sessionType = session.type?.abbreviation || "Sessão";
        
        const sessionNames = {
            "FP1": "Treino Livre 1",
            "FP2": "Treino Livre 2",
            "FP3": "Treino Livre 3",
            "Qual": "Classificação",
            "Race": "Corrida",
            "Sprint": "Sprint",
            "Sprint Shootout": "Sprint Shootout"
        };
        
        const sessionName = sessionNames[sessionType] || sessionType;
        const isLive = status?.state === "in";
        const isFinished = status?.state === "post" || status?.completed;
        
        // Busca detalhes adicionais dos competidores
        const eventId = freshEvent?.id || event.id;
        const compId = session.id;
        
        const embed = new EmbedBuilder()
            .setTitle(`🏎️ ${freshEvent?.name || event.name}`)
            .setColor(isLive ? "#00FF00" : isFinished ? "#888888" : "#E10600")
            .setThumbnail("https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png");
        
        // Status
        let statusLine = "";
        if (isLive) {
            statusLine = `🔴 **${sessionName} AO VIVO**`;
            if (sessionType === "Race" && status?.period) {
                statusLine += ` | Volta ${status.period}`;
            }
        } else if (isFinished) {
            statusLine = `✅ **${sessionName} - Finalizada**`;
        } else {
            const sessionDate = moment(session.date).tz("America/Sao_Paulo");
            statusLine = `⏳ **${sessionName}** - ${sessionDate.format("DD/MM HH:mm")}`;
        }
        
        let description = `${statusLine}\n\n`;
        
        // Lista de pilotos
        description += "```\n";
        description += "POS  #   PILOTO              EQUIPE        GAP\n";
        description += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        
        // Tenta buscar detalhes com gaps (se disponível)
        let detailedData = null;
        if (isLive || isFinished) {
            detailedData = await fetchEventDetails(eventId, compId);
        }
        
        for (let i = 0; i < Math.min(competitors.length, 20); i++) {
            const comp = competitors[i];
            const pos = String(comp.order || i + 1).padStart(2, " ");
            const driverName = (comp.athlete?.shortName || comp.athlete?.displayName || "N/A").substring(0, 16).padEnd(16, " ");
            
            // Tenta pegar número e equipe dos detalhes
            let vehicleNum = "";
            let team = "";
            let gap = "";
            
            if (detailedData?.competitors) {
                const detailedComp = detailedData.competitors.find(dc => dc.id === comp.id);
                if (detailedComp) {
                    vehicleNum = detailedComp.vehicle?.number || "";
                    team = detailedComp.vehicle?.manufacturer || "";
                    
                    // Busca gap se disponível
                    if (i > 0) {
                        try {
                            const stats = await fetchCompetitorStats(eventId, compId, comp.id);
                            const behindTime = stats?.splits?.categories?.[0]?.stats?.find(s => s.name === "behindTime");
                            if (behindTime?.displayValue) {
                                gap = behindTime.displayValue;
                            }
                        } catch (e) {}
                    }
                }
            }
            
            vehicleNum = vehicleNum.padStart(2, " ");
            team = team.substring(0, 10).padEnd(10, " ");
            gap = i === 0 ? "LÍDER".padStart(8, " ") : gap.padStart(8, " ");
            
            const posEmoji = POSITION_EMOJIS[parseInt(pos)] || "  ";
            
            description += `${posEmoji}${pos}  ${vehicleNum}  ${driverName}  ${team}  ${gap}\n`;
        }
        
        description += "```";
        
        embed.setDescription(description);
        
        const updateTime = moment().tz("America/Sao_Paulo").format("HH:mm:ss");
        embed.setFooter({ text: `🔄 Atualizado: ${updateTime} • Atualiza a cada 30s` });
        
        return { embed, isLive, isFinished };
    };
    
    // Cria embed inicial
    const { embed: initialEmbed, isLive, isFinished } = await createLiveEmbed();
    
    const stopButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("f1_stop_monitor")
            .setLabel("⏹️ Parar Monitoramento")
            .setStyle(ButtonStyle.Danger)
    );
    
    const message = await interaction.editReply({
        embeds: [initialEmbed],
        components: isFinished ? [] : [stopButton]
    });
    
    // Se já terminou, não precisa de monitoramento
    if (isFinished) {
        return;
    }
    
    // Configura atualização automática
    const updateInterval = setInterval(async () => {
        try {
            const { embed: updatedEmbed, isFinished: finished } = await createLiveEmbed();
            
            await message.edit({
                embeds: [updatedEmbed],
                components: finished ? [] : [stopButton]
            });
            
            if (finished) {
                clearInterval(updateInterval);
                activeMonitors.delete(channelId);
            }
        } catch (error) {
            console.error("Erro ao atualizar F1 ao vivo:", error);
            if (error.code === 10008) { // Message deleted
                clearInterval(updateInterval);
                activeMonitors.delete(channelId);
            }
        }
    }, 30000); // 30 segundos
    
    // Salva referência do monitor
    activeMonitors.set(channelId, {
        message,
        interval: updateInterval,
        userId: interaction.user.id
    });
    
    // Collector para botão de parar
    const collector = message.createMessageComponentCollector({
        time: 3600000 // 1 hora
    });
    
    collector.on("collect", async (i) => {
        if (i.customId === "f1_stop_monitor") {
            clearInterval(updateInterval);
            activeMonitors.delete(channelId);
            
            const stoppedEmbed = EmbedBuilder.from(initialEmbed)
                .setColor("#888888")
                .setFooter({ text: "⏹️ Monitoramento encerrado" });
            
            await i.update({
                embeds: [stoppedEmbed],
                components: []
            });
            
            collector.stop();
        }
    });
    
    collector.on("end", () => {
        if (activeMonitors.has(channelId)) {
            clearInterval(activeMonitors.get(channelId).interval);
            activeMonitors.delete(channelId);
        }
    });
}

