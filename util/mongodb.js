/**
 * MongoDB Database Utility
 * Handles connection and provides models for guild data
 */

"use strict";

const mongoose = require("mongoose");
const dns = require("node:dns");

// FIX Node 22: em algumas máquinas o Node 22 lê o DNS do sistema como 127.0.0.1,
// um resolver local que RECUSA consultas SRV (querySrv ECONNREFUSED) e quebra o
// mongodb+srv:// (que precisa de SRV). Se for o caso, forçamos um DNS público que
// resolve SRV. Só afeta dns.resolve*/SRV (c-ares); o dns.lookup do SO (usado pelo
// resto do bot, discord.js etc.) continua igual.
try {
    const cur = dns.getServers();
    if (cur.length === 0 || cur.includes("127.0.0.1") || cur.includes("::1")) {
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        console.log("[MongoDB] DNS local recusava SRV; usando 8.8.8.8/1.1.1.1 para o mongodb+srv.");
    }
} catch (e) { /* ignore */ }

// Estado da conexão
let isConnected = false;
let connectionPromise = null;

/**
 * Conecta ao MongoDB
 * @param {string} uri - MongoDB connection string
 * @returns {Promise<void>}
 */
const connect = async (uri) => {
    if (isConnected) {
        console.log("[MongoDB] Already connected");
        return;
    }
    
    if (connectionPromise) {
        return connectionPromise;
    }
    
    connectionPromise = (async () => {
        try {
            mongoose.set("strictQuery", false);
            
            await mongoose.connect(uri);
            
            isConnected = true;
            console.log("[MongoDB] Connected successfully!");
            
            mongoose.connection.on("error", (err) => {
                console.error("[MongoDB] Connection error:", err);
            });
            
            mongoose.connection.on("disconnected", () => {
                console.warn("[MongoDB] Disconnected");
                isConnected = false;
            });
            
            mongoose.connection.on("reconnected", () => {
                console.log("[MongoDB] Reconnected");
                isConnected = true;
            });
            
        } catch (error) {
            console.error("[MongoDB] Failed to connect:", error.message);
            connectionPromise = null;
            throw error;
        }
    })();
    
    return connectionPromise;
};

/**
 * Verifica se está conectado
 * @returns {boolean}
 */
const isConnectedToDb = () => isConnected;

/**
 * Desconecta do MongoDB
 * @returns {Promise<void>}
 */
const disconnect = async () => {
    if (!isConnected) return;
    
    try {
        await mongoose.disconnect();
        isConnected = false;
        connectionPromise = null;
        console.log("[MongoDB] Disconnected successfully");
    } catch (error) {
        console.error("[MongoDB] Error disconnecting:", error.message);
    }
};

// ===================== SCHEMAS =====================

/**
 * Schema para dados de Guild
 */
const GuildSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    djOnly: {
        type: Boolean,
        default: false
    },
    vnwModeChannels: {
        type: Map,
        of: Boolean,
        default: new Map()
    },
    ignorantModeChannels: {
        type: Map,
        of: Boolean,
        default: new Map()
    },
    toxicModeChannels: {
        type: Map,
        of: Boolean,
        default: new Map()
    },
    prefix: {
        type: String,
        default: "/"
    },
    autoQueue: {
        type: Boolean,
        default: false
    },
    autoPause: {
        type: Boolean,
        default: true
    },
    autoLeave: {
        type: Boolean,
        default: true
    },
    twentyFourSeven: {
        type: Boolean,
        default: false
    },
    volume: {
        type: Number,
        default: 100
    },
    // Adicione mais campos conforme necessário
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: "guilds"
});

/**
 * Schema para dados globais
 */
const GlobalSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: "global"
});

/**
 * Schema para warnings de usuários
 */
const WarningSchema = new mongoose.Schema({
    odId: {
        type: String,
        required: true
    },
    odGuildId: {
        type: String,
        required: true
    },
    moderatorId: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        default: "Sem motivo especificado"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: "warnings"
});

/**
 * Schema para histórico de músicas do usuário
 */
const UserHistorySchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    tracks: [{
        title: String,
        author: String,
        uri: String,
        duration: Number,
        thumbnail: String,
        addedAt: {
            type: Date,
            default: Date.now
        },
        addedBy: String,
        fromPlaylist: String
    }]
}, {
    timestamps: true,
    collection: "userHistory"
});

// ===================== MODELS =====================

const Guild = mongoose.models.Guild || mongoose.model("Guild", GuildSchema);
const Global = mongoose.models.Global || mongoose.model("Global", GlobalSchema);
const Warning = mongoose.models.Warning || mongoose.model("Warning", WarningSchema);
const UserHistory = mongoose.models.UserHistory || mongoose.model("UserHistory", UserHistorySchema);

// ===================== GUILD FUNCTIONS =====================

/**
 * Obtém ou cria dados de uma guild
 * @param {string} guildId 
 * @returns {Promise<object>}
 */
const getOrCreateGuild = async (guildId) => {
    try {
        let guild = await Guild.findOne({ guildId });
        
        if (!guild) {
            guild = await Guild.create({ guildId });
        }
        
        return guild;
    } catch (error) {
        console.error(`[MongoDB] Error getting/creating guild ${guildId}:`, error.message);
        // Retorna objeto padrão em caso de erro
        return {
            guildId,
            djOnly: false,
            vnwModeChannels: new Map(),
            ignorantModeChannels: new Map(),
            toxicModeChannels: new Map(),
            prefix: "/",
            autoQueue: false,
            autoPause: true,
            autoLeave: true,
            twentyFourSeven: false,
            volume: 100
        };
    }
};

/**
 * Atualiza dados de uma guild
 * @param {string} guildId 
 * @param {object} data 
 * @returns {Promise<object>}
 */
const updateGuild = async (guildId, data) => {
    try {
        const guild = await Guild.findOneAndUpdate(
            { guildId },
            { ...data, updatedAt: new Date() },
            { new: true, upsert: true }
        );
        return guild;
    } catch (error) {
        console.error(`[MongoDB] Error updating guild ${guildId}:`, error.message);
        return null;
    }
};

/**
 * Deleta dados de uma guild
 * @param {string} guildId 
 * @returns {Promise<boolean>}
 */
const deleteGuild = async (guildId) => {
    try {
        await Guild.deleteOne({ guildId });
        return true;
    } catch (error) {
        console.error(`[MongoDB] Error deleting guild ${guildId}:`, error.message);
        return false;
    }
};

// ===================== GLOBAL FUNCTIONS =====================

/**
 * Obtém valor global
 * @param {string} key 
 * @returns {Promise<any>}
 */
const getGlobal = async (key) => {
    try {
        const doc = await Global.findOne({ key });
        return doc?.value ?? null;
    } catch (error) {
        console.error(`[MongoDB] Error getting global ${key}:`, error.message);
        return null;
    }
};

/**
 * Define valor global
 * @param {string} key 
 * @param {any} value 
 * @returns {Promise<boolean>}
 */
const setGlobal = async (key, value) => {
    try {
        await Global.findOneAndUpdate(
            { key },
            { value, updatedAt: new Date() },
            { upsert: true }
        );
        return true;
    } catch (error) {
        console.error(`[MongoDB] Error setting global ${key}:`, error.message);
        return false;
    }
};

// ===================== USER HISTORY FUNCTIONS =====================

/**
 * Obtém histórico de músicas do usuário
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
const getUserHistory = async (userId) => {
    try {
        const doc = await UserHistory.findOne({ userId });
        return doc?.tracks ?? [];
    } catch (error) {
        console.error(`[MongoDB] Error getting user history ${userId}:`, error.message);
        return [];
    }
};

/**
 * Adiciona música ao histórico do usuário
 * @param {string} userId 
 * @param {object} trackData 
 * @returns {Promise<boolean>}
 */
const addToUserHistory = async (userId, trackData) => {
    try {
        await UserHistory.findOneAndUpdate(
            { userId },
            { 
                $push: { 
                    tracks: { 
                        $each: [trackData], 
                        $slice: -100 // Mantém apenas as últimas 100 músicas
                    } 
                } 
            },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error(`[MongoDB] Error adding to user history ${userId}:`, error.message);
        return false;
    }
};

/**
 * Adiciona múltiplas músicas ao histórico do usuário (para playlists)
 * @param {string} userId 
 * @param {Array} tracksData 
 * @returns {Promise<boolean>}
 */
const addManyToUserHistory = async (userId, tracksData) => {
    try {
        await UserHistory.findOneAndUpdate(
            { userId },
            { 
                $push: { 
                    tracks: { 
                        $each: tracksData, 
                        $slice: -100 // Mantém apenas as últimas 100 músicas
                    } 
                } 
            },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error(`[MongoDB] Error adding many to user history ${userId}:`, error.message);
        return false;
    }
};

/**
 * Limpa histórico de músicas do usuário
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
const clearUserHistory = async (userId) => {
    try {
        await UserHistory.deleteOne({ userId });
        return true;
    } catch (error) {
        console.error(`[MongoDB] Error clearing user history ${userId}:`, error.message);
        return false;
    }
};

// ===================== MINIONS BET SCHEMAS =====================

/**
 * Schema para carteira do usuário (Bananas)
 */
const WalletSchema = new mongoose.Schema({
    odId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    balance: {
        type: Number,
        default: 1000 // Saldo inicial de bananas
    },
    totalWon: {
        type: Number,
        default: 0
    },
    totalLost: {
        type: Number,
        default: 0
    },
    totalBets: {
        type: Number,
        default: 0
    },
    winCount: {
        type: Number,
        default: 0
    },
    loseCount: {
        type: Number,
        default: 0
    },
    lastDaily: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    collection: "wallets"
});

/**
 * Schema para apostas
 */
const BetSchema = new mongoose.Schema({
    odId: {
        type: String,
        required: true,
        index: true
    },
    odGuildId: {
        type: String,
        required: true
    },
    channelId: {
        type: String,
        required: true
    },
    messageId: {
        type: String
    },
    matchId: {
        type: String,
        required: true,
        index: true
    },
    leagueId: {
        type: String,
        required: true
    },
    homeTeam: {
        type: String,
        required: true
    },
    awayTeam: {
        type: String,
        required: true
    },
    matchDate: {
        type: Date,
        required: true
    },
    betType: {
        type: String,
        enum: ["home", "draw", "away"],
        required: true
    },
    betAmount: {
        type: Number,
        required: true
    },
    odds: {
        type: Number,
        required: true
    },
    potentialWin: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "won", "lost", "cancelled", "refunded"],
        default: "pending"
    },
    result: {
        homeScore: Number,
        awayScore: Number,
        winner: String // "home", "draw", "away"
    },
    settledAt: {
        type: Date
    }
}, {
    timestamps: true,
    collection: "bets"
});

// Index composto para busca eficiente
BetSchema.index({ odId: 1, status: 1 });
BetSchema.index({ matchId: 1, status: 1 });
// Backstop de race: impede 2 apostas PENDENTES do mesmo usuário no mesmo jogo.
BetSchema.index({ odId: 1, matchId: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

const Wallet = mongoose.models.Wallet || mongoose.model("Wallet", WalletSchema);
const Bet = mongoose.models.Bet || mongoose.model("Bet", BetSchema);

// ===================== BOT STATS SCHEMA =====================

/**
 * Schema para dados de status do bot (sincronizado periodicamente)
 */
const BotStatsSchema = new mongoose.Schema({
    botId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    commandsRan: { type: Number, default: 0 },
    songsPlayed: { type: Number, default: 0 },
    users: { type: Number, default: 0 },
    servers: { type: Number, default: 0 },
    uptime: { type: Number, default: 0 },
    ping: { type: Number, default: 0 },
    botName: { type: String, default: "" },
    botVersion: { type: String, default: "" },
    botAvatar: { type: String, default: "" },
    inviteURL: { type: String, default: "" },
    commands: [{
        name: String,
        description: String,
    }],
    guildIds: [{ type: String }],
    guildMemberCounts: {
        type: Map,
        of: Number,
        default: new Map()
    },
    players: {
        type: Map,
        of: {
            guildId: String,
            voiceChannel: String,
            nowPlaying: {
                title: String,
                duration: Number,
                position: Number,
                requester: String,
                thumbnail: String,
                uri: String,
                isStream: Boolean,
            },
            queue: [{
                title: String,
                duration: Number,
                uri: String,
                requester: String,
            }],
        },
        default: new Map(),
    },
    updatedAt: { type: Date, default: Date.now },
}, {
    timestamps: true,
    collection: "botStats"
});

const BotStats = mongoose.models.BotStats || mongoose.model("BotStats", BotStatsSchema);

/**
 * Atualiza stats do bot no MongoDB
 * @param {string} botId
 * @param {object} data
 */
const updateBotStats = async (botId, data) => {
    try {
        await BotStats.findOneAndUpdate(
            { botId },
            { ...data, updatedAt: new Date() },
            { upsert: true }
        );
    } catch (error) {
        console.error(`[MongoDB] Error updating bot stats:`, error.message);
    }
};

/**
 * Obtém stats do bot
 * @param {string} botId
 */
const getBotStats = async (botId) => {
    try {
        return await BotStats.findOne({ botId });
    } catch (error) {
        console.error(`[MongoDB] Error getting bot stats:`, error.message);
        return null;
    }
};

// ===================== WALLET FUNCTIONS =====================

/**
 * Obtém ou cria carteira do usuário
 * @param {string} odId - User ID
 * @returns {Promise<object>}
 */
const getOrCreateWallet = async (odId) => {
    try {
        let wallet = await Wallet.findOne({ odId });
        
        if (!wallet) {
            wallet = await Wallet.create({ 
                odId, 
                balance: 1000 // Saldo inicial
            });
        }
        
        return wallet;
    } catch (error) {
        console.error(`[MongoDB] Error getting/creating wallet ${odId}:`, error.message);
        // NÃO retornar carteira fantasma com saldo 1000 — isso permitiria apostar sobre
        // saldo inexistente em falha de DB. Propaga o erro pra abortar o fluxo de aposta.
        throw error;
    }
};

/**
 * Atualiza saldo da carteira
 * @param {string} odId 
 * @param {number} amount - Positivo para adicionar, negativo para remover
 * @returns {Promise<object>}
 */
const updateWalletBalance = async (odId, amount) => {
    try {
        const wallet = await Wallet.findOneAndUpdate(
            { odId },
            { $inc: { balance: amount } },
            { new: true, upsert: true }
        );
        return wallet;
    } catch (error) {
        console.error(`[MongoDB] Error updating wallet balance ${odId}:`, error.message);
        return null;
    }
};

/**
 * Débito ATÔMICO e condicional: só remove se houver saldo suficiente.
 * Mata a race condition (check-then-act) que deixava o saldo negativo.
 * @returns {Promise<object|null>} carteira atualizada, ou null se saldo insuficiente
 */
const debitIfEnough = async (odId, amount) => {
    try {
        return await Wallet.findOneAndUpdate(
            { odId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );
    } catch (error) {
        console.error(`[MongoDB] Error debiting wallet ${odId}:`, error.message);
        return null;
    }
};

/**
 * Registra resultado de aposta na carteira
 * @param {string} odId 
 * @param {boolean} won 
 * @param {number} amount 
 * @returns {Promise<object>}
 */
const recordBetResult = async (odId, won, payout, stake = 0) => {
    try {
        // won: credita o payout BRUTO no saldo, mas conta só o LUCRO líquido em totalWon
        // (antes somava bruto, inflando estatística). lost: soma a stake em totalLost.
        const update = won
            ? { $inc: { balance: payout, totalWon: Math.max(0, payout - stake), winCount: 1, totalBets: 1 } }
            : { $inc: { totalLost: payout, loseCount: 1, totalBets: 1 } };
        
        const wallet = await Wallet.findOneAndUpdate(
            { odId },
            update,
            { new: true, upsert: true }
        );
        return wallet;
    } catch (error) {
        console.error(`[MongoDB] Error recording bet result ${odId}:`, error.message);
        return null;
    }
};

/**
 * Claim daily bananas
 * @param {string} odId 
 * @returns {Promise<{success: boolean, amount?: number, nextClaim?: Date}>}
 */
const claimDaily = async (odId) => {
    try {
        await getOrCreateWallet(odId); // garante que a carteira existe
        const now = new Date();
        const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const dailyAmount = 500; // 500 bananas diárias

        // Claim ATÔMICO: só credita se nunca coletou OU já passou 24h. A condição vai
        // no FILTRO (não em JS), então duas chamadas concorrentes não coletam 2x (race).
        const wallet = await Wallet.findOneAndUpdate(
            { odId, $or: [{ lastDaily: null }, { lastDaily: { $exists: false } }, { lastDaily: { $lte: cutoff } }] },
            { $inc: { balance: dailyAmount }, $set: { lastDaily: now } },
            { new: true }
        );

        if (!wallet) {
            // Já coletou nas últimas 24h
            const current = await Wallet.findOne({ odId });
            const last = current?.lastDaily ? new Date(current.lastDaily) : now;
            return { success: false, nextClaim: new Date(last.getTime() + 24 * 60 * 60 * 1000) };
        }

        return { success: true, amount: dailyAmount };
    } catch (error) {
        console.error(`[MongoDB] Error claiming daily ${odId}:`, error.message);
        return { success: false };
    }
};

// ===================== BET FUNCTIONS =====================

/**
 * Cria uma nova aposta
 * @param {object} betData 
 * @returns {Promise<object>}
 */
const createBet = async (betData) => {
    try {
        const bet = await Bet.create(betData);
        return bet;
    } catch (error) {
        console.error(`[MongoDB] Error creating bet:`, error.message);
        return null;
    }
};

/**
 * Obtém apostas pendentes de um usuário
 * @param {string} odId 
 * @returns {Promise<Array>}
 */
const getUserPendingBets = async (odId) => {
    try {
        const bets = await Bet.find({ odId, status: "pending" }).sort({ createdAt: -1 });
        return bets;
    } catch (error) {
        console.error(`[MongoDB] Error getting user bets ${odId}:`, error.message);
        return [];
    }
};

/**
 * Obtém todas apostas de um usuário
 * @param {string} odId 
 * @param {number} limit 
 * @returns {Promise<Array>}
 */
const getUserBets = async (odId, limit = 20) => {
    try {
        const bets = await Bet.find({ odId }).sort({ createdAt: -1 }).limit(limit);
        return bets;
    } catch (error) {
        console.error(`[MongoDB] Error getting all user bets ${odId}:`, error.message);
        return [];
    }
};

/**
 * Obtém apostas pendentes de um jogo específico
 * @param {string} matchId 
 * @returns {Promise<Array>}
 */
const getMatchPendingBets = async (matchId) => {
    try {
        const bets = await Bet.find({ matchId, status: "pending" });
        return bets;
    } catch (error) {
        console.error(`[MongoDB] Error getting match bets ${matchId}:`, error.message);
        return [];
    }
};

/**
 * Verifica se usuário já apostou em um jogo
 * @param {string} odId 
 * @param {string} matchId 
 * @returns {Promise<object|null>}
 */
const getUserBetOnMatch = async (odId, matchId) => {
    try {
        const bet = await Bet.findOne({ odId, matchId, status: "pending" });
        return bet;
    } catch (error) {
        console.error(`[MongoDB] Error checking user bet on match:`, error.message);
        return null;
    }
};

/**
 * Liquida uma aposta (won/lost)
 * @param {string} betId 
 * @param {string} status - "won" ou "lost"
 * @param {object} result - { homeScore, awayScore, winner }
 * @returns {Promise<object>}
 */
const settleBet = async (betId, status, result) => {
    try {
        // Transição ATÔMICA pending -> won/lost. Retorna null se a aposta já não está
        // "pending" (outra execução do loop já liquidou) — garante idempotência (não paga 2x).
        const bet = await Bet.findOneAndUpdate(
            { _id: betId, status: "pending" },
            {
                status,
                result,
                settledAt: new Date()
            },
            { new: true }
        );
        return bet;
    } catch (error) {
        console.error(`[MongoDB] Error settling bet ${betId}:`, error.message);
        return null;
    }
};

/**
 * Obtém todas apostas pendentes que precisam ser verificadas
 * @returns {Promise<Array>}
 */
const getAllPendingBets = async () => {
    try {
        const bets = await Bet.find({ status: "pending" });
        return bets;
    } catch (error) {
        console.error(`[MongoDB] Error getting all pending bets:`, error.message);
        return [];
    }
};

/**
 * Cancela uma aposta e reembolsa
 * @param {string} betId 
 * @returns {Promise<object>}
 */
const cancelBet = async (betId) => {
    try {
        const bet = await Bet.findOneAndUpdate(
            { _id: betId, status: "pending" },
            { status: "cancelled", settledAt: new Date() },
            { new: true }
        );
        return bet;
    } catch (error) {
        console.error(`[MongoDB] Error cancelling bet ${betId}:`, error.message);
        return null;
    }
};

/**
 * Reembolsa uma aposta (pending -> refunded) de forma ATÔMICA.
 * Retorna o doc só se ESTE processo fez a transição (evita reembolso duplo).
 */
const refundBet = async (betId) => {
    try {
        return await Bet.findOneAndUpdate(
            { _id: betId, status: "pending" },
            { status: "refunded", settledAt: new Date() },
            { new: true }
        );
    } catch (error) {
        console.error(`[MongoDB] Error refunding bet ${betId}:`, error.message);
        return null;
    }
};

// ===================== EXPORTS =====================

module.exports = {
    // Connection
    connect,
    disconnect,
    isConnected: isConnectedToDb,
    mongoose,
    
    // Models
    Guild,
    Global,
    Warning,
    UserHistory,
    Wallet,
    Bet,
    BotStats,
    
    // Guild functions
    getOrCreateGuild,
    updateGuild,
    deleteGuild,
    
    // Global functions
    getGlobal,
    setGlobal,
    
    // User History functions
    getUserHistory,
    addToUserHistory,
    addManyToUserHistory,
    clearUserHistory,
    
    // Wallet functions
    getOrCreateWallet,
    updateWalletBalance,
    debitIfEnough,
    recordBetResult,
    claimDaily,

    // Bet functions
    createBet,
    getUserPendingBets,
    getUserBets,
    getMatchPendingBets,
    getUserBetOnMatch,
    settleBet,
    getAllPendingBets,
    cancelBet,
    refundBet,
    
    // Bot Stats functions
    updateBotStats,
    getBotStats,
};

