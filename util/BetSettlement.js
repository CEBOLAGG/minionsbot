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
    getOrCreateWallet,
    updateWalletBalance,
    refundBet
} = require("./mongodb");

const BANANA_EMOJI = "🍌";
const MINION_EMOJI = "🟡";

// Cache de jogos já verificados (evita spam na API)
const checkedMatches = new Map();
const CHECK_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Guard pra impedir execuções sobrepostas do settlement (que pagavam aposta 2x).
let isSettling = false;

// Converte score da ESPN em inteiro; null se ausente/inválido. NÃO usar `||0`,
// senão placar faltando vira 0-0 ("empate" falso) e liquida errado.
function parseScore(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(typeof v === "object" ? v?.displayValue ?? v?.value : v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

// Estados terminais NÃO-completos (jogo não vai acontecer) -> reembolsar.
function isCancelledStatus(name) {
    return /CANCEL|POSTPON|ABANDON|SUSPEND|FORFEIT/i.test(name || "");
}

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
                        
                        if (isCancelledStatus(status?.type?.name)) return { cancelled: true };
                        if (status?.type?.completed) {
                            const homeTeam = competitors.find(c => c.homeAway === "home");
                            const awayTeam = competitors.find(c => c.homeAway === "away");
                            const hs = parseScore(homeTeam?.score);
                            const as = parseScore(awayTeam?.score);
                            if (hs === null || as === null) return { finished: false };
                            return { finished: true, homeScore: hs, awayScore: as };
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
        const statusName = status?.type?.name || "";

        if (isCancelledStatus(statusName)) return { cancelled: true };

        const isFinished = status?.type?.completed === true ||
                          statusName === "STATUS_FINAL" ||
                          statusName === "STATUS_FULL_TIME";

        if (!isFinished) {
            return { finished: false };
        }

        const homeTeamData = competition?.competitors?.find(c => c.homeAway === "home");
        const awayTeamData = competition?.competitors?.find(c => c.homeAway === "away");
        const homeScore = parseScore(homeTeamData?.score);
        const awayScore = parseScore(awayTeamData?.score);

        // Placar incompleto num jogo "completed" — NÃO liquida (evita 0-0/empate
        // falso); re-tenta na próxima rodada.
        if (homeScore === null || awayScore === null) return { finished: false };

        return { finished: true, homeScore, awayScore };
        
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
        
        // Transição ATÔMICA pending -> won/lost. Se retornar null, outra execução do
        // loop já liquidou esta aposta — NÃO credita de novo (idempotência).
        const settled = await settleBet(bet._id, won ? "won" : "lost", {
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            winner: winner
        });
        if (!settled) return false;

        // Atualiza carteira (só após ter feito a transição com sucesso)
        if (won) {
            // Ganhou - recebe o ganho potencial (líquido contabilizado em totalWon)
            await recordBetResult(bet.odId, true, bet.potentialWin, bet.betAmount);
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
    // Guard: nunca rodar duas liquidações ao mesmo tempo (causava pagamento duplo).
    if (isSettling) {
        console.log("[BetSettlement] rodada anterior ainda em execução — pulando.");
        return { processed: 0, won: 0, lost: 0 };
    }
    isSettling = true;
    try {
        return await _settlePendingBets(client);
    } finally {
        isSettling = false;
    }
}

async function _settlePendingBets(client) {
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
            // Jogo não encontrado. Se já passou muito tempo (>7 dias), reembolsa pra
            // não prender o saldo do apostador pra sempre.
            const oldest = Math.min(...bets.map(b => new Date(b.matchDate).getTime() || Date.now()));
            if (Date.now() - oldest > 7 * 24 * 60 * 60 * 1000) {
                console.log(`[BetSettlement] Jogo ${matchId} sumiu há +7 dias — reembolsando.`);
                for (const bet of bets) {
                    const refunded = await refundBet(bet._id);
                    if (refunded) await updateWalletBalance(bet.odId, bet.betAmount);
                }
                checkedMatches.set(key, Date.now());
            }
            continue;
        }

        // Jogo cancelado/adiado/abandonado — reembolsa todas as apostas
        if (result.cancelled) {
            console.log(`[BetSettlement] Jogo ${matchId} cancelado/adiado — reembolsando ${bets.length} aposta(s).`);
            for (const bet of bets) {
                const refunded = await refundBet(bet._id);
                if (refunded) await updateWalletBalance(bet.odId, bet.betAmount);
            }
            checkedMatches.set(key, Date.now());
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
    
    // setTimeout recursivo: só reagenda DEPOIS que a rodada termina, evitando
    // execuções sobrepostas (que podiam pagar a mesma aposta 2x).
    const tick = async () => {
        try {
            await settlePendingBets(client);
        } catch (err) {
            console.error("[BetSettlement] Erro na verificação:", err);
        } finally {
            setTimeout(tick, intervalMs);
        }
    };
    setTimeout(tick, 30000); // primeira verificação após 30s
}

module.exports = {
    settlePendingBets,
    startBetSettlementLoop,
    fetchMatchResult
};

