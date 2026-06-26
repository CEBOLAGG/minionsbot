/**
 * BetSettlement - Sistema de verificação e liquidação de apostas
 * Verifica jogos finalizados e processa apostas pendentes
 */

const fetch = require("node-fetch");
const moment = require("moment-timezone");
const {
    getAllPendingBets,
    settleBet,
    recordBetResult,
    getOrCreateWallet
} = require("./mongodb");

const BANANA_EMOJI = "🍌";
const MINION_EMOJI = "🟡";

// Cache de jogos já verificados (evita spam na API)
const checkedMatches = new Map();
const CHECK_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Limpa cache antigo
 */
function cleanCache() {
    const now = Date.now();
    for (const [key, timestamp] of checkedMatches.entries()) {
        if (now - timestamp > CHECK_CACHE_DURATION) {
            checkedMatches.delete(key);
        }
    }
}

/**
 * Verifica status de um jogo na ESPN
 * @param {string} matchId 
 * @param {string} leagueId 
 * @returns {Promise<object|null>}
 */
async function fetchMatchResult(matchId, leagueId) {
    try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard`;
        const response = await fetch(url, { timeout: 10000 });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        if (!data.events) return null;
        
        const match = data.events.find(e => e.id === matchId);
        
        if (!match) {
            // Tenta buscar no summary (jogos de dias anteriores)
            try {
                const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${matchId}`;
                const summaryResponse = await fetch(summaryUrl, { timeout: 10000 });
                
                if (summaryResponse.ok) {
                    const summaryData = await summaryResponse.json();
                    if (summaryData.header?.competitions?.[0]) {
                        const competition = summaryData.header.competitions[0];
                        const competitors = competition.competitors || [];
                        const status = competition.status;
                        
                        if (status?.type?.completed) {
                            const homeTeam = competitors.find(c => c.homeAway === "home");
                            const awayTeam = competitors.find(c => c.homeAway === "away");
                            
                            return {
                                finished: true,
                                homeScore: parseInt(homeTeam?.score) || 0,
                                awayScore: parseInt(awayTeam?.score) || 0
                            };
                        }
                    }
                }
            } catch (err) {
                console.error("Erro ao buscar summary:", err.message);
            }
            return null;
        }
        
        const competition = match.competitions?.[0];
        const status = match.status;
        
        // Verifica se o jogo terminou
        const isFinished = status?.type?.completed === true || 
                          status?.type?.name === "STATUS_FINAL" ||
                          status?.type?.name === "STATUS_FULL_TIME";
        
        if (!isFinished) {
            return { finished: false };
        }
        
        const homeTeamData = competition?.competitors?.find(c => c.homeAway === "home");
        const awayTeamData = competition?.competitors?.find(c => c.homeAway === "away");
        
        return {
            finished: true,
            homeScore: parseInt(homeTeamData?.score) || 0,
            awayScore: parseInt(awayTeamData?.score) || 0
        };
        
    } catch (error) {
        console.error(`Erro ao buscar resultado do jogo ${matchId}:`, error.message);
        return null;
    }
}

/**
 * Determina o vencedor baseado no placar
 * @param {number} homeScore 
 * @param {number} awayScore 
 * @returns {string} "home", "draw", ou "away"
 */
function determineWinner(homeScore, awayScore) {
    if (homeScore > awayScore) return "home";
    if (awayScore > homeScore) return "away";
    return "draw";
}

/**
 * Processa uma aposta individual
 * @param {object} bet 
 * @param {object} result 
 * @param {object} client - Discord client para notificações
 * @returns {Promise<boolean>}
 */
async function processBet(bet, result, client) {
    try {
        const winner = determineWinner(result.homeScore, result.awayScore);
        const won = bet.betType === winner;
        
        // Atualiza status da aposta
        await settleBet(bet._id, won ? "won" : "lost", {
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            winner: winner
        });
        
        // Atualiza carteira do usuário
        if (won) {
            // Ganhou - recebe o ganho potencial
            await recordBetResult(bet.odId, true, bet.potentialWin);
        } else {
            // Perdeu - já foi deduzido quando apostou
            await recordBetResult(bet.odId, false, bet.betAmount);
        }
        
        // Tenta notificar o usuário
        if (client) {
            try {
                const user = await client.users.fetch(bet.odId);
                const wallet = await getOrCreateWallet(bet.odId);
                
                const resultEmoji = won ? "🎉" : "😢";
                const resultText = won 
                    ? `**VOCÊ GANHOU!** +${bet.potentialWin.toLocaleString("pt-BR")} ${BANANA_EMOJI}`
                    : `Você perdeu ${bet.betAmount.toLocaleString("pt-BR")} ${BANANA_EMOJI}`;
                
                const betTypeText = {
                    "home": `🏠 Vitória ${bet.homeTeam}`,
                    "draw": "🤝 Empate",
                    "away": `✈️ Vitória ${bet.awayTeam}`
                }[bet.betType];
                
                const dm = await user.createDM();
                await dm.send({
                    embeds: [{
                        title: `${MINION_EMOJI} ${resultEmoji} Resultado da Aposta`,
                        color: won ? 0x2ECC71 : 0xE74C3C,
                        description: resultText,
                        fields: [
                            {
                                name: "⚽ Jogo",
                                value: `**${bet.homeTeam}** ${result.homeScore} - ${result.awayScore} **${bet.awayTeam}**`,
                                inline: false
                            },
                            {
                                name: "🎯 Sua Aposta",
                                value: betTypeText,
                                inline: true
                            },
                            {
                                name: "📊 Odds",
                                value: `${bet.odds.toFixed(2)}x`,
                                inline: true
                            },
                            {
                                name: `${BANANA_EMOJI} Saldo Atual`,
                                value: `${wallet.balance.toLocaleString("pt-BR")} bananas`,
                                inline: true
                            }
                        ],
                        footer: { text: "Use /minionsbet apostar para fazer novas apostas!" },
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch (dmError) {
                // Usuário pode ter DMs desativadas - ignora
            }
        }
        
        return true;
    } catch (error) {
        console.error(`Erro ao processar aposta ${bet._id}:`, error.message);
        return false;
    }
}

/**
 * Verifica e liquida todas as apostas pendentes
 * @param {object} client - Discord client
 * @returns {Promise<{processed: number, won: number, lost: number}>}
 */
async function settlePendingBets(client) {
    cleanCache();
    
    const pendingBets = await getAllPendingBets();
    
    if (!pendingBets || pendingBets.length === 0) {
        return { processed: 0, won: 0, lost: 0 };
    }
    
    console.log(`[BetSettlement] Verificando ${pendingBets.length} apostas pendentes...`);
    
    let processed = 0;
    let won = 0;
    let lost = 0;
    
    // Agrupa por jogo para evitar múltiplas requisições
    const betsByMatch = {};
    for (const bet of pendingBets) {
        const key = `${bet.matchId}:${bet.leagueId}`;
        if (!betsByMatch[key]) {
            betsByMatch[key] = { bets: [], matchId: bet.matchId, leagueId: bet.leagueId };
        }
        betsByMatch[key].bets.push(bet);
    }
    
    for (const key of Object.keys(betsByMatch)) {
        // Verifica cache
        if (checkedMatches.has(key)) {
            continue;
        }
        
        const { matchId, leagueId, bets } = betsByMatch[key];
        
        // Busca resultado do jogo
        const result = await fetchMatchResult(matchId, leagueId);
        
        if (!result) {
            continue;
        }
        
        // Adiciona ao cache
        checkedMatches.set(key, Date.now());
        
        if (!result.finished) {
            continue;
        }
        
        // Jogo terminou - processa todas as apostas deste jogo
        console.log(`[BetSettlement] Jogo ${matchId} finalizado: ${result.homeScore} - ${result.awayScore}`);
        
        for (const bet of bets) {
            const success = await processBet(bet, result, client);
            if (success) {
                processed++;
                const winner = determineWinner(result.homeScore, result.awayScore);
                if (bet.betType === winner) {
                    won++;
                } else {
                    lost++;
                }
            }
        }
        
        // Pequeno delay entre jogos para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (processed > 0) {
        console.log(`[BetSettlement] Processadas ${processed} apostas (${won} vitórias, ${lost} derrotas)`);
    }
    
    return { processed, won, lost };
}

/**
 * Inicia verificação periódica de apostas
 * @param {object} client - Discord client
 * @param {number} intervalMs - Intervalo em milissegundos (default: 5 min)
 */
function startBetSettlementLoop(client, intervalMs = 5 * 60 * 1000) {
    console.log(`[BetSettlement] Iniciando loop de verificação (intervalo: ${intervalMs/1000}s)`);
    
    // Primeira verificação após 30 segundos
    setTimeout(() => {
        settlePendingBets(client).catch(err => {
            console.error("[BetSettlement] Erro na verificação inicial:", err);
        });
    }, 30000);
    
    // Loop contínuo
    setInterval(() => {
        settlePendingBets(client).catch(err => {
            console.error("[BetSettlement] Erro na verificação:", err);
        });
    }, intervalMs);
}

module.exports = {
    settlePendingBets,
    startBetSettlementLoop,
    fetchMatchResult
};

