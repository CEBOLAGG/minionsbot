/**
 * Guild Database Module - MongoDB Version
 * 
 * All functions are now ASYNC and return Promises.
 * Make sure to use await when calling these functions.
 */

"use strict";

const { getOrCreateGuild, updateGuild, deleteGuild, Guild } = require("./mongodb");

/**
 * Deleta todos os dados de uma guild
 * @param {string} guildId 
 * @returns {Promise<boolean>}
 */
const deleteGuildDatabase = async (guildId) => {
    return await deleteGuild(guildId);
};

/**
 * Define o modo DJ-only para uma guild
 * @param {string} guildId 
 * @param {boolean} djOnly 
 * @returns {Promise<void>}
 */
const setDjOnly = async (guildId, djOnly) => {
    await updateGuild(guildId, { djOnly });
};

/**
 * Obtém o modo DJ-only de uma guild
 * @param {string} guildId 
 * @returns {Promise<boolean>}
 */
const getDjOnly = async (guildId) => {
    const guild = await getOrCreateGuild(guildId);
    return !!guild?.djOnly;
};

/**
 * Define o modo VNW para um canal específico
 * @param {string} guildId 
 * @param {string} channelId 
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
const setVnwMode = async (guildId, channelId, enabled) => {
    try {
        const guild = await getOrCreateGuild(guildId);
        
        // Converte Map para objeto se necessário
        let vnwModeChannels = {};
        if (guild.vnwModeChannels) {
            if (guild.vnwModeChannels instanceof Map) {
                vnwModeChannels = Object.fromEntries(guild.vnwModeChannels);
            } else if (typeof guild.vnwModeChannels === 'object') {
                vnwModeChannels = { ...guild.vnwModeChannels };
            }
        }
        
        if (enabled) {
            vnwModeChannels[channelId] = true;
        } else {
            delete vnwModeChannels[channelId];
        }
        
        await updateGuild(guildId, { vnwModeChannels });
    } catch (error) {
        console.error(`[GuildDb] Error setting VNW mode for ${guildId}/${channelId}:`, error.message);
    }
};

/**
 * Obtém o status do modo VNW para um canal
 * @param {string} guildId 
 * @param {string} channelId 
 * @returns {Promise<boolean>}
 */
const getVnwMode = async (guildId, channelId) => {
    try {
        const guild = await getOrCreateGuild(guildId);
        
        if (!guild?.vnwModeChannels) return false;
        
        // Verifica se é Map ou objeto
        if (guild.vnwModeChannels instanceof Map) {
            return !!guild.vnwModeChannels.get(channelId);
        } else if (typeof guild.vnwModeChannels === 'object') {
            return !!guild.vnwModeChannels[channelId];
        }
        
        return false;
    } catch (error) {
        console.error(`[GuildDb] Error getting VNW mode for ${guildId}/${channelId}:`, error.message);
        return false;
    }
};

/**
 * Define o modo Ignorante para um canal específico
 * @param {string} guildId 
 * @param {string} channelId 
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
const setIgnorantMode = async (guildId, channelId, enabled) => {
    try {
        const guild = await getOrCreateGuild(guildId);
        
        // Converte Map para objeto se necessário
        let ignorantModeChannels = {};
        if (guild.ignorantModeChannels) {
            if (guild.ignorantModeChannels instanceof Map) {
                ignorantModeChannels = Object.fromEntries(guild.ignorantModeChannels);
            } else if (typeof guild.ignorantModeChannels === 'object') {
                ignorantModeChannels = { ...guild.ignorantModeChannels };
            }
        }
        
        if (enabled) {
            ignorantModeChannels[channelId] = true;
        } else {
            delete ignorantModeChannels[channelId];
        }
        
        await updateGuild(guildId, { ignorantModeChannels });
    } catch (error) {
        console.error(`[GuildDb] Error setting Ignorant mode for ${guildId}/${channelId}:`, error.message);
        }
};

/**
 * Obtém o status do modo Ignorante para um canal
 * @param {string} guildId 
 * @param {string} channelId 
 * @returns {Promise<boolean>}
 */
const getIgnorantMode = async (guildId, channelId) => {
    try {
        const guild = await getOrCreateGuild(guildId);
        
        if (!guild?.ignorantModeChannels) return false;
        
        // Verifica se é Map ou objeto
        if (guild.ignorantModeChannels instanceof Map) {
            return !!guild.ignorantModeChannels.get(channelId);
        } else if (typeof guild.ignorantModeChannels === 'object') {
            return !!guild.ignorantModeChannels[channelId];
        }
        
        return false;
    } catch (error) {
        console.error(`[GuildDb] Error getting Ignorant mode for ${guildId}/${channelId}:`, error.message);
        return false;
    }
};

/**
 * Define o Modo Tóxico para um canal específico
 * @param {string} guildId
 * @param {string} channelId
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
const setToxicMode = async (guildId, channelId, enabled) => {
    try {
        const guild = await getOrCreateGuild(guildId);

        // Converte Map para objeto se necessário
        let toxicModeChannels = {};
        if (guild.toxicModeChannels) {
            if (guild.toxicModeChannels instanceof Map) {
                toxicModeChannels = Object.fromEntries(guild.toxicModeChannels);
            } else if (typeof guild.toxicModeChannels === 'object') {
                toxicModeChannels = { ...guild.toxicModeChannels };
            }
        }

        if (enabled) {
            toxicModeChannels[channelId] = true;
        } else {
            delete toxicModeChannels[channelId];
        }

        await updateGuild(guildId, { toxicModeChannels });
    } catch (error) {
        console.error(`[GuildDb] Error setting Toxic mode for ${guildId}/${channelId}:`, error.message);
    }
};

/**
 * Obtém o status do Modo Tóxico para um canal
 * @param {string} guildId
 * @param {string} channelId
 * @returns {Promise<boolean>}
 */
const getToxicMode = async (guildId, channelId) => {
    try {
        const guild = await getOrCreateGuild(guildId);

        if (!guild?.toxicModeChannels) return false;

        if (guild.toxicModeChannels instanceof Map) {
            return !!guild.toxicModeChannels.get(channelId);
        } else if (typeof guild.toxicModeChannels === 'object') {
            return !!guild.toxicModeChannels[channelId];
        }

        return false;
    } catch (error) {
        console.error(`[GuildDb] Error getting Toxic mode for ${guildId}/${channelId}:`, error.message);
        return false;
    }
};

// ===================== MUSIC SETTINGS =====================

/**
 * Define o volume padrão da guild
 * @param {string} guildId 
 * @param {number} volume 
 * @returns {Promise<void>}
 */
const setVolume = async (guildId, volume) => {
    await updateGuild(guildId, { volume: Math.min(100, Math.max(0, volume)) });
};

/**
 * Obtém o volume padrão da guild
 * @param {string} guildId 
 * @returns {Promise<number>}
 */
const getVolume = async (guildId) => {
    const guild = await getOrCreateGuild(guildId);
    return guild?.volume ?? 100;
};

/**
 * Define o modo 24/7 da guild
 * @param {string} guildId 
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
const set247 = async (guildId, enabled) => {
    await updateGuild(guildId, { twentyFourSeven: enabled });
};

/**
 * Obtém o modo 24/7 da guild
 * @param {string} guildId 
 * @returns {Promise<boolean>}
 */
const get247 = async (guildId) => {
    const guild = await getOrCreateGuild(guildId);
    return !!guild?.twentyFourSeven;
};

/**
 * Define o modo AutoQueue da guild
 * @param {string} guildId 
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
const setAutoQueue = async (guildId, enabled) => {
    await updateGuild(guildId, { autoQueue: enabled });
};

/**
 * Obtém o modo AutoQueue da guild
 * @param {string} guildId 
 * @returns {Promise<boolean>}
 */
const getAutoQueue = async (guildId) => {
    const guild = await getOrCreateGuild(guildId);
    return !!guild?.autoQueue;
};

/**
 * Define o modo AutoPause da guild
 * @param {string} guildId 
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
const setAutoPause = async (guildId, enabled) => {
    await updateGuild(guildId, { autoPause: enabled });
};

/**
 * Obtém o modo AutoPause da guild
 * @param {string} guildId 
 * @returns {Promise<boolean>}
 */
const getAutoPause = async (guildId) => {
    const guild = await getOrCreateGuild(guildId);
    return guild?.autoPause ?? true;
};

/**
 * Define o modo AutoLeave da guild
 * @param {string} guildId 
 * @param {boolean} enabled 
 * @returns {Promise<void>}
 */
const setAutoLeave = async (guildId, enabled) => {
    await updateGuild(guildId, { autoLeave: enabled });
};

/**
 * Obtém o modo AutoLeave da guild
 * @param {string} guildId 
 * @returns {Promise<boolean>}
 */
const getAutoLeave = async (guildId) => {
    const guild = await getOrCreateGuild(guildId);
    return guild?.autoLeave ?? true;
};

/**
 * Obtém todas as configurações da guild
 * @param {string} guildId 
 * @returns {Promise<object>}
 */
const getGuildSettings = async (guildId) => {
    return await getOrCreateGuild(guildId);
};

/**
 * Atualiza múltiplas configurações da guild de uma vez
 * @param {string} guildId 
 * @param {object} settings 
 * @returns {Promise<object>}
 */
const updateGuildSettings = async (guildId, settings) => {
    return await updateGuild(guildId, settings);
};

module.exports = {
    // Delete
    deleteGuildDatabase,
    
    // DJ Mode
    setDjOnly,
    getDjOnly,
    
    // VNW Mode
    setVnwMode,
    getVnwMode,
    
    // Ignorant Mode
    setIgnorantMode,
    getIgnorantMode,

    // Toxic Mode
    setToxicMode,
    getToxicMode,

    // Music Settings
    setVolume,
    getVolume,
    set247,
    get247,
    setAutoQueue,
    getAutoQueue,
    setAutoPause,
    getAutoPause,
    setAutoLeave,
    getAutoLeave,
    
    // General
    getGuildSettings,
    updateGuildSettings
};
