const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Collection,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  Partials,
  Colors,
  escapeMarkdown,
  ChannelType,
  // Components V2
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  ThumbnailBuilder,
  MessageFlags,
  ComponentType,
  // Modal
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const prettyMilliseconds = require("pretty-ms");
const jsoning = require("jsoning");
const { LavalinkManager } = require("lavalink-client");
const ConfigFetcher = require("../util/getConfig");
const Logger = require("./Logger");
const Server = require("../api");
const getLavalink = require("../util/getLavalink");
const getChannel = require("../util/getChannel");
const colors = require("colors");
const LogManager = require('../events/logs');
const LavalinkMonitor = require('../util/LavalinkMonitor');
const { emojiFor, emojiTag } = require("./emojis");

const createProgressBar = (current, total, barSize = 15) => {
  if (!total || total === 0 || isNaN(total)) return "🔴 LIVE";
  
  current = Math.min(current, total);
  current = Math.max(current, 0);
  
  const progress = Math.round((current / total) * barSize);
  const progressText = "▬".repeat(progress);
  const remainingText = "▬".repeat(barSize - progress);
  
  // Arredondar para números inteiros (sem decimais)
  const currentRounded = Math.round(current);
  const totalRounded = Math.round(total);
  
  return `${progressText}🔘${remainingText} \`${prettyMilliseconds(currentRounded, { colonNotation: true, secondsDecimalDigits: 0 })}/${prettyMilliseconds(totalRounded, { colonNotation: true, secondsDecimalDigits: 0 })}\``;
};

// ════════════════════════════════════════════════════════════════════
// CAMADA DE COMPATIBILIDADE Riffy -> lavalink-client
// O core usa a API do lavalink-client; comandos/eventos externos continuam
// usando a API "estilo Riffy". Estes helpers reexpoem essa superfície
// (player.current / player.queue.length / player.loop / player.setLoop /
//  player.pause(bool) / player.stop / player.voiceChannel / player.filters /
//  track.info.length|requester|thumbnail) sobre os objetos do lavalink-client.
// ════════════════════════════════════════════════════════════════════

/**
 * Garante que um track exponha as props legadas do Riffy
 * (track.info.length, track.info.requester, track.info.thumbnail).
 */
const decorateTrack = (track) => {
  if (!track || !track.info || track.__riffyTrack) return track;
  try {
    const info = track.info;
    // track.info.length -> track.info.duration
    if (info.length === undefined && info.duration !== undefined) {
      Object.defineProperty(info, "length", {
        get() { return info.duration; },
        configurable: true,
        enumerable: false,
      });
    }
    // track.info.thumbnail -> track.info.artworkUrl
    if (info.thumbnail === undefined) {
      Object.defineProperty(info, "thumbnail", {
        get() { return info.artworkUrl || null; },
        configurable: true,
        enumerable: false,
      });
    }
    // track.info.requester -> track.requester
    if (info.requester === undefined) {
      Object.defineProperty(info, "requester", {
        get() { return track.requester; },
        configurable: true,
        enumerable: false,
      });
    }
    Object.defineProperty(track, "__riffyTrack", { value: true, enumerable: false });
  } catch (e) { /* ignore */ }
  return track;
};

/**
 * Wrapper de fila estilo Riffy sobre lavalink-client Queue.
 * Expõe: length, indexação [i], map, add, clear, remove, shuffle,
 * unshift, splice — operando sobre queue.tracks. Mantém .current/.previous.
 */
const wrapQueue = (lavaQueue) => {
  if (!lavaQueue) return lavaQueue;
  if (lavaQueue.__riffyQueue) return lavaQueue.__riffyQueue;

  const tracks = () => lavaQueue.tracks || [];

  const shim = {
    // Acesso direto ao queue real do lavalink-client
    get _raw() { return lavaQueue; },
    get tracks() { return lavaQueue.tracks; },
    get current() { return decorateTrack(lavaQueue.current); },
    get previous() { return lavaQueue.previous; },
    get length() { return tracks().length; },

    // Adiciona (mesma assinatura do Riffy)
    add(trackOrTracks) {
      if (Array.isArray(trackOrTracks)) trackOrTracks.forEach(decorateTrack);
      else decorateTrack(trackOrTracks);
      return lavaQueue.add(trackOrTracks);
    },

    // Esvazia a fila
    clear() {
      tracks().length = 0;
    },

    // Remove por índice (Riffy: remove(index))
    remove(index) {
      return tracks().splice(index, 1);
    },

    // Embaralha a fila
    shuffle() {
      const arr = tracks();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    // Insere no início (usado por previous/replay)
    unshift(...items) {
      items.forEach(decorateTrack);
      return tracks().unshift(...items);
    },

    // splice estilo Array (usado por move.js)
    splice(start, deleteCount, ...items) {
      items.forEach(decorateTrack);
      return tracks().splice(start, deleteCount, ...items);
    },

    // map estilo Array (usado pela UI da Controller/QueueNavigator)
    map(fn) {
      return tracks().map((t, i, a) => fn(decorateTrack(t), i, a));
    },

    // iteração / slice usados em alguns lugares
    slice(...args) {
      return tracks().slice(...args).map(decorateTrack);
    },
    [Symbol.iterator]() {
      return tracks()[Symbol.iterator]();
    },
  };

  // Indexação player.queue[i]
  const proxy = new Proxy(shim, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return decorateTrack(tracks()[Number(prop)]);
      }
      // fallback para métodos/props nativos do queue do lavalink-client
      const val = lavaQueue[prop];
      return typeof val === "function" ? val.bind(lavaQueue) : val;
    },
    // CRÍTICO: o lavalink-client escreve direto na fila por dentro do play()/dequeue
    // (ex.: `player.queue.current = track`). Como expomos getters-only no shim, sem
    // este trap a escrita falha silenciosamente e `current` nunca é setado → o play()
    // lança "There is no Track in the Queue". Encaminhamos TODA escrita pra fila real.
    set(target, prop, value) {
      lavaQueue[prop] = value;
      return true;
    },
    has(target, prop) {
      if (prop in target) return true;
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return Number(prop) < tracks().length;
      }
      return prop in lavaQueue;
    },
  });

  Object.defineProperty(lavaQueue, "__riffyQueue", { value: proxy, enumerable: false, configurable: true });
  return proxy;
};

/**
 * Constrói um objeto player.filters estilo Riffy sobre o filterManager
 * do lavalink-client. Os comandos chamam métodos síncronos; aqui aplicamos
 * via filterManager.data + applyPlayerFilters() (fire-and-forget).
 */
const buildFiltersShim = (player) => {
  const fm = player.filterManager;
  const apply = () => { try { fm.applyPlayerFilters(); } catch (e) {} };
  return {
    clearFilters() {
      try { fm.resetFilters(); } catch (e) {}
    },
    setTimescale(data = {}) {
      fm.data.timescale = { speed: data.speed ?? 1.0, pitch: data.pitch ?? 1.0, rate: data.rate ?? 1.0 };
      apply();
    },
    setEqualizer(bands = []) {
      try { fm.setEQ(bands); } catch (e) {
        fm.equalizerBands = bands;
        apply();
      }
    },
    set8D(enabled = true, data = {}) {
      if (enabled) fm.data.rotation = { rotationHz: data.rotationHz ?? 0.2 };
      else delete fm.data.rotation;
      apply();
    },
    setKaraoke(data = {}) {
      fm.data.karaoke = {
        level: data.level ?? 1.0,
        monoLevel: data.monoLevel ?? 1.0,
        filterBand: data.filterBand ?? 220,
        filterWidth: data.filterWidth ?? 100,
      };
      apply();
    },
    setVibrato(data = {}) {
      fm.data.vibrato = { frequency: data.frequency ?? 4, depth: data.depth ?? 0.75 };
      apply();
    },
    setTremolo(data = {}) {
      fm.data.tremolo = { frequency: data.frequency ?? 4, depth: data.depth ?? 0.75 };
      apply();
    },
    setLowPass(data = {}) {
      fm.data.lowPass = { smoothing: data.smoothing ?? 20.0 };
      apply();
    },
    setHighPass(data = {}) {
      fm.data.highPass = { smoothing: data.smoothing ?? 20.0 };
      apply();
    },
    setChannelMix(data = {}) {
      fm.data.channelMix = {
        leftToLeft: data.leftToLeft ?? 1.0,
        leftToRight: data.leftToRight ?? 0.0,
        rightToLeft: data.rightToLeft ?? 0.0,
        rightToRight: data.rightToRight ?? 1.0,
      };
      apply();
    },
    setDistortion(data = {}) {
      fm.data.distortion = Object.assign({
        sinOffset: 0.0, sinScale: 1.0, cosOffset: 0.0, cosScale: 1.0,
        tanOffset: 0.0, tanScale: 1.0, offset: 0.0, scale: 1.0,
      }, data);
      apply();
    },
    setCompressor(data = {}) {
      fm.data.compressor = data;
      apply();
    },
    setGate(data = {}) {
      fm.data.gate = data;
      apply();
    },
  };
};

/**
 * Decora um player do lavalink-client com a superfície "estilo Riffy"
 * que os comandos/eventos externos esperam.
 */
const decoratePlayer = (player) => {
  if (!player || player.__riffyPlayer) return player;
  try {
    // player.current -> player.queue.current
    Object.defineProperty(player, "current", {
      get() { return decorateTrack(this.queue?.current); },
      configurable: true,
      enumerable: false,
    });

    // player.previous -> player.queue.previous[last]
    Object.defineProperty(player, "previous", {
      get() {
        const prev = this.queue?.previous;
        return prev && prev.length ? decorateTrack(prev[0]) : null;
      },
      configurable: true,
      enumerable: false,
    });

    // player.loop -> player.repeatMode ("off" -> "none")
    Object.defineProperty(player, "loop", {
      get() { return this.repeatMode === "off" ? "none" : this.repeatMode; },
      configurable: true,
      enumerable: false,
    });

    // player.voiceChannel / player.textChannel -> *Id
    Object.defineProperty(player, "voiceChannel", {
      get() { return this.voiceChannelId; },
      configurable: true,
      enumerable: false,
    });
    Object.defineProperty(player, "textChannel", {
      get() { return this.textChannelId; },
      configurable: true,
      enumerable: false,
    });

    // player.filters (API de filtros estilo Riffy)
    const filtersShim = buildFiltersShim(player);
    Object.defineProperty(player, "filters", {
      get() { return filtersShim; },
      configurable: true,
      enumerable: false,
    });

    // wrapper de fila (lazy/cached): player.queue continua existindo,
    // mas devolvemos o shim com .length/[i]/map/clear/remove/unshift/splice
    const rawQueue = player.queue;
    const queueProxy = wrapQueue(rawQueue);
    Object.defineProperty(player, "queue", {
      get() { return queueProxy; },
      configurable: true,
      enumerable: false,
    });

    // player.setLoop("none"/"track"/"queue") -> setRepeatMode("off"/"track"/"queue")
    player.setLoop = function (mode) {
      const repeat = mode === "none" ? "off" : mode;
      return this.setRepeatMode(repeat);
    };

    // player.pause(true|false): true=pausa, false=resume
    const nativePause = player.pause.bind(player);
    const nativeResume = player.resume.bind(player);
    player.pause = function (state = true) {
      return state ? nativePause() : nativeResume();
    };

    // player.stop() -> stopPlaying()
    player.stop = function () {
      return this.stopPlaying();
    };

    // player.setVoiceChannel(id) -> changeVoiceState
    player.setVoiceChannel = function (channelId) {
      this.voiceChannelId = channelId;
      return this.changeVoiceState({ voiceChannelId: channelId });
    };

    Object.defineProperty(player, "__riffyPlayer", { value: true, enumerable: false });
  } catch (e) {
    // Se algo falhar na decoração, não quebrar o player
  }
  return player;
};

class DiscordMusicBot extends Client {
  /**
   * Create the music client
   * @param {import("discord.js").ClientOptions} props - Client options
   */
  constructor(
    props = {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction]
    }
  ) {
    if (!props.partials) {
      props.partials = [Partials.Message, Partials.Channel, Partials.Reaction];
    }
    
    super(props);

    ConfigFetcher().then((conf) => {
      this.config = conf;
      
      if (!this.config.crossfadeDuration) this.config.crossfadeDuration = 3000;
      if (!this.config.transitionInterval) this.config.transitionInterval = 300;
      if (!this.config.preloadTime) this.config.preloadTime = 0.85;
      
      this.build();
    });

    /** @type {Collection<string, import("./SlashCommand")} */
    this.slashCommands = new Collection();
    this.contextCommands = new Collection();

    this.logger = new Logger(path.join(__dirname, "..", "logs.log"));

    this.LoadCommands();
    this.LoadEvents();

    this.database = new jsoning("db.json");

    this.deletedMessages = new WeakSet();
    this.getLavalink = getLavalink;
    this.getChannel = getChannel;
    this.ms = prettyMilliseconds;
    this.commandsRan = 0;
    this.songsPlayed = 0;
    this.preloadCache = new Map();
    
    // Armazenar propriedades customizadas dos players
    this.playerData = new Map();
    this.nowPlayingMessages = new Map();
  }

  /**
   * Get player custom data
   * @param {string} guildId
   * @param {string} key
   */
  getPlayerData(guildId, key) {
    const data = this.playerData.get(guildId);
    return data ? data[key] : undefined;
  }

  /**
   * Set player custom data
   * @param {string} guildId
   * @param {string} key
   * @param {*} value
   */
  setPlayerData(guildId, key, value) {
    if (!this.playerData.has(guildId)) {
      this.playerData.set(guildId, {});
    }
    this.playerData.get(guildId)[key] = value;
  }

  /**
   * Clear player data
   * @param {string} guildId
   */
  clearPlayerData(guildId) {
    this.playerData.delete(guildId);
    // Deletar a mensagem do Now Playing do Discord antes de limpar a referência
    const nowPlayingMessage = this.nowPlayingMessages.get(guildId);
    if (nowPlayingMessage && !this.isMessageDeleted(nowPlayingMessage)) {
      nowPlayingMessage.delete().catch(() => {});
      this.markMessageAsDeleted(nowPlayingMessage);
    }
    this.nowPlayingMessages.delete(guildId);
  }

  /**
   * Send an info message
   * @param {string} text
   */
  log(text) {
    this.logger.log(text);
  }

  /**
   * Send a warning message
   * @param {string} text
   */
  warn(text) {
    this.logger.warn(text);
  }

  /**
   * Send an error message
   * @param {string} text
   */
  error(text) {
    this.logger.error(text);
  }

  /**
   * Clean up resources for a player
   * @param {string} guildId
   */
  cleanupPlayer(guildId) {
    const progressInterval = this.getPlayerData(guildId, "progressInterval");
    if (progressInterval) {
      clearInterval(progressInterval);
      this.setPlayerData(guildId, "progressInterval", null);
    }
    
    const fadeInterval = this.getPlayerData(guildId, "fadeInterval");
    if (fadeInterval) {
      clearInterval(fadeInterval);
      this.setPlayerData(guildId, "fadeInterval", null);
    }
    
    const preloadTimeout = this.getPlayerData(guildId, "preloadTimeout");
    if (preloadTimeout) {
      clearTimeout(preloadTimeout);
      this.setPlayerData(guildId, "preloadTimeout", null);
    }
    
    this.setPlayerData(guildId, "trackStartTime", null);
  }

  /**
   * Set now playing message for a guild
   * @param {string} guildId
   * @param {*} message
   */
  setNowPlayingMessage(guildId, message) {
    const oldMessage = this.nowPlayingMessages.get(guildId);
    if (oldMessage && !this.isMessageDeleted(oldMessage)) {
      oldMessage.delete().catch(() => {});
      this.markMessageAsDeleted(oldMessage);
    }
    if (message) {
      this.nowPlayingMessages.set(guildId, message);
    } else {
      this.nowPlayingMessages.delete(guildId);
    }
  }

  /**
   * Get now playing message for a guild
   * @param {string} guildId
   */
  getNowPlayingMessage(guildId) {
    return this.nowPlayingMessages.get(guildId);
  }

  /**
   * Build the bot
   */
  async build() {
    this.warn("Started the bot...");
    
    // Conecta ao MongoDB
    try {
      const { connect } = require("../util/mongodb");
      await connect(this.config.mongoUri);
    } catch (error) {
      this.error("Failed to connect to MongoDB: " + error.message);
      this.warn("Bot will continue without MongoDB. Some features may not work.");
    }
    
    this.login(this.config.token);
    this.server = this.config.website?.length ? new Server(this) : null;
    
    this.logManager = new LogManager(this);
    console.log('Log manager initialized');
    
    this.lavalinkMonitor = new LavalinkMonitor(this);
    console.log('Lavalink monitor initialized');
    
    setInterval(() => {
      this.lavalinkMonitor?.cleanup();
    }, 60 * 60 * 1000);
    
    // Sync bot stats to MongoDB every 10 seconds for dashboard
    this.once("ready", () => {
      this.syncBotStats();
      setInterval(() => this.syncBotStats(), 10000);
    });
    
    if (this.config.debug === true) {
      this.warn("Debug mode is enabled!");
      this.warn("Only enable this if you know what you are doing!");
      process.on("unhandledRejection", (error) => console.log(error));
      process.on("uncaughtException", (error) => console.log(error));
    } else {
      process.on("unhandledRejection", (error) => { return; });
      process.on("uncaughtException", (error) => { return; });
    }

    let client = this;
    let playedTracks = [];

    // Criar o manager lavalink-client
    this.manager = new LavalinkManager({
      nodes: this.config.nodes.map((n) => ({
        id: n.identifier || n.name || "Main Node",
        host: n.host,
        port: n.port,
        authorization: n.password,
        secure: !!n.secure,
        retryAmount: n.retryAmount ?? 9999,
        retryDelay: n.retryDelay ?? 3000,
      })),
      sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
      },
      autoSkip: true,
      client: {
        id: client.user?.id || this.config.clientId,
        username: client.user?.username || "MusicBot",
      },
      playerOptions: {
        defaultSearchPlatform: "ytmsearch",
        onEmptyQueue: { destroyAfterMs: 300000 },
        onDisconnect: { autoReconnect: true, destroyPlayer: false },
      },
    });

    // Compat estilo Riffy: manager.resolve({ query, requester })
    // No lavalink-client a busca é feita pelo player (player.search).
    // Aqui criamos/pegamos o player do guild para usar o search e
    // retornamos { loadType, tracks, playlistInfo } (com decoração de tracks).
    this.manager.resolve = async ({ query, requester, source } = {}) => {
      // Tenta achar qualquer player existente; senão usa o 1o node conectado via search direto.
      let searchHost = null;
      for (const [, p] of this.manager.players) {
        if (p) { searchHost = p; break; }
      }

      let res;
      if (searchHost) {
        res = await searchHost.search({ query, source }, requester);
      } else {
        // Sem player: busca direto pelo node conectado
        const node = await getLavalink(this);
        if (!node) return { loadType: "empty", tracks: [], playlistInfo: null };
        res = await node.search({ query, source }, requester);
      }

      const tracks = (res.tracks || []).map(decorateTrack);
      return {
        loadType: res.loadType,
        tracks,
        // Riffy expunha playlistInfo; lavalink-client usa "playlist"
        playlist: res.playlist || null,
        playlistInfo: res.playlist || null,
        exception: res.exception || null,
      };
    };

    // Eventos de NODE (lavalink-client usa manager.nodeManager)
    this.manager.nodeManager.on("connect", (node) => {
      this.log(`Node: ${node.id} | Lavalink node is connected.`);
      this.lavalinkMonitor?.handleLavalinkEvent('nodeConnect', node);
    });

    this.manager.nodeManager.on("reconnecting", (node) => {
      this.warn(`Node: ${node.id} | Lavalink node is reconnecting.`);
      this.lavalinkMonitor?.handleLavalinkEvent('nodeReconnect', node);
    });

    this.manager.nodeManager.on("disconnect", (node) => {
      this.warn(`Node: ${node.id} | Lavalink node is disconnected.`);
      this.lavalinkMonitor?.handleLavalinkEvent('nodeDisconnect', node);
    });

    this.manager.nodeManager.on("error", (node, error) => {
      this.warn(`Node: ${node.id} | Lavalink node has an error: ${error?.message}.`);
      this.lavalinkMonitor?.handleLavalinkEvent('nodeError', node, error);
    });

    this.manager.on("trackStart", async (player, track) => {
      decoratePlayer(player);
      decorateTrack(track);
      const guildId = player.guildId;
      
      // Verificar se o player ainda existe
      const currentPlayer = this.manager.players.get(guildId);
      if (!currentPlayer) {
        this.warn(`Player: ${guildId} | trackStart event but player not found`);
        return;
      }
      
      this.cleanupPlayer(guildId);
      // Reset showFilters ao começar nova música
      this.setPlayerData(guildId, "showFilters", false);
      
      this.songsPlayed++;
      playedTracks.push(track.info.identifier);
      if (playedTracks.length >= 100) {
        playedTracks.shift();
      }

      // Instant sync for dashboard
      this.syncBotStats();
    
      this.warn(`Player: ${guildId} | Track has been started playing [${colors.blue(track.info.title)}]`);
      this.warn(`Player: ${guildId} | textChannel from data: ${this.getPlayerData(guildId, "textChannel")}`);
      this.warn(`Player: ${guildId} | player.connected: ${currentPlayer.connected}, player.playing: ${currentPlayer.playing}`);
      
      const textChannel = this.getPlayerData(guildId, "textChannel");
      
      if (!textChannel) {
        this.warn(`Player: ${guildId} | No text channel found for trackStart`);
        return;
      }
      
      const channel = client.channels.cache.get(textChannel);
      if (!channel) {
        this.warn(`Player: ${guildId} | Text channel ${textChannel} not found in cache`);
        return;
      }
      
      let nowPlaying = null;
      const showFilters = this.getPlayerData(guildId, "showFilters") || false;
      
      // Tentar usar Components V2 primeiro
      try {
        const playerMessage = client.createPlayerV2(guildId, player, track, { 
          showFilters, 
          currentPosition: 0 
        });
        
        nowPlaying = await channel.send(playerMessage);
        this.setPlayerData(guildId, "useComponentsV2", true);
        this.setNowPlayingMessage(guildId, nowPlaying);
      } catch (error) {
        // Se Components V2 falhar, mostrar erro detalhado e usar fallback
        this.warn(`Player: ${guildId} | Components V2 failed, using fallback. Error: ${error.message}`);
        if (error.rawError) {
          this.warn(`Player: ${guildId} | Raw error: ${JSON.stringify(error.rawError)}`);
        }
        
        // Fallback: usar sistema antigo de embeds
        try {
      var title = escapeMarkdown(track.info.title);
          title = title.replace(/\]/g, "").replace(/\[/g, "");
          
          const queueLength = player.queue?.length || 0;
          const loopStatus = player.loop === "track" ? "🔂 Track" : player.loop === "queue" ? "🔁 Queue" : "➡ Off";
      
      let trackStartedEmbed = this.Embed()
            .setAuthor({ name: "Now Playing", iconURL: "https://cdn.discordapp.com/attachments/1446589810557980752/1447824471288189089/logo.gif" })
            .setDescription(`**[${title}](${track.info.uri})**`)
        .addFields(
              { name: "👤 Requested", value: `${track.info.requester || `<@${client.user.id}>`}`, inline: true },
              { name: "⏱ Duration", value: track.info.isStream ? `\`🔴 LIVE\`` : `\`${prettyMilliseconds(track.info.length, { colonNotation: true, secondsDecimalDigits: 0 })}\``, inline: true },
              { name: "📋 Queue", value: `\`${queueLength} tracks\``, inline: true }
        );
        
      if (!track.info.isStream) {
        trackStartedEmbed.addFields({
              name: "\u200b",
              value: createProgressBar(0, track.info.length),
          inline: false,
        });
      }
        
      try {
        const thumbnail = track.info.artworkUrl || track.info.thumbnail;
        if (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('http')) {
          trackStartedEmbed.setThumbnail(thumbnail);
        }
      } catch (err) {}
      
          trackStartedEmbed.setFooter({ text: `Loop: ${loopStatus} • Volume: ${player.volume || 100}%` });
          
          const controller = client.createController(guildId, player, { showFilters });
        
        nowPlaying = await channel.send({
          embeds: [trackStartedEmbed],
          components: controller || [],
        });
        
          this.setPlayerData(guildId, "useComponentsV2", false);
        this.setNowPlayingMessage(guildId, nowPlaying);
        } catch (fallbackError) {
          this.warn(`Player: ${guildId} | Fallback also failed: ${fallbackError.message}`);
          this.error(fallbackError);
        return;
        }
      }
      
      // Atualizar barra de progresso
      if (!track.info.isStream && nowPlaying) {
        const initialPosition = currentPlayer.position || 0;
        const trackStartTime = Date.now() - initialPosition;
        this.setPlayerData(guildId, "trackStartTime", trackStartTime);
        
        const progressInterval = setInterval(async () => {
          const currentPlayer = this.manager.players.get(guildId);
          if (!currentPlayer || !currentPlayer.playing || currentPlayer.current?.info?.identifier !== track.info.identifier) {
            clearInterval(progressInterval);
            this.setPlayerData(guildId, "progressInterval", null);
            return;
          }
          
          // Calcular posição baseado no tempo decorrido
          const startTime = this.getPlayerData(guildId, "trackStartTime");
          let currentPosition = 0;
          
          if (startTime) {
            currentPosition = Date.now() - startTime;
          } else {
            if (currentPlayer.position !== undefined && currentPlayer.position !== null && currentPlayer.position >= 0) {
              currentPosition = currentPlayer.position;
              const newStartTime = Date.now() - currentPlayer.position;
              this.setPlayerData(guildId, "trackStartTime", newStartTime);
            }
          }
          
          const displayPosition = Math.min(Math.max(currentPosition, 0), track.info.length);
          
          try {
            const message = this.getNowPlayingMessage(guildId);
            if (message && !this.isMessageDeleted(message)) {
              const showFilters = this.getPlayerData(guildId, "showFilters") || false;
              const showVolume = this.getPlayerData(guildId, "showVolume") || false;
              const useComponentsV2 = this.getPlayerData(guildId, "useComponentsV2");
              
              // Se um dropdown está aberto, NÃO atualizar automaticamente
              // para evitar que o dropdown feche sozinho
              if (showFilters || showVolume) {
                return; // Pular esta atualização
              }
              
              if (useComponentsV2) {
                // Atualizar usando Components V2
                const updatedPlayerMessage = client.createPlayerV2(guildId, currentPlayer, track, { 
                  showFilters, 
                  showVolume,
                  currentPosition: displayPosition 
                });
                
                await message.edit(updatedPlayerMessage).catch(() => {
                  this.markMessageAsDeleted(message);
                  clearInterval(progressInterval);
                  this.setPlayerData(guildId, "progressInterval", null);
                });
              } else {
                // Usar sistema antigo de embeds
                var title = escapeMarkdown(track.info.title);
                title = title.replace(/\]/g, "").replace(/\[/g, "");
                
                const currentQueueLength = currentPlayer.queue?.length || 0;
                const currentLoopStatus = currentPlayer.loop === "track" ? "🔂 Track" : currentPlayer.loop === "queue" ? "🔁 Queue" : "➡ Off";
          
          let updatedEmbed = this.Embed()
                  .setAuthor({ name: "Now Playing", iconURL: "https://cdn.discordapp.com/attachments/1446589810557980752/1447824471288189089/logo.gif" })
                  .setDescription(`**[${title}](${track.info.uri})**`)
            .addFields(
                    { name: "👤 Requested", value: `${track.info.requester || `<@${client.user.id}>`}`, inline: true },
                    { name: "⏱ Duration", value: `\`${prettyMilliseconds(track.info.length, { colonNotation: true, secondsDecimalDigits: 0 })}\``, inline: true },
                    { name: "📋 Queue", value: `\`${currentQueueLength} tracks\``, inline: true },
                    { name: "\u200b", value: createProgressBar(displayPosition, track.info.length), inline: false }
                  )
                  .setFooter({ text: `Loop: ${currentLoopStatus} • Volume: ${currentPlayer.volume || 100}%` });
            
          try {
            const thumbnail = track.info.artworkUrl || track.info.thumbnail;
            if (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('http')) {
              updatedEmbed.setThumbnail(thumbnail);
            }
          } catch (err) {}
          
              await message.edit({
                embeds: [updatedEmbed],
                  components: client.createController(guildId, currentPlayer, { showFilters, showVolume }),
              }).catch(() => {
                this.markMessageAsDeleted(message);
                clearInterval(progressInterval);
                this.setPlayerData(guildId, "progressInterval", null);
              });
              }
            } else {
              clearInterval(progressInterval);
              this.setPlayerData(guildId, "progressInterval", null);
            }
          } catch (err) {
            clearInterval(progressInterval);
            this.setPlayerData(guildId, "progressInterval", null);
            this.warn(`Error updating progress bar: ${err.message}`);
          }
        }, 2000);
        
        this.setPlayerData(guildId, "progressInterval", progressInterval);
      }
    });

    this.manager.on("trackEnd", async (player, track) => {
      decoratePlayer(player);
      const guildId = player.guildId;
      this.cleanupPlayer(guildId);
      this.syncBotStats();
    });

    this.manager.on("trackError", (player, track, error) => {
      decoratePlayer(player);
      decorateTrack(track);
      const guildId = player.guildId;
      this.cleanupPlayer(guildId);

      // lavalink-client passa um payload TrackExceptionEvent (com .exception)
      const errorMessage = error?.message || error?.exception?.message || 'Unknown error';
      
      if (errorMessage.includes('request.body') || errorMessage.includes('undefined is not an object')) {
        this.warn(`Player: ${guildId} | Ignoring request.body error in trackError`);
        return;
      }
      
      this.warn(`Player: ${guildId} | Track had an error: ${errorMessage}.`);
      
      var title = escapeMarkdown(track.info.title);
      title = title.replace(/\]/g, "");
      title = title.replace(/\[/g, "");
      
      let errorEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("Playback error!")
        .setDescription(`Failed to load track: \`${title}\``)
        .setFooter({ text: "Oops! something went wrong but it's not your fault!" });
      
      const textChannel = this.getPlayerData(guildId, "textChannel");
      
      try {
        client.channels.cache.get(textChannel)?.send({ embeds: [errorEmbed] });
      } catch (sendError) {
        this.warn(`Failed to send error message: ${sendError.message}`);
      }
    });

    this.manager.on("trackStuck", (player, track) => {
      decoratePlayer(player);
      decorateTrack(track);
      const guildId = player.guildId;
      this.cleanupPlayer(guildId);

      this.warn(`Track stuck: ${track.info.title}`);
      
      var title = escapeMarkdown(track.info.title);
      title = title.replace(/\]/g, "");
      title = title.replace(/\[/g, "");
      
      let errorEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("Track error!")
        .setDescription(`Failed to load track: \`${title}\``)
        .setFooter({ text: "Oops! something went wrong but it's not your fault!" });
      
      const textChannel = this.getPlayerData(guildId, "textChannel");
      
      try {
        client.channels.cache.get(textChannel)?.send({ embeds: [errorEmbed] });
      } catch (sendError) {
        this.warn(`Failed to send error message: ${sendError.message}`);
      }
    });

    this.manager.on("playerDisconnect", async (player) => {
      decoratePlayer(player);
      const guildId = player.guildId;

      // Verificar se o player ainda existe para evitar recursão
      const currentPlayer = this.manager.players.get(guildId);
      if (!currentPlayer || !currentPlayer.connected) {
        this.cleanupPlayer(guildId);
        this.clearPlayerData(guildId);
        return;
      }
      
      this.cleanupPlayer(guildId);
      
      const twentyFourSeven = this.getPlayerData(guildId, "twentyFourSeven");
      
      if (twentyFourSeven) {
        try {
          if (currentPlayer.queue) currentPlayer.queue.clear();
          if (currentPlayer.stop) currentPlayer.stop();
          this.setPlayerData(guildId, "autoQueue", false);
        } catch (err) {
          this.warn(`Error in playerDisconnect (24/7): ${err.message}`);
        }
      } else {
        try {
          // Não chamar destroy() aqui pois já estamos no evento de desconexão
          // Apenas limpar os dados
          this.clearPlayerData(guildId);
        } catch (err) {
          this.warn(`Error in playerDisconnect cleanup: ${err.message}`);
        }
      }
    });

    this.manager.on("playerMove", (player, oldChannel, newChannel) => {
      decoratePlayer(player);
      const guildId = player.guildId;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
      
      const textChannel = this.getPlayerData(guildId, "textChannel");
      const channel = guild.channels.cache.get(textChannel);
      
      if (oldChannel === newChannel) return;
      
      if (newChannel === null || !newChannel) {
        if (channel) {
          channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(client.config.embedColor)
                .setDescription(`Disconnected from <#${oldChannel}>`),
            ],
          }).catch(() => {});
        }
        
        // Verificar se o player ainda existe antes de destruir
        const currentPlayer = this.manager.players.get(guildId);
        if (currentPlayer && currentPlayer.connected) {
          try {
            currentPlayer.destroy().catch(err => {
              this.warn(`Error destroying player in playerMove: ${err.message}`);
            });
          } catch (err) {
            this.warn(`Error in playerMove destroy: ${err.message}`);
          }
        }
        this.clearPlayerData(guildId);
        return;
      } else {
        try {
          player.setVoiceChannel(newChannel);
          setTimeout(() => {
            const p = this.manager.players.get(guildId);
            if (p && p.pause) p.pause(false);
          }, 1000);
        } catch (err) {
          this.warn(`Error in playerMove setVoiceChannel: ${err.message}`);
        }
      }
    });

    this.manager.on("playerCreate", (player) => {
      decoratePlayer(player);
      const guildId = player.guildId;
      this.setPlayerData(guildId, "twentyFourSeven", client.config.twentyFourSeven);
      this.setPlayerData(guildId, "autoQueue", client.config.autoQueue);
      this.setPlayerData(guildId, "autoPause", client.config.autoPause);
      this.setPlayerData(guildId, "autoLeave", client.config.autoLeave);
      
      this.warn(
        `Player: ${guildId} | A wild player has been created in ${
          client.guilds.cache.get(guildId)?.name || "a guild"
        }`
      );
    });

    this.manager.on("playerDestroy", (player) => {
      decoratePlayer(player);
      const guildId = player.guildId;
      this.cleanupPlayer(guildId);

      this.warn(
        `Player: ${guildId} | A wild player has been destroyed in ${
          client.guilds.cache.get(guildId)?.name || "a guild"
        }`
      );
      
      this.setNowPlayingMessage(guildId, null);
      this.clearPlayerData(guildId);
      this.syncBotStats();
    });

    this.manager.on("queueEnd", async (player) => {
      decoratePlayer(player);
      const guildId = player.guildId;

      // Verificar se o player ainda existe e está conectado
      const currentPlayer = this.manager.players.get(guildId);
      if (!currentPlayer || !currentPlayer.connected) {
        this.cleanupPlayer(guildId);
        this.syncBotStats();
        return;
      }
      
      this.cleanupPlayer(guildId);
      this.syncBotStats();
      
      const autoQueue = this.getPlayerData(guildId, "autoQueue");
      const textChannel = this.getPlayerData(guildId, "textChannel");

      if (autoQueue && currentPlayer.previous) {
        const requester = this.getPlayerData(guildId, "requester");
        const identifier = currentPlayer.previous.info?.identifier;
        
        if (identifier) {
          const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
          
          try {
            // Verificar novamente se o player ainda existe antes de fazer a requisição
            const playerCheck = this.manager.players.get(guildId);
            if (!playerCheck || !playerCheck.connected) {
              return;
            }
            
            const res = await this.manager.resolve({ query: search, requester });
            
            // Verificar novamente após a requisição
            const playerAfterResolve = this.manager.players.get(guildId);
            if (!playerAfterResolve || !playerAfterResolve.connected) {
              return;
            }
            
            if (res && res.tracks && res.tracks.length > 0) {
              let nextTrack;
              for (const track of res.tracks) {
                if (track && track.info && !playedTracks.includes(track.info.identifier)) {
                  nextTrack = track;
                  break;
                }
              }
              
              if (!nextTrack && res.tracks[0]) nextTrack = res.tracks[0];
              
              if (nextTrack && nextTrack.info) {
                // Verificar uma última vez antes de adicionar à queue
                const finalPlayerCheck = this.manager.players.get(guildId);
                if (finalPlayerCheck && finalPlayerCheck.connected && finalPlayerCheck.queue) {
                  finalPlayerCheck.queue.add(nextTrack);
                  finalPlayerCheck.play().catch(err => {
                    this.warn(`Error playing autoQueue track: ${err.message}`);
                  });
                  return;
                }
              }
            }
          } catch (error) {
            this.warn(`AutoQueue error: ${error.message}`);
            // Não propagar o erro para evitar recursão
          }
        }
      }

      const twentyFourSeven = this.getPlayerData(guildId, "twentyFourSeven");

      let queueEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor)
        .setAuthor({ name: "The queue has ended", iconURL: client.config.iconURL })
        .setFooter({ text: "Queue ended" })
        .setTimestamp();
        
      let EndQueue = await client.channels.cache.get(textChannel)?.send({ embeds: [queueEmbed] });
      if (EndQueue) setTimeout(() => EndQueue.delete().catch(() => {}), 5000);
      
      try {
        if (!player.playing && !twentyFourSeven) {
          setTimeout(async () => {
            try {
              const currentPlayer = this.manager.players.get(guildId);
              if (currentPlayer && !currentPlayer.playing && currentPlayer.connected) {
                // Deletar mensagem do Now Playing antes de desconectar
                this.setNowPlayingMessage(guildId, null);
                
                let disconnectedEmbed = new EmbedBuilder()
                  .setColor(client.config.embedColor)
                  .setAuthor({ name: "Disconnected!", iconURL: client.config.iconURL })
                  .setDescription(`The player has been disconnected due to inactivity.`);
                let Disconnected = await client.channels.cache.get(textChannel)?.send({ embeds: [disconnectedEmbed] });
                if (Disconnected) setTimeout(() => Disconnected.delete().catch(() => {}), 30000);
                
                // Verificar novamente antes de destruir para evitar recursão
                const playerToDestroy = this.manager.players.get(guildId);
                if (playerToDestroy && playerToDestroy.connected) {
                  playerToDestroy.destroy().catch(err => {
                    this.warn(`Error destroying player: ${err.message}`);
                  });
                }
                this.clearPlayerData(guildId);
              }
            } catch (err) {
              this.warn(`Error in queueEnd timeout: ${err.message}`);
            }
          }, client.config.disconnectTime);
        } else if (!player.playing && twentyFourSeven) {
          client.warn(`Player: ${guildId} | Queue has ended [${colors.blue("24/7 ENABLED")}]`);
        }
      } catch (err) {
        client.error(err);
      }
    });
  }

  /**
   * Checks if a message has been deleted
   * @param {Message} message
   * @returns {boolean}
   */
  isMessageDeleted(message) {
    return this.deletedMessages.has(message);
  }

  /**
   * Marks a message as deleted
   * @param {Message} message
   */
  markMessageAsDeleted(message) {
    this.deletedMessages.add(message);
  }

  /**
   * Create an embed
   * @param {string} text
   * @returns {EmbedBuilder}
   */
  Embed(text) {
    let embed = new EmbedBuilder().setColor(this.config.embedColor);
    if (text) {
      embed.setDescription(text);
    }
    return embed;
  }

  /**
   * Create an error embed
   * @param {string} text
   * @returns {EmbedBuilder}
   */
  ErrorEmbed(text) {
    let embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription("❌ | " + text);
    return embed;
  }

  LoadEvents() {
    let EventsDir = path.join(__dirname, "..", "events");
    fs.readdir(EventsDir, (err, files) => {
      if (err) {
        throw err;
      } else {
        files.forEach((file) => {
          const event = require(EventsDir + "/" + file);
          let eventName = file.split(".")[0];
          
          // Mapear ready para clientReady (Discord.js v15 compatibility)
          if (eventName === "ready") {
            eventName = "clientReady";
          }
          
          this.on(eventName, event.bind(null, this));
          this.warn("Event Loaded: " + eventName);
        });
      }
    });
  }

  /**
   * Sync bot stats + player states to MongoDB for the external dashboard.
   * Debounced: if called multiple times quickly, only the last call executes.
   */
  syncBotStats() {
    if (this._syncTimeout) clearTimeout(this._syncTimeout);
    this._syncTimeout = setTimeout(() => this._doSyncBotStats(), 500);
  }

  async _doSyncBotStats() {
    try {
      const { updateBotStats } = require("../util/mongodb");
      const pkg = require("../package.json");
      
      // Collect player states
      const players = {};
      if (this.manager?.players) {
        for (const [guildId, player] of this.manager.players) {
          const guild = this.guilds.cache.get(guildId);
          let voiceChannel = null;
          try {
            const vc = guild?.channels?.cache?.get(player.voiceChannelId);
            voiceChannel = vc?.name || null;
          } catch (e) {}

          const track = player.queue?.current;
          const queueTracks = player.queue?.tracks || [];
          players[guildId] = {
            guildId,
            voiceChannel,
            nowPlaying: track ? {
              title: track.info?.title || "Unknown",
              duration: track.info?.duration || 0,
              position: player.position || 0,
              requester: track.requester?.toString() || "Unknown",
              thumbnail: track.info?.artworkUrl || null,
              uri: track.info?.uri || null,
              isStream: track.info?.isStream || false,
            } : null,
            queue: queueTracks.slice(0, 50).map(t => ({
              title: t.info?.title || "Unknown",
              duration: t.info?.duration || 0,
              uri: t.info?.uri || null,
              requester: t.requester?.toString() || "Unknown",
            })),
          };
        }
      }

      await updateBotStats(this.config.clientId, {
        commandsRan: this.commandsRan,
        songsPlayed: this.songsPlayed,
        users: this.users.cache.size,
        servers: this.guilds.cache.size,
        uptime: this.uptime || 0,
        ping: this.ws.ping || 0,
        botName: this.user?.username || "",
        botVersion: pkg.version || "6.0.0",
        botAvatar: this.user?.displayAvatarURL() || "",
        inviteURL: `https://discord.com/oauth2/authorize?client_id=${this.config.clientId}&permissions=${this.config.permissions}&scope=${this.config.scopes.toString().replace(/,/g, "%20")}`,
        commands: this.slashCommands.map(cmd => ({
          name: cmd.name,
          description: cmd.description,
        })),
        guildIds: Array.from(this.guilds.cache.keys()),
        guildMemberCounts: Object.fromEntries(
          this.guilds.cache.map(g => [g.id, g.memberCount])
        ),
        players,
      });
    } catch (error) {
      // Silent fail - don't spam logs
    }
  }

  LoadCommands() {
    let SlashCommandsDirectory = path.join(__dirname, "..", "commands", "slash");
    fs.readdir(SlashCommandsDirectory, (err, files) => {
      if (err) {
        throw err;
      } else {
        files.forEach((file) => {
          let cmd = require(SlashCommandsDirectory + "/" + file);
          if (!cmd || !cmd.run) {
            return this.warn(
              "Unable to load Command: " + file.split(".")[0] + ", File doesn't have a valid command with run function"
            );
          }
          this.slashCommands.set(file.split(".")[0].toLowerCase(), cmd);
          this.log("Slash Command Loaded: " + file.split(".")[0]);
        });
      }
    });

    let ContextCommandsDirectory = path.join(__dirname, "..", "commands", "context");
    fs.readdir(ContextCommandsDirectory, (err, files) => {
      if (err) {
        throw err;
      } else {
        files.forEach((file) => {
          let cmd = require(ContextCommandsDirectory + "/" + file);
          if (!cmd.command || !cmd.run) {
            return this.warn(
              "Unable to load Command: " + file.split(".")[0] + ", File doesn't have either command/run"
            );
          }
          this.contextCommands.set(file.split(".")[0].toLowerCase(), cmd);
          this.log("ContextMenu Loaded: " + file.split(".")[0]);
        });
      }
    });
  }

  /**
   * Create a player
   * @param {import("discord.js").TextChannel} textChannel
   * @param {import("discord.js").VoiceChannel} voiceChannel
   */
  createPlayer(textChannel, voiceChannel) {
    const guildId = textChannel.guild.id;

    // Armazenar canais para uso posterior
    this.setPlayerData(guildId, "textChannel", textChannel.id);
    this.setPlayerData(guildId, "voiceChannel", voiceChannel.id);

    const player = this.manager.createPlayer({
      guildId: guildId,
      voiceChannelId: voiceChannel.id,
      textChannelId: textChannel.id,
      selfDeaf: this.config.serverDeafen,
      volume: this.config.defaultVolume,
    });

    // Garante a superfície estilo Riffy mesmo se o evento playerCreate
    // ainda não tiver disparado para este player.
    decoratePlayer(player);

    return player;
  }

  createController(guild, player, options = {}) {
    const guildId = typeof guild === 'string' ? guild : guild;
    const { showFilters = false, showVolume = false } = options;
    
    // Linha principal de controles - Design compacto e elegante
    const mainControls = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Replay`)
        .setEmoji(emojiFor("previous")),

      new ButtonBuilder()
        .setStyle(player.playing ? ButtonStyle.Success : ButtonStyle.Primary)
        .setCustomId(`controller:${guildId}:PlayAndPause`)
        .setEmoji(player.playing ? emojiFor("pause") : emojiFor("play")),

      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Next`)
        .setEmoji(emojiFor("skip")),

      new ButtonBuilder()
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`controller:${guildId}:Stop`)
        .setEmoji(emojiFor("stop")),

      new ButtonBuilder()
        .setStyle(player.loop === "track" ? ButtonStyle.Success : player.loop === "queue" ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Loop`)
        .setEmoji(player.loop === "track" ? emojiFor("loopone") : player.loop === "queue" ? emojiFor("loop") : emojiFor("navright"))
    );

    // Linha secundária com opções adicionais
    const shuffleEnabled = this.getPlayerData(guildId, "shuffleEnabled") || false;
    const secondaryControls = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(shuffleEnabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Shuffle`)
        .setEmoji(emojiFor("shuffle")),

      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Queue`)
        .setEmoji(emojiFor("queue")),

      new ButtonBuilder()
        .setStyle(showVolume ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Volume`)
        .setEmoji(emojiFor("vol2")),

      new ButtonBuilder()
        .setStyle(showFilters ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:ToggleFilters`)
        .setEmoji(emojiFor("filters")),

      new ButtonBuilder()
        .setStyle(this.getPlayerData(guildId, "autoQueue") ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:AutoQueue`)
        .setEmoji(emojiFor("plus"))
    );

    const components = [mainControls, secondaryControls];

    // Se o volume estiver expandido, mostrar o select menu
    if (showVolume) {
      const volumeMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`volume:${guildId}`)
          .setPlaceholder(`Volume atual: ${player.volume || 100}%`)
          .addOptions([
            { label: `Mudo (0%)`, value: '0', description: 'Silenciar completamente', emoji: emojiFor("vol0") },
            { label: `10%`, value: '10', description: 'Volume muito baixo', emoji: emojiFor("vol0") },
            { label: `25%`, value: '25', description: 'Volume baixo', emoji: emojiFor("vol0") },
            { label: `50%`, value: '50', description: 'Volume médio', emoji: emojiFor("vol1") },
            { label: `75%`, value: '75', description: 'Volume médio-alto', emoji: emojiFor("vol1") },
            { label: `100%`, value: '100', description: 'Volume padrão', emoji: emojiFor("vol2") },
            { label: `125%`, value: '125', description: 'Volume alto', emoji: emojiFor("vol2") },
            { label: '150%', value: '150', description: 'Volume muito alto', emoji: '📢' },
            { label: '200%', value: '200', description: 'Volume máximo', emoji: '📢' },
          ])
      );
      components.push(volumeMenu);
    }

    // Se os filtros estiverem expandidos, mostrar o select menu
    if (showFilters) {
      const filtersMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`filters:${guildId}`)
          .setPlaceholder(`Selecione um filtro de áudio`)
          .addOptions([
            { label: `Resetar Filtros`, value: 'off', description: 'Remove todos os filtros aplicados', emoji: emojiFor("error") },
            { label: 'Nightcore', value: 'nightcore', description: 'Acelera e aumenta o pitch', emoji: '🌙' },
            { label: `Vaporwave`, value: 'vaporwave', description: 'Desacelera e diminui o pitch', emoji: emojiFor("waves") },
            { label: `Slow`, value: 'slow', description: 'Reprodução lenta', emoji: emojiFor("slow") },
            { label: `Fast`, value: 'fast', description: 'Reprodução rápida', emoji: emojiFor("zap") },
            { label: `Bass Low`, value: 'bassboost_low', description: 'Bass boost suave', emoji: emojiFor("vol1") },
            { label: `Bass Medium`, value: 'bassboost_medium', description: 'Bass boost médio', emoji: emojiFor("vol2") },
            { label: 'Bass High', value: 'bassboost_high', description: 'Bass boost intenso', emoji: '💥' },
            { label: '8D Audio', value: '8d', description: 'Efeito de áudio rotativo', emoji: '🎧' },
            { label: `Karaoke`, value: 'karaoke', description: 'Remove vocais', emoji: emojiFor("micvocal") },
            { label: 'Vibrato', value: 'vibrato', description: 'Efeito de vibração', emoji: '〰️' },
            { label: `Tremolo`, value: 'tremolo', description: 'Efeito de tremolo', emoji: emojiFor("vibrate") },
          ])
      );
      components.push(filtersMenu);
    }

    return components;
  }

  /**
   * Cria o player usando Components V2 - Design totalmente integrado!
   * Os botões ficam DENTRO do container junto com as informações da música
   */
  createPlayerV2(guild, player, track, options = {}) {
    const guildId = typeof guild === 'string' ? guild : guild;
    const { showFilters = false, showVolume = false, currentPosition = 0 } = options;
    // Fila inline (toggle): lida do playerData p/ ficar em sincronia entre re-renders
    const showQueue = this.getPlayerData(guildId, "showQueue") || false;
    const queuePage = this.getPlayerData(guildId, "queuePage") || 0;

    // Formatar título
    let title = escapeMarkdown(track.info?.title || track.title || "Unknown");
    title = title.replace(/\]/g, "").replace(/\[/g, "");
    
    const trackLength = track.info?.length || track.length || 0;
    const isStream = track.info?.isStream || track.isStream || false;
    const requester = track.info?.requester || track.requester || `<@${this.user.id}>`;
    const queueLength = player.queue?.length || 0;
    const loopMode = player.loop === "track" ? `${emojiTag("loopone")} Track` : player.loop === "queue" ? `${emojiTag("loop")} Queue` : `${emojiTag("navright")} Off`;
    const thumbnail = track.info?.artworkUrl || track.artworkUrl || track.info?.thumbnail || track.thumbnail;
    
    // Criar barra de progresso visual
    const progressBar = createProgressBar(currentPosition, trackLength, 20);
    const currentTime = isStream ? `${emojiTag("live")} LIVE` : prettyMilliseconds(currentPosition, { colonNotation: true, secondsDecimalDigits: 0 });
    const totalTime = isStream ? "" : prettyMilliseconds(trackLength, { colonNotation: true, secondsDecimalDigits: 0 });
    
    // ═══════════════════════════════════════════════════════
    // COMPONENTS V2 - Design integrado
    // ═══════════════════════════════════════════════════════
    
    const components = [];
    
    // Container principal com cor de destaque
    const mainContainer = new ContainerBuilder()
      .setAccentColor(0x5865F2); // Discord Blurple
    
    // Header com thumbnail e info da música (Section)
    const headerSection = new SectionBuilder();
    
    // Texto principal com todas as informações
    const infoText = new TextDisplayBuilder()
      .setContent(
        `## <a:logo:1447825263844130816> Now Playing\n` +
        `**[${title}](${track.info?.uri || track.uri || '#'})**\n\n` +
        `👤 ${requester}  •  ${emojiTag("queue")} ${queueLength} na fila\n\n` +
        `${progressBar}\n\n` +
        `${emojiTag("loop")} Loop: ${loopMode}  •  ${emojiTag("vol2")} Volume: ${player.volume || 100}%`
      );
    
    headerSection.addTextDisplayComponents(infoText);
    
    // Adicionar thumbnail se disponível
    if (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('http')) {
      try {
        const thumbnailComponent = new ThumbnailBuilder()
          .setURL(thumbnail);
        headerSection.setThumbnailAccessory(thumbnailComponent);
      } catch (e) {
        // Ignorar erro de thumbnail inválida
      }
    }
    
    mainContainer.addSectionComponents(headerSection);
    
    // Separador elegante
    mainContainer.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true)
    );
    
    // ═══════════════════════════════════════════════════════
    // CONTROLES - Agora DENTRO do Container!
    // ═══════════════════════════════════════════════════════
    
    // Linha de controles principais
    const mainControls = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Replay`)
        .setEmoji(emojiFor("previous")),
      new ButtonBuilder()
        .setStyle(player.playing ? ButtonStyle.Success : ButtonStyle.Primary)
        .setCustomId(`controller:${guildId}:PlayAndPause`)
        .setEmoji(player.playing ? emojiFor("pause") : emojiFor("play")),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Next`)
        .setEmoji(emojiFor("skip")),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`controller:${guildId}:Stop`)
        .setEmoji(emojiFor("stop")),
      new ButtonBuilder()
        .setStyle(player.loop === "track" ? ButtonStyle.Success : player.loop === "queue" ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Loop`)
        .setEmoji(player.loop === "track" ? emojiFor("loopone") : player.loop === "queue" ? emojiFor("loop") : emojiFor("navright"))
    );

    mainContainer.addActionRowComponents(mainControls);

    // Linha secundária
    const shuffleEnabledV2 = this.getPlayerData(guildId, "shuffleEnabled") || false;
    const secondaryControls = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(shuffleEnabledV2 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Shuffle`)
        .setEmoji(emojiFor("shuffle")),
      new ButtonBuilder()
        .setStyle(showQueue ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:ToggleQueue`)
        .setEmoji(emojiFor("queue")),
      new ButtonBuilder()
        .setStyle(showVolume ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:Volume`)
        .setEmoji(emojiFor("vol2")),
      new ButtonBuilder()
        .setStyle(showFilters ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:ToggleFilters`)
        .setEmoji(emojiFor("filters")),
      new ButtonBuilder()
        .setStyle(this.getPlayerData(guildId, "autoQueue") ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setCustomId(`controller:${guildId}:AutoQueue`)
        .setEmoji(emojiFor("plus"))
    );
    
    mainContainer.addActionRowComponents(secondaryControls);

    // ═══ FILA (toggle): tocadas + tocando agora + próximas c/ remover, paginado ═══
    if (showQueue) {
      mainContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

      const upcoming = player.queue?.tracks || [];
      const previous = player.queue?.previous || [];
      const PAGE = 4;
      const totalPages = Math.max(1, Math.ceil(upcoming.length / PAGE));
      const qpage = Math.min(Math.max(0, queuePage), totalPages - 1);
      const start = qpage * PAGE;
      const pageItems = upcoming.slice(start, start + PAGE);

      const fmtDur = (t) => {
        const ms = t?.info?.duration ?? t?.info?.length ?? 0;
        return t?.info?.isStream ? "LIVE" : prettyMilliseconds(ms, { colonNotation: true, secondsDecimalDigits: 0 });
      };
      const clean = (s) => escapeMarkdown(String(s || "Unknown")).replace(/[\[\]]/g, "").slice(0, 55);
      const reqOf = (t) => {
        const r = t?.requester || t?.info?.requester;
        if (!r) return "";
        if (typeof r === "string") return r;
        if (r.id) return `<@${r.id}>`;
        return "";
      };

      // Cabeçalho + tocadas anteriormente + tocando agora (num texto só)
      let head = `### ${emojiTag("queue")} Fila  •  ${upcoming.length} na fila  •  Página ${qpage + 1}/${totalPages}`;
      if (previous.length) {
        const prev = previous.slice(0, 2).reverse().map((t) => `\`✓\` ${clean(t.info?.title)} \`${fmtDur(t)}\``);
        head += `\n**Tocadas:**\n${prev.join("\n")}`;
      }
      head += `\n${emojiTag("play")} **Tocando agora:** ${clean(title)} \`${currentTime}${totalTime ? " / " + totalTime : ""}\``;
      mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(head));

      if (!pageItems.length) {
        mainContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent("*Nada na fila ainda — use `/play`.*"));
      } else {
        for (let i = 0; i < pageItems.length; i++) {
          const t = pageItems[i];
          const globalIdx = start + i;
          const req = reqOf(t);
          const sec = new SectionBuilder();
          sec.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `\`${globalIdx + 1}.\` **${clean(t.info?.title)}** \`${fmtDur(t)}\`${req ? `\n${req}` : ""}`
            )
          );
          sec.setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`controller:${guildId}:QRemove:${globalIdx}`)
              .setEmoji(emojiFor("trash"))
              .setStyle(ButtonStyle.Danger)
          );
          mainContainer.addSectionComponents(sec);
        }
      }

      if (totalPages > 1) {
        mainContainer.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`controller:${guildId}:QPage:prev`).setEmoji(emojiFor("navleft")).setStyle(ButtonStyle.Secondary).setDisabled(qpage === 0),
            new ButtonBuilder().setCustomId(`controller:${guildId}:QPageInfo`).setLabel(`${qpage + 1}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId(`controller:${guildId}:QPage:next`).setEmoji(emojiFor("navright")).setStyle(ButtonStyle.Secondary).setDisabled(qpage >= totalPages - 1)
          )
        );
      }
    }

    // Se o volume estiver expandido, mostrar o select menu DENTRO do container
    if (showVolume) {
      mainContainer.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      );
      
      const volumeText = new TextDisplayBuilder()
        .setContent(`### ${emojiTag("vol2")} Ajustar Volume\nVolume atual: **${player.volume || 100}%**`);
      mainContainer.addTextDisplayComponents(volumeText);
      
      const volumeMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`volume:${guildId}`)
          .setPlaceholder('Selecione o volume...')
          .addOptions([
            { label: `Mudo (0%)`, value: '0', description: 'Silenciar completamente', emoji: emojiFor("vol0") },
            { label: `10%`, value: '10', description: 'Volume muito baixo', emoji: emojiFor("vol0") },
            { label: `25%`, value: '25', description: 'Volume baixo', emoji: emojiFor("vol0") },
            { label: `50%`, value: '50', description: 'Volume médio', emoji: emojiFor("vol1") },
            { label: `75%`, value: '75', description: 'Volume médio-alto', emoji: emojiFor("vol1") },
            { label: `100%`, value: '100', description: 'Volume padrão', emoji: emojiFor("vol2") },
            { label: `125%`, value: '125', description: 'Volume alto', emoji: emojiFor("vol2") },
            { label: '150%', value: '150', description: 'Volume muito alto', emoji: '📢' },
            { label: '200%', value: '200', description: 'Volume máximo', emoji: '📢' },
          ])
      );
      
      mainContainer.addActionRowComponents(volumeMenu);
    }
    
    // Se os filtros estiverem expandidos, adicionar o select menu DENTRO do container
    if (showFilters) {
      mainContainer.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      );
      
      const filtersText = new TextDisplayBuilder()
        .setContent(`### ${emojiTag("filters")} Filtros de Áudio\nSelecione um filtro para aplicar:`);
      mainContainer.addTextDisplayComponents(filtersText);
      
      const filtersMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`filters:${guildId}`)
          .setPlaceholder('Escolha um filtro...')
          .addOptions([
            { label: `Resetar`, value: 'off', description: 'Remove todos os filtros', emoji: emojiFor("error") },
            { label: 'Nightcore', value: 'nightcore', description: 'Acelera e aumenta o pitch', emoji: '🌙' },
            { label: `Vaporwave`, value: 'vaporwave', description: 'Desacelera e diminui o pitch', emoji: emojiFor("waves") },
            { label: `Slow`, value: 'slow', description: 'Reprodução lenta', emoji: emojiFor("slow") },
            { label: `Fast`, value: 'fast', description: 'Reprodução rápida', emoji: emojiFor("zap") },
            { label: `Bass Low`, value: 'bassboost_low', description: 'Bass boost suave', emoji: emojiFor("vol1") },
            { label: `Bass Med`, value: 'bassboost_medium', description: 'Bass boost médio', emoji: emojiFor("vol2") },
            { label: 'Bass High', value: 'bassboost_high', description: 'Bass boost intenso', emoji: '💥' },
            { label: '8D Audio', value: '8d', description: 'Efeito rotativo', emoji: '🎧' },
            { label: `Karaoke`, value: 'karaoke', description: 'Remove vocais', emoji: emojiFor("micvocal") },
            { label: 'Vibrato', value: 'vibrato', description: 'Efeito de vibração', emoji: '〰️' },
            { label: `Tremolo`, value: 'tremolo', description: 'Efeito tremolo', emoji: emojiFor("vibrate") },
          ])
      );
      
      mainContainer.addActionRowComponents(filtersMenu);
    }
    
    components.push(mainContainer);
    
    return {
      components,
      flags: MessageFlags.IsComponentsV2,
    };
  }
}

module.exports = DiscordMusicBot;

