/**
 * Handle raw events for lavalink-client
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {*} data
 */
module.exports = (client, data) => {
  try {
    // lavalink-client usa sendRawData para processar eventos de voz (VOICE_STATE_UPDATE / VOICE_SERVER_UPDATE)
    if (client.manager && data) {
      client.manager.sendRawData(data);
    }
  } catch (error) {
    if (client.config?.debug) {
      console.error('[RAW Event Error]:', error.message);
    }
  }
};
