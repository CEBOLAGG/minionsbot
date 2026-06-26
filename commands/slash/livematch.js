const SlashCommand = require("../../lib/SlashCommand");
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    Colors,
    // Components V2
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    SeparatorBuilder,
    ThumbnailBuilder,
    MessageFlags
} = require("discord.js");
const fetch = require("node-fetch");
const moment = require("moment-timezone");

// Configuração de ligas da ESPN
const LEAGUES = {
    "fifa.world": { name: "Copa do Mundo FIFA", emoji: "🌍🏆" },
    "fifa.friendly": { name: "Amistosos de Seleções", emoji: "🌍" },
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
};

// Armazena os monitores ativos (matchId -> monitorData)
const activeMonitors = new Map();

// Intervalo de verificação (em ms) - 10 segundos
const CHECK_INTERVAL = 10000;

const command = new SlashCommand()
    .setName("livematch")
    .setDescription("Monitora jogos ao vivo e notifica eventos (gols, cartões, etc.)")
    .setRun(async (client, interaction) => {
        await interaction.deferReply();
        
        try {
            // Busca jogos ao vivo
            const liveMatches = await fetchLiveMatches();
            
            if (!liveMatches || liveMatches.length === 0) {
                // Usa Components V2 para mensagem de "nenhum jogo"
                const noMatchesContainer = new ContainerBuilder()
                    .setAccentColor(0xE74C3C);
                
                const noMatchesText = new TextDisplayBuilder()
                    .setContent(
                        `## 🔴 Monitor de Jogos ao Vivo\n\n` +
                        `❌ **Nenhum jogo ao vivo no momento.**\n\n` +
                        `Tente novamente quando houver jogos em andamento!\n\n` +
                        `-# Dados da ESPN • ${moment().format('HH:mm:ss')}`
                    );
                
                noMatchesContainer.addTextDisplayComponents(noMatchesText);
                
                return interaction.editReply({ 
                    components: [noMatchesContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Cria Components V2 com jogos disponíveis
            const matchComponents = createLiveMatchesV2(liveMatches);
            
            await interaction.editReply(matchComponents);
            
            // Configura collector para os botões
            const message = await interaction.fetchReply();
            setupButtonCollector(client, message, interaction.user.id, interaction.channel);
            
        } catch (error) {
            console.error("Erro ao buscar jogos ao vivo:", error);
            return interaction.editReply("❌ Erro ao buscar jogos ao vivo. Tente novamente mais tarde.");
        }
    });

// Cria Components V2 com lista de jogos ao vivo
function createLiveMatchesV2(matches) {
    const components = [];
    
    // Container principal
    const mainContainer = new ContainerBuilder()
        .setAccentColor(0xE74C3C); // Vermelho para "ao vivo"
    
    // Header
    const headerText = new TextDisplayBuilder()
        .setContent(
            `## 🔴 Jogos ao Vivo\n` +
            `Clique no botão **📺 Monitorar** ao lado do jogo desejado\n\n` +
            `-# ${matches.length} jogo(s) encontrado(s) • Dados da ESPN`
        );
    mainContainer.addTextDisplayComponents(headerText);
    
    mainContainer.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
    );
    
    // Agrupa por liga
    const byLeague = {};
    for (const match of matches) {
        const key = match.leagueName;
        if (!byLeague[key]) byLeague[key] = { emoji: match.leagueEmoji, games: [] };
        byLeague[key].games.push(match);
    }
    
    let matchIndex = 0;
    const leagueEntries = Object.entries(byLeague);
    
    for (let leagueIdx = 0; leagueIdx < leagueEntries.length; leagueIdx++) {
        const [leagueName, data] = leagueEntries[leagueIdx];
        
        // Título da liga
        const leagueHeader = new TextDisplayBuilder()
            .setContent(`### ${data.emoji} ${leagueName}`);
        mainContainer.addTextDisplayComponents(leagueHeader);
        
        // Jogos da liga
        for (let i = 0; i < data.games.length && matchIndex < 10; i++) {
            const match = data.games[i];
            matchIndex++;
            
            // Section com jogo e botão de monitorar
            const matchSection = new SectionBuilder();
            
            const matchInfo = new TextDisplayBuilder()
                .setContent(
                    `**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**\n` +
                    `⏱️ ${match.status}`
                );
            matchSection.addTextDisplayComponents(matchInfo);
            
            // Botão de monitorar ao lado
            const monitorButton = new ButtonBuilder()
                .setCustomId(`monitor_${match.id}_${match.leagueId}`)
                .setLabel("📺")
                .setStyle(ButtonStyle.Success);
            matchSection.setButtonAccessory(monitorButton);
            
            mainContainer.addSectionComponents(matchSection);
        }
        
        // Separador entre ligas (exceto na última)
        if (leagueIdx < leagueEntries.length - 1) {
            mainContainer.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            );
        }
    }
    
    components.push(mainContainer);
    
    return {
        components,
        flags: MessageFlags.IsComponentsV2
    };
}

// Busca jogos ao vivo de todas as ligas
async function fetchLiveMatches() {
    const allMatches = [];
    const today = moment().format("YYYYMMDD");
    
    const promises = Object.keys(LEAGUES).map(async (leagueId) => {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${today}`;
            const response = await fetch(url, { timeout: 10000 });
            
            if (!response.ok) return [];
            
            const data = await response.json();
            
            if (!data.events) return [];
            
            // Filtra apenas jogos ao vivo
            return data.events
                .filter(event => {
                    const status = event.status?.type?.name;
                    return status === "STATUS_IN_PROGRESS" || 
                           status === "STATUS_HALFTIME" ||
                           status === "STATUS_FIRST_HALF" ||
                           status === "STATUS_SECOND_HALF";
                })
                .map(event => parseMatch(event, leagueId));
        } catch (err) {
            return [];
        }
    });
    
    const results = await Promise.all(promises);
    results.forEach(matches => allMatches.push(...matches));
    
    return allMatches;
}

// Parse de uma partida
function parseMatch(event, leagueId) {
    const competition = event.competitions?.[0];
    const homeTeamData = competition?.competitors?.find(c => c.homeAway === "home");
    const awayTeamData = competition?.competitors?.find(c => c.homeAway === "away");
    
    return {
        id: event.id,
        leagueId: leagueId,
        leagueName: LEAGUES[leagueId]?.name || "Liga",
        leagueEmoji: LEAGUES[leagueId]?.emoji || "⚽",
        homeTeam: homeTeamData?.team?.displayName || "TBA",
        homeTeamShort: homeTeamData?.team?.abbreviation || homeTeamData?.team?.shortDisplayName || "TBA",
        awayTeam: awayTeamData?.team?.displayName || "TBA",
        awayTeamShort: awayTeamData?.team?.abbreviation || awayTeamData?.team?.shortDisplayName || "TBA",
        homeScore: parseInt(homeTeamData?.score) || 0,
        awayScore: parseInt(awayTeamData?.score) || 0,
        homeTeamLogo: homeTeamData?.team?.logo || null,
        awayTeamLogo: awayTeamData?.team?.logo || null,
        status: event.status?.type?.shortDetail || "Ao Vivo",
        clock: event.status?.displayClock || "",
        venue: competition?.venue?.fullName || null
    };
}

// Configura collector para botões de seleção de jogo
function setupButtonCollector(client, message, userId, channel) {
    const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === userId && i.customId.startsWith("monitor_"),
        time: 300000 // 5 minutos para escolher
    });
    
    collector.on("collect", async (buttonInteraction) => {
        const customId = buttonInteraction.customId;
        
        // Inicia monitoramento
        const parts = customId.split("_");
        const matchId = parts[1];
        const leagueId = parts.slice(2).join("_"); // Liga pode ter underscore
        
        await startMonitoringV2(client, buttonInteraction, matchId, leagueId, channel);
        collector.stop();
    });
    
    collector.on("end", (collected, reason) => {
        if (reason === "time") {
            message.edit({ components: [] }).catch(() => {});
        }
    });
}

// Inicia monitoramento de um jogo usando Components V2
async function startMonitoringV2(client, interaction, matchId, leagueId, channel) {
    try {
        // Busca dados atuais do jogo
        const matchData = await fetchMatchDetails(matchId, leagueId);
        
        if (!matchData) {
            return interaction.update({ 
                content: "❌ Não foi possível encontrar os dados do jogo.", 
                embeds: [], 
                components: [],
                flags: 0
            });
        }
        
        const monitorKey = `${channel.id}_${interaction.user.id}`;
        
        // Para monitor anterior se existir
        await cleanupAndStop(monitorKey, channel);
        
        // Cria Components V2 de monitoramento
        const monitorComponents = createMonitoringV2(matchData);
        
        await interaction.update(monitorComponents);
        
        // Armazena eventos já conhecidos
        const knownEvents = new Set();
        const currentEvents = await fetchMatchEvents(matchId, leagueId);
        currentEvents.forEach(e => knownEvents.add(e.id || `${e.clock}_${e.type}`));
        
        // Lista de mensagens enviadas (para apagar depois)
        const sentMessages = [];
        
        // Busca a mensagem para o collector do botão de parar
        const monitorMessage = await interaction.fetchReply();
        const userId = interaction.user.id;
        
        // Inicia loop de monitoramento
        const monitorData = {
            matchId,
            leagueId,
            channel,
            message: monitorMessage,
            userId: userId,
            knownEvents,
            lastScore: { home: matchData.homeScore, away: matchData.awayScore },
            active: true,
            interval: null,
            sentMessages,
            stopCollector: null
        };
        
        // Cria collector para o botão de parar
        const stopCollector = monitorMessage.createMessageComponentCollector({
            filter: (i) => i.user.id === userId && i.customId === "stop_monitor",
            time: 7200000 // 2 horas (tempo máximo de um jogo)
        });
        
        stopCollector.on("collect", async (btnInteraction) => {
            try {
                // Para monitoramento
                await cleanupAndStop(monitorKey, channel);
                
                // Mensagem de encerramento com Components V2
                const stoppedContainer = new ContainerBuilder()
                    .setAccentColor(0x95A5A6);
                
                const stoppedText = new TextDisplayBuilder()
                    .setContent(
                        `## ⏹️ Monitoramento Encerrado\n\n` +
                        `Monitoramento do jogo foi finalizado.\n\n` +
                        `-# Esta mensagem será apagada em 5 segundos`
                    );
                stoppedContainer.addTextDisplayComponents(stoppedText);
                
                await btnInteraction.update({ 
                    components: [stoppedContainer],
                    flags: MessageFlags.IsComponentsV2
                });
                
                // Apaga a mensagem após 5 segundos
                setTimeout(async () => {
                    try {
                        const msg = await btnInteraction.fetchReply();
                        await msg.delete();
                    } catch (e) {
                        // Ignora erro se a mensagem já foi apagada
                    }
                }, 5000);
            } catch (err) {
                console.error("Erro ao parar monitoramento:", err.message);
            }
        });
        
        stopCollector.on("end", () => {
            // Limpa quando o collector expira
        });
        
        monitorData.stopCollector = stopCollector;
        
        // Função de verificação
        const checkForUpdates = async () => {
            if (!monitorData.active) return;
            
            try {
                const updatedMatch = await fetchMatchDetails(matchId, leagueId);
                
                if (!updatedMatch) return;
                
                // Verifica se o jogo acabou
                if (updatedMatch.statusType === "STATUS_FINAL" || 
                    updatedMatch.statusType === "STATUS_FULL_TIME" ||
                    updatedMatch.status?.toLowerCase().includes("full time") ||
                    updatedMatch.status?.toLowerCase().includes("ft")) {
                    
                    // Para o monitoramento
                    monitorData.active = false;
                    if (monitorData.interval) {
                        clearInterval(monitorData.interval);
                    }
                    
                    // Apaga todas as mensagens de eventos
                    await deleteAllMessages(monitorData);
                    
                    // Busca estatísticas completas do jogo
                    const fullDetails = await fetchFullMatchDetails(matchId, leagueId);
                    
                    // Tenta Components V2, fallback para embed
                    try {
                        const finalComponents = createFinalStatsV2(updatedMatch, fullDetails);
                        await monitorData.message.edit(finalComponents);
                    } catch (v2Error) {
                        console.log("Components V2 failed for final stats, using embed fallback");
                        const finalEmbed = createFinalStatsEmbed(updatedMatch, fullDetails);
                        await monitorData.message.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
                    }
                    
                    // Remove do mapa de monitores ativos
                    activeMonitors.delete(monitorKey);
                    return;
                }
                
                // Busca novos eventos
                const events = await fetchMatchEvents(matchId, leagueId);
                
                for (const event of events) {
                    const eventKey = event.id || `${event.clock}_${event.type}_${event.text}`;
                    
                    if (!monitorData.knownEvents.has(eventKey)) {
                        monitorData.knownEvents.add(eventKey);
                        
                        // Tenta Components V2, fallback para embed
                        try {
                            const eventComponents = createEventV2(event, updatedMatch);
                            if (eventComponents) {
                                const eventMsg = await channel.send(eventComponents);
                                sentMessages.push(eventMsg);
                            }
                        } catch (v2Error) {
                            // Fallback para embed normal
                            const eventEmbed = createEventEmbed(event, updatedMatch);
                            if (eventEmbed) {
                                const eventMsg = await channel.send({ embeds: [eventEmbed] });
                                sentMessages.push(eventMsg);
                            }
                        }
                    }
                }
                
                // Verifica mudança de placar
                if (updatedMatch.homeScore !== monitorData.lastScore.home || 
                    updatedMatch.awayScore !== monitorData.lastScore.away) {
                    
                    const scoreKey = `score_${updatedMatch.homeScore}_${updatedMatch.awayScore}`;
                    if (!monitorData.knownEvents.has(scoreKey)) {
                        monitorData.knownEvents.add(scoreKey);
                        
                        let scoringTeam = "";
                        let scoringTeamLogo = null;
                        
                        if (updatedMatch.homeScore > monitorData.lastScore.home) {
                            scoringTeam = updatedMatch.homeTeam;
                            scoringTeamLogo = updatedMatch.homeTeamLogo;
                        } else if (updatedMatch.awayScore > monitorData.lastScore.away) {
                            scoringTeam = updatedMatch.awayTeam;
                            scoringTeamLogo = updatedMatch.awayTeamLogo;
                        }
                        
                        // Tenta Components V2, fallback para embed
                        try {
                            const goalContainer = new ContainerBuilder()
                                .setAccentColor(0x2ECC71);
                            
                            const goalSection = new SectionBuilder();
                            const goalText = new TextDisplayBuilder()
                                .setContent(
                                    `## ⚽ GOOOOOL!\n\n` +
                                    `**${scoringTeam}** marcou!\n\n` +
                                    `**${updatedMatch.homeTeam}** \`${updatedMatch.homeScore}\` - \`${updatedMatch.awayScore}\` **${updatedMatch.awayTeam}**\n\n` +
                                    `-# ${updatedMatch.status}`
                                );
                            goalSection.addTextDisplayComponents(goalText);
                            
                            if (scoringTeamLogo) {
                                try {
                                    goalSection.setThumbnailAccessory(
                                        new ThumbnailBuilder().setURL(scoringTeamLogo)
                                    );
                                } catch (e) {}
                            }
                            
                            goalContainer.addSectionComponents(goalSection);
                            
                            const goalMsg = await channel.send({ 
                                components: [goalContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                            sentMessages.push(goalMsg);
                        } catch (v2Error) {
                            // Fallback para embed normal
                            const goalEmbed = new EmbedBuilder()
                                .setTitle("⚽ GOOOOOL!")
                                .setColor(0x2ECC71)
                                .setDescription(`**${scoringTeam}** marcou!\n\n**${updatedMatch.homeTeam}** ${updatedMatch.homeScore} - ${updatedMatch.awayScore} **${updatedMatch.awayTeam}**`)
                                .setFooter({ text: updatedMatch.status })
                                .setTimestamp();
                            
                            if (scoringTeamLogo) {
                                goalEmbed.setThumbnail(scoringTeamLogo);
                            }
                            
                            const goalMsg = await channel.send({ embeds: [goalEmbed] });
                            sentMessages.push(goalMsg);
                        }
                    }
                    
                    monitorData.lastScore = { home: updatedMatch.homeScore, away: updatedMatch.awayScore };
                }
                
                // Atualiza mensagem principal - tenta Components V2, fallback para embed
                try {
                    const updatedComponents = createMonitoringV2(updatedMatch);
                    await monitorData.message.edit(updatedComponents);
                } catch (v2Error) {
                    // Fallback para embed normal
                    const monitorEmbed = createMonitoringEmbed(updatedMatch);
                    const stopRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("stop_monitor")
                                .setLabel("⏹️ Parar Monitoramento")
                                .setStyle(ButtonStyle.Danger)
                        );
                    await monitorData.message.edit({ embeds: [monitorEmbed], components: [stopRow] }).catch(() => {});
                }
                
            } catch (err) {
                console.error("Erro no monitoramento:", err.message);
            }
        };
        
        // Inicia intervalo
        monitorData.interval = setInterval(checkForUpdates, CHECK_INTERVAL);
        activeMonitors.set(monitorKey, monitorData);
        
        // Executa primeira verificação
        setTimeout(checkForUpdates, 5000);
        
    } catch (error) {
        console.error("Erro ao iniciar monitoramento:", error);
        await interaction.update({ 
            content: "❌ Erro ao iniciar monitoramento.", 
            embeds: [], 
            components: [],
            flags: 0
        });
    }
}

// Cria Components V2 de monitoramento
function createMonitoringV2(match) {
    const mainContainer = new ContainerBuilder()
        .setAccentColor(0xE74C3C); // Vermelho = ao vivo
    
    // Header com info do jogo
    const headerSection = new SectionBuilder();
    const headerText = new TextDisplayBuilder()
        .setContent(
            `## 🔴 ${match.homeTeam} vs ${match.awayTeam}\n\n` +
            `${match.leagueEmoji} **${match.leagueName}**\n\n` +
            `### **${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**\n\n` +
            `⏱️ ${match.status || "Em andamento"}`
        );
    headerSection.addTextDisplayComponents(headerText);
    
    // Tenta adicionar logo do time da casa
    if (match.homeTeamLogo) {
        try {
            headerSection.setThumbnailAccessory(
                new ThumbnailBuilder().setURL(match.homeTeamLogo)
            );
        } catch (e) {}
    }
    
    mainContainer.addSectionComponents(headerSection);
    
    // Informações adicionais
    if (match.venue || match.referee) {
        mainContainer.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
        );
        
        let infoContent = "";
        if (match.venue) infoContent += `🏟️ **Estádio:** ${match.venue}\n`;
        if (match.referee) infoContent += `👨‍⚖️ **Árbitro:** ${match.referee}`;
        
        const infoText = new TextDisplayBuilder()
            .setContent(infoContent.trim());
        mainContainer.addTextDisplayComponents(infoText);
    }
    
    mainContainer.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
    );
    
    // Botão de parar DENTRO do container
    const stopButton = new ButtonBuilder()
        .setCustomId("stop_monitor")
        .setLabel("⏹️ Parar Monitoramento")
        .setStyle(ButtonStyle.Danger);
    
    const buttonRow = new ActionRowBuilder().addComponents(stopButton);
    mainContainer.addActionRowComponents(buttonRow);
    
    // Footer
    const footerText = new TextDisplayBuilder()
        .setContent(`-# 🔴 AO VIVO • Atualiza a cada ${CHECK_INTERVAL/1000}s • ${moment().format('HH:mm:ss')}`);
    mainContainer.addTextDisplayComponents(footerText);
    
    return {
        components: [mainContainer],
        flags: MessageFlags.IsComponentsV2
    };
}

// Cria Components V2 final com estatísticas
function createFinalStatsV2(match, details) {
    const mainContainer = new ContainerBuilder()
        .setAccentColor(0x2ECC71); // Verde = finalizado
    
    // Header
    const headerText = new TextDisplayBuilder()
        .setContent(
            `## 🏁 Fim de Jogo\n` +
            `${match.leagueEmoji} **${match.leagueName}**`
        );
    mainContainer.addTextDisplayComponents(headerText);
    
    mainContainer.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
    );
    
    // Placar final
    const scoreSection = new SectionBuilder();
    const scoreText = new TextDisplayBuilder()
        .setContent(
            `### ⚽ Placar Final\n\n` +
            `**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**`
        );
    scoreSection.addTextDisplayComponents(scoreText);
    
    if (match.homeTeamLogo) {
        try {
            scoreSection.setThumbnailAccessory(
                new ThumbnailBuilder().setURL(match.homeTeamLogo)
            );
        } catch (e) {}
    }
    
    mainContainer.addSectionComponents(scoreSection);
    
    // Estatísticas
    if (details) {
        // Gols
        const scoringPlays = details.scoringPlays || [];
        if (scoringPlays.length > 0) {
            mainContainer.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            );
            
            let goalsContent = "### ⚽ Gols\n\n";
            for (const play of scoringPlays.slice(0, 6)) {
                const time = play.clock?.displayValue || "";
                const scorer = play.athletesInvolved?.[0]?.displayName || play.text || "";
                const team = play.team?.abbreviation || "";
                if (scorer) {
                    const truncatedScorer = scorer.length > 25 ? scorer.substring(0, 22) + "..." : scorer;
                    goalsContent += `⚽ \`${time}\` ${truncatedScorer} (${team})\n`;
                }
            }
            
            const goalsText = new TextDisplayBuilder().setContent(goalsContent.trim());
            mainContainer.addTextDisplayComponents(goalsText);
        }
        
        // Stats do jogo
        const stats = extractStats(details);
        if (stats) {
            mainContainer.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            );
            
            const statsText = new TextDisplayBuilder()
                .setContent(`### 📊 Estatísticas\n\n${stats}`);
            mainContainer.addTextDisplayComponents(statsText);
        }
        
        // Eventos
        const keyEvents = extractKeyEvents(details);
        if (keyEvents.length > 0) {
            mainContainer.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true)
            );
            
            const eventsContent = "### 📋 Eventos\n\n" + keyEvents.slice(0, 6).join("\n");
            const eventsText = new TextDisplayBuilder().setContent(eventsContent);
            mainContainer.addTextDisplayComponents(eventsText);
        }
    }
    
    // Info final
    mainContainer.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
    );
    
    let finalInfo = "";
    if (match.venue) finalInfo += `🏟️ ${match.venue}`;
    if (match.referee) finalInfo += `  •  👨‍⚖️ ${match.referee}`;
    if (details?.gameInfo?.attendance) {
        finalInfo += `  •  👥 ${details.gameInfo.attendance.toLocaleString('pt-BR')}`;
    }
    
    const footerText = new TextDisplayBuilder()
        .setContent(
            (finalInfo ? finalInfo + "\n\n" : "") +
            `-# Monitoramento encerrado • ${moment().format('DD/MM/YYYY HH:mm')}`
        );
    mainContainer.addTextDisplayComponents(footerText);
    
    return {
        components: [mainContainer],
        flags: MessageFlags.IsComponentsV2
    };
}

// Cria Components V2 para notificação de evento
function createEventV2(event, match) {
    const type = (event.type || "").toLowerCase();
    
    let title, accentColor;
    let isGoal = false;
    
    if (type.includes("goal") || type.includes("gol")) {
        title = "⚽ GOOOOOL!";
        accentColor = 0x2ECC71;
        isGoal = true;
    } else if (type.includes("yellow") || type.includes("amarelo")) {
        title = "🟨 Cartão Amarelo";
        accentColor = 0xF1C40F;
    } else if (type.includes("red") || type.includes("vermelho")) {
        title = "🟥 Cartão Vermelho!";
        accentColor = 0xE74C3C;
    } else if (type.includes("penalty") || type.includes("pênalti") || type.includes("penalti")) {
        title = "🎯 Pênalti!";
        accentColor = 0x9B59B6;
    } else if (type.includes("var") || type.includes("video")) {
        title = "📺 VAR";
        accentColor = 0x3498DB;
    } else if (type.includes("substitution") || type.includes("substituição")) {
        title = "🔄 Substituição";
        accentColor = 0x95A5A6;
    } else if (type.includes("disallowed") || type.includes("anulado")) {
        title = "❌ Gol Anulado!";
        accentColor = 0xE74C3C;
    } else if (type.includes("start") || type.includes("kick")) {
        return null;
    } else {
        title = `📋 ${event.type || "Evento"}`;
        accentColor = 0x95A5A6;
    }
    
    const eventContainer = new ContainerBuilder()
        .setAccentColor(accentColor);
    
    const eventSection = new SectionBuilder();
    
    let description = `## ${title}\n\n`;
    if (event.player) description += `**${event.player}**\n`;
    if (event.team) description += `${event.team}\n`;
    if (event.text && event.text !== event.player) {
        const truncText = event.text.length > 150 ? event.text.substring(0, 147) + "..." : event.text;
        description += truncText + "\n";
    }
    description += `\n**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**`;
    if (event.clock) description += `\n\n⏱️ ${event.clock}'`;
    description += `\n\n-# ${match.leagueName}`;
    
    const eventText = new TextDisplayBuilder().setContent(description);
    eventSection.addTextDisplayComponents(eventText);
    
    // Thumbnail do time (se gol)
    if (isGoal && event.teamLogo) {
        try {
            eventSection.setThumbnailAccessory(
                new ThumbnailBuilder().setURL(event.teamLogo)
            );
        } catch (e) {}
    }
    
    eventContainer.addSectionComponents(eventSection);
    
    return {
        components: [eventContainer],
        flags: MessageFlags.IsComponentsV2
    };
}

// Apaga todas as mensagens rastreadas
async function deleteAllMessages(monitorData) {
    if (!monitorData.sentMessages) return;
    
    for (const msg of monitorData.sentMessages) {
        try {
            await msg.delete();
        } catch (err) {
            // Ignora erros de mensagens já deletadas
        }
    }
    
    monitorData.sentMessages = [];
}

// Para monitoramento e limpa mensagens
async function cleanupAndStop(monitorKey, channel) {
    const monitor = activeMonitors.get(monitorKey);
    if (monitor) {
        monitor.active = false;
        
        if (monitor.interval) {
            clearInterval(monitor.interval);
        }
        
        if (monitor.stopCollector) {
            monitor.stopCollector.stop();
        }
        
        await deleteAllMessages(monitor);
        
        activeMonitors.delete(monitorKey);
    }
}

// Busca detalhes do jogo
async function fetchMatchDetails(matchId, leagueId) {
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${matchId}`;
        const response = await fetch(url, { timeout: 10000 });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        const header = data.header;
        const competition = header?.competitions?.[0];
        
        if (!competition) return null;
        
        const homeTeam = competition.competitors?.find(c => c.homeAway === "home");
        const awayTeam = competition.competitors?.find(c => c.homeAway === "away");
        
        const homeTeamLogo = homeTeam?.team?.logos?.[0]?.href || homeTeam?.team?.logo || null;
        const awayTeamLogo = awayTeam?.team?.logos?.[0]?.href || awayTeam?.team?.logo || null;
        
        return {
            id: matchId,
            leagueId: leagueId,
            leagueName: LEAGUES[leagueId]?.name || header?.league?.name || "Liga",
            leagueEmoji: LEAGUES[leagueId]?.emoji || "⚽",
            homeTeam: homeTeam?.team?.displayName || "TBA",
            awayTeam: awayTeam?.team?.displayName || "TBA",
            homeTeamLogo: homeTeamLogo,
            awayTeamLogo: awayTeamLogo,
            homeScore: parseInt(homeTeam?.score) || 0,
            awayScore: parseInt(awayTeam?.score) || 0,
            status: header?.gameNote || competition?.status?.type?.shortDetail || "Em andamento",
            statusType: competition?.status?.type?.name,
            clock: competition?.status?.displayClock || "",
            venue: data.gameInfo?.venue?.fullName || null,
            referee: data.gameInfo?.officials?.[0]?.displayName || null
        };
    } catch (err) {
        console.error("Erro ao buscar detalhes:", err.message);
        return null;
    }
}

// Busca detalhes completos do jogo
async function fetchFullMatchDetails(matchId, leagueId) {
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${matchId}`;
        const response = await fetch(url, { timeout: 10000 });
        
        if (!response.ok) return null;
        
        return await response.json();
    } catch (err) {
        console.error("Erro ao buscar detalhes completos:", err.message);
        return null;
    }
}

// Busca eventos do jogo
async function fetchMatchEvents(matchId, leagueId) {
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${matchId}`;
        const response = await fetch(url, { timeout: 10000 });
        
        if (!response.ok) return [];
        
        const data = await response.json();
        const events = [];
        
        const keyEvents = data.keyEvents || [];
        for (const event of keyEvents) {
            events.push({
                id: event.id,
                type: event.type?.text || event.type?.id || "evento",
                text: event.text || event.shortText || "",
                clock: event.clock?.displayValue || "",
                team: event.team?.displayName || "",
                teamLogo: event.team?.logos?.[0]?.href || event.team?.logo || null,
                player: event.athletesInvolved?.[0]?.displayName || ""
            });
        }
        
        const scoringPlays = data.scoringPlays || [];
        for (const play of scoringPlays) {
            events.push({
                id: `goal_${play.id || play.clock?.displayValue}`,
                type: "Goal",
                text: play.text || "",
                clock: play.clock?.displayValue || "",
                team: play.team?.displayName || "",
                teamLogo: play.team?.logos?.[0]?.href || play.team?.logo || null,
                player: play.athletesInvolved?.[0]?.displayName || "",
                scoreHome: play.homeScore,
                scoreAway: play.awayScore
            });
        }
        
        return events;
    } catch (err) {
        return [];
    }
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
        return null;
    }
}

// Extrai eventos importantes
function extractKeyEvents(details) {
    const events = [];
    
    try {
        const keyEvents = details?.keyEvents || [];
        
        for (const event of keyEvents) {
            const time = event.clock?.displayValue || "";
            const type = event.type?.text || event.type || "";
            const text = event.text || event.shortText || "";
            
            if (type.toLowerCase().includes("goal")) continue;
            
            let emoji = "📌";
            if (type.toLowerCase().includes("yellow")) {
                emoji = "🟨";
            } else if (type.toLowerCase().includes("red")) {
                emoji = "🟥";
            } else if (type.toLowerCase().includes("substitution")) {
                emoji = "🔄";
            } else if (type.toLowerCase().includes("var")) {
                emoji = "📺";
            }
            
            if (text) {
                const truncatedText = text.length > 50 ? text.substring(0, 47) + "..." : text;
                events.push(`${emoji} \`${time}\` ${truncatedText}`);
            }
        }
    } catch (err) {
        // Ignora erros
    }
    
    return events;
}

// ═══════════════════════════════════════════════════════
// FALLBACK EMBEDS (quando Components V2 falhar)
// ═══════════════════════════════════════════════════════

// Cria embed de monitoramento (fallback)
function createMonitoringEmbed(match) {
    const embed = new EmbedBuilder()
        .setTitle(`🔴 ${match.homeTeam} vs ${match.awayTeam}`)
        .setColor(0xE74C3C)
        .setDescription(
            `${match.leagueEmoji} **${match.leagueName}**\n\n` +
            `**${match.homeTeam}** \`${match.homeScore}\` - \`${match.awayScore}\` **${match.awayTeam}**\n\n` +
            `⏱️ ${match.status || "Em andamento"}`
        )
        .setFooter({ text: `🔴 AO VIVO • Atualiza a cada ${CHECK_INTERVAL/1000}s` })
        .setTimestamp();
    
    if (match.venue) {
        embed.addFields({ name: "🏟️ Estádio", value: match.venue, inline: true });
    }
    
    if (match.referee) {
        embed.addFields({ name: "👨‍⚖️ Árbitro", value: match.referee, inline: true });
    }
    
    if (match.homeTeamLogo) {
        embed.setThumbnail(match.homeTeamLogo);
    }
    
    return embed;
}

// Cria embed para notificação de evento (fallback)
function createEventEmbed(event, match) {
    const type = (event.type || "").toLowerCase();
    
    let title, color;
    
    if (type.includes("goal") || type.includes("gol")) {
        title = "⚽ GOOOOOL!";
        color = 0x2ECC71;
    } else if (type.includes("yellow") || type.includes("amarelo")) {
        title = "🟨 Cartão Amarelo";
        color = 0xF1C40F;
    } else if (type.includes("red") || type.includes("vermelho")) {
        title = "🟥 Cartão Vermelho!";
        color = 0xE74C3C;
    } else if (type.includes("penalty") || type.includes("pênalti")) {
        title = "🎯 Pênalti!";
        color = 0x9B59B6;
    } else if (type.includes("var") || type.includes("video")) {
        title = "📺 VAR";
        color = 0x3498DB;
    } else if (type.includes("substitution") || type.includes("substituição")) {
        title = "🔄 Substituição";
        color = 0x95A5A6;
    } else if (type.includes("disallowed") || type.includes("anulado")) {
        title = "❌ Gol Anulado!";
        color = 0xE74C3C;
    } else if (type.includes("start") || type.includes("kick")) {
        return null;
    } else {
        title = `📋 ${event.type || "Evento"}`;
        color = 0x95A5A6;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color);
    
    let description = "";
    if (event.player) description += `**${event.player}**\n`;
    if (event.team) description += `${event.team}\n`;
    if (event.text && event.text !== event.player) {
        description += event.text.length > 200 ? event.text.substring(0, 197) + "..." : event.text;
    }
    
    if (description) embed.setDescription(description);
    
    embed.addFields({
        name: "Placar",
        value: `**${match.homeTeam}** ${match.homeScore} - ${match.awayScore} **${match.awayTeam}**`,
        inline: true
    });
    
    if (event.clock) {
        embed.addFields({ name: "⏱️ Minuto", value: event.clock, inline: true });
    }
    
    if (event.teamLogo) {
        embed.setThumbnail(event.teamLogo);
    }
    
    embed.setFooter({ text: match.leagueName }).setTimestamp();
    
    return embed;
}

// Cria embed final com estatísticas (fallback)
function createFinalStatsEmbed(match, details) {
    const embed = new EmbedBuilder()
        .setTitle(`🏁 Fim de Jogo: ${match.homeTeam} vs ${match.awayTeam}`)
        .setColor(0x2ECC71)
        .setDescription(`${match.leagueEmoji} **${match.leagueName}**\n\n**RESULTADO FINAL**`);
    
    embed.addFields({
        name: "⚽ Placar Final",
        value: `**${match.homeTeam}** ${match.homeScore} - ${match.awayScore} **${match.awayTeam}**`,
        inline: false
    });
    
    if (details) {
        const scoringPlays = details.scoringPlays || [];
        if (scoringPlays.length > 0) {
            let goalsText = "";
            for (const play of scoringPlays.slice(0, 6)) {
                const time = play.clock?.displayValue || "";
                const scorer = play.athletesInvolved?.[0]?.displayName || play.text || "";
                const team = play.team?.abbreviation || "";
                if (scorer) {
                    const truncatedScorer = scorer.length > 25 ? scorer.substring(0, 22) + "..." : scorer;
                    goalsText += `⚽ \`${time}\` ${truncatedScorer} (${team})\n`;
                }
            }
            if (goalsText) {
                embed.addFields({ name: "⚽ Gols", value: goalsText.substring(0, 1024), inline: false });
            }
        }
        
        const stats = extractStats(details);
        if (stats) {
            embed.addFields({ name: "📊 Estatísticas", value: stats.substring(0, 1024), inline: false });
        }
        
        const keyEvents = extractKeyEvents(details);
        if (keyEvents.length > 0) {
            const eventsText = keyEvents.slice(0, 6).join("\n");
            embed.addFields({ name: "📋 Eventos", value: eventsText.substring(0, 1024), inline: false });
        }
    }
    
    if (match.venue) {
        embed.addFields({ name: "🏟️ Estádio", value: match.venue, inline: true });
    }
    
    if (match.referee) {
        embed.addFields({ name: "👨‍⚖️ Árbitro", value: match.referee, inline: true });
    }
    
    if (details?.gameInfo?.attendance) {
        embed.addFields({ name: "👥 Público", value: details.gameInfo.attendance.toLocaleString('pt-BR'), inline: true });
    }
    
    if (match.homeTeamLogo) {
        embed.setThumbnail(match.homeTeamLogo);
    }
    
    embed.setFooter({ text: "Monitoramento encerrado" }).setTimestamp();
    
    return embed;
}

module.exports = command;
