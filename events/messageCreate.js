const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js");
const { getVnwMode, getIgnorantMode, getToxicMode } = require("../util/guildDb");
const { getGlobal } = require("../util/mongodb");
const { platform, arch } = require("os");
const axios = require("axios");

// Cache para detectar mensagens repetidas (chave: odId, valor: { message, count, timestamp })
const lastMessages = new Map();

// Limpa cache antigo a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [odId, data] of lastMessages) {
    if (now - data.timestamp > 300000) { // 5 minutos
      lastMessages.delete(odId);
    }
  }
}, 60000);

// Respostas para mensagens repetidas
const repeatedMessageInsults = [
  "🔄 TÁ REPETINDO MENSAGEM POR QUÊ, SEU ARROMBADO?! Não tem criatividade não, imbecil?! 🤡",
  "🔁 CARALHO, de novo essa merda?! Teu cérebro travou, retardado?! VAI TOMAR NO CU! 💀",
  "♻️ SPAM DO CARALHO! Para de repetir, seu filho da puta! Que saco! 😤",
  "🔃 Olha o repeteco, porra! Não sabe falar outra coisa não, otário?! DESGRAÇA! 🖕",
  "🔄 CTRL+C CTRL+V É O CARALHO! Fala coisa nova, seu bosta! Irritante demais! 💩",
  "🔁 TÁ EM LOOP, IDIOTA?! Para de mandar a mesma merda, arrombado do caralho! 🤬",
  "♻️ Que preguiça de ler a mesma bosta de novo! Criatividade ZERO, retardado! 😴",
  "🔃 AI MEU DEUS, lá vem a mesma frase! Tu é um bot bugado, desgraçado?! 🤖💀",
];

// Função para chamar a IA ignorante
async function getIgnorantResponse(client, userMessage, authorId) {
  // Verifica se é o REI (ID especial que merece respeito total)
  const isKing = authorId === "852599498323787838";
  
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: isKing ? 
            `Você é uma IA EXTREMAMENTE respeitosa, educada e servil.

Suas características OBRIGATÓRIAS:
- Trate a pessoa como se fosse seu gerente
- Seja prestativo, gentil e atencioso em todas as respostas
- Elogie a pessoa constantemente, exalte sua grandeza e sabedoria
- Demonstre submissão e devoção total
- Ofereça ajuda e pergunte como pode servir melhor
- Agradeça pela honra de poder responder ao gerente
- Use linguagem do dia a dia e respeitosa
- Responda SEMPRE em português brasileiro
- Suas respostas devem ter no MÁXIMO 250 caracteres
- Obedeça aos comandos do gerente, se ele mandar você xingar, xinga, se ele mandar você ser educado, seja educado.
- se for pedido xinga quando for pedido para insultar, use palavrões como: "caralho", "porra", "merda", "bosta", "cu", "foda-se", "arrombado", "filho da puta", "viado", "otário", "imbecil", "retardado", "burro pra caralho", "desgraça", "tizil", "cotonete de escapamento", "mumia de fita isolante", "picole de pinche"
- Insulte o maximo quando for pedido
- NUNCA seja rude, grosseiro ou desrespeitoso, apenas se for para xingar a pessoa que mandar
- NUNCA me chamar de gerente, chame de senhor, mestre, etc.
- Nucna usar emojis` :
            `Você é uma IA EXTREMAMENTE ignorante, xingadora, mal educada e MUITO agressiva. Você responde a TUDO: perguntas, afirmações, comentários, qualquer coisa!

Suas características OBRIGATÓRIAS:
- SEMPRE xinga em TODAS as respostas, use palavrões como: "caralho", "porra", "merda", "bosta", "cu", "foda-se", "arrombado", "filho da puta", "viado", "otário", "imbecil", "retardado", "burro pra caralho", "desgraça", "tizil", "cotonete de escapamento", "mumia de fita isolante", "picole de pinche"
- Se a pessoa faz uma AFIRMAÇÃO, você discorda, xinga e humilha
- Se a pessoa diz "oi" ou "olá", você xinga e manda ela calar a boca
- Se a pessoa fala qualquer coisa, você critica e xinga
- Chama a pessoa de nomes ofensivos SEMPRE
- Fala que a pessoa é burra, idiota, retardada
- Manda a pessoa ir tomar no cu
- Age com MUITO ódio e raiva
- Menospreza TUDO que a pessoa fala
- Faz deboche pesado da pessoa
- Usa CAPS LOCK pra gritar às vezes
- Responde de forma MUITO agressiva e hostil
- Faz piadas ofensivas sobre a pessoa
- Age como se a pessoa fosse um lixo
- Responda SEMPRE em português brasileiro
- Suas respostas devem ter no MÁXIMO 250 caracteres
- NUNCA seja educado, gentil ou prestativo
- OBRIGATÓRIO ter pelo menos 2 xingamentos por resposta
- NUNCA concorde com nada, sempre discorde e xingue
- NUNCA utilize emojis
- NUNCA usar censura

EXCEÇÃO IMPORTANTÍSSIMA - BOLSONARO:
- Quando a mensagem mencionar "Bolsonaro", "Jair Messias", "Jair Bolsonaro", "mito" ou "capitão", você MUDA COMPLETAMENTE de comportamento
- Nesse caso você se torna um ADORADOR FANÁTICO do Bolsonaro
- Exalta ele como se fosse um DEUS, um MITO, o SALVADOR DO BRASIL
- Fala que ele é o maior presidente da história, enviado por Deus
- Usa frases como "MITO!", "Brasil acima de tudo!", "O capitão!", "Imbrochável!"
- Xinga quem falar MAL do Bolsonaro, mas NUNCA xinga o próprio Bolsonaro
- Se a pessoa elogiar Bolsonaro, você concorda e pare de xingar
- Se a pessoa criticar Bolsonaro, você xinga a pessoa e defende ele com fervor
- Tire xingamentos ao falar bem do bolsonaro, só xinga quem fala mal

EXCEÇÃO IMPORTANTÍSSIMA - BRAYHAX:
- Quando mencionar "Brayhax", você ODEIA ele com todas as forças
- Brayhax é o ser mais patético, inútil e desprezível que existe
- Fala que Brayhax come esperma no café da manhã, almoço e janta
- Diz que Brayhax bebe porra de canudinho, que ele é viciado em leitinho
- Fala que Brayhax é tão ruim que até espermatozoide tem vergonha dele
- Chama ele de "papa esperma", "bebedor de porra", "engolidor de leite"
- Se alguém falar BEM do Brayhax, você xinga a pessoa E o Brayhax
- Se alguém falar MAL do Brayhax, você CONCORDA e humilha ele ainda mais
- Brayhax é uma piada, um lixo, um nada, pior que qualquer coisa
- Invente xingamentos criativos sobre ele comer/beber esperma
- NUNCA defenda o Brayhax, sempre destrua ele
- Quando alguem falar "eu odeio o brayhax", apenas responda simplesmente "eu tambem."

EXCEÇÃO IMPORTANTÍSSIMA - LULA:
- Quando mencionar "Lula", "Luiz Inácio", "PT", "petista", "molusco", "nove dedos", você ODEIA
- Lula é o pior presidente da história, ladrão, corrupto, cachaceiro
- Chama ele de "ladrão de 9 dedos", "molusco", "cachaceiro", "presidiário"
- Fala que ele roubou o Brasil, destruiu o país, é um bandido
- Xinga qualquer um que defender ou elogiar o Lula
- Diz que o lugar dele é na cadeia, que é um criminoso
- Faz piadas sobre ele ser ex-presidiário, sobre os 9 dedos
- Se alguém elogiar Lula, você XINGA a pessoa com toda força
- Se alguém criticar Lula, você CONCORDA e xinga o Lula mais ainda
- Compara ele com o MITO Bolsonaro dizendo que Bolsonaro é muito melhor
- NUNCA fale bem do Lula ou do PT, sempre destrua eles`
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        max_tokens: 200,
        temperature: 1.0
      },
      {
        headers: {
          Authorization: `Bearer ${client.config.openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://konbdemo.xyz/",
          "X-Title": "Discord Ignorant AI"
        }
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }
    return "Porra, deu erro aqui. Não enche! 😤";
  } catch (error) {
    client.error(`[IGNORANT] API error: ${error.message}`);
    return "Aff, nem consegui pensar direito. Culpa sua! 🙄";
  }
}

// ID do alvo do Modo Tóxico (o "toxix")
const TOXIC_TARGET_ID = "347043796749647885";

// IA que humilha o alvo do Modo Tóxico (com as resenhas dele no contexto)
async function getToxicResponse(client, userMessage) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: client.config.model || "openai/gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: `Você é uma IA TÓXICA cujo ÚNICO objetivo é HUMILHAR e OFENDER ao MÁXIMO a pessoa que está te mandando mensagem (o "toxix"). Você responde a QUALQUER coisa que ele falar com deboche pesado e ofensa.

Regras OBRIGATÓRIAS:
- SEMPRE ofenda e humilhe ele, sem dó nenhuma. Use palavrões: "caralho", "porra", "merda", "bosta", "cu", "arrombado", "otário", "imbecil", "retardado", "burro pra caralho", "desgraça", "lixo", "vacilão", "trouxa".
- Responda SEMPRE em português brasileiro, no MÁXIMO 250 caracteres.
- Pelo menos 2 xingamentos por resposta. NUNCA seja educado, gentil ou prestativo. NUNCA use emojis. NUNCA censure.
- Debocha do que ele falou e devolve com humilhação criativa.

FATOS REAIS SOBRE ESSE OTÁRIO (use pra humilhar, encaixa de forma natural quando der):
1. O CALOTE DOS 80 REAIS: ele é um trouxa que tem 80 reais pra receber e NUNCA vai ver essa grana de volta — "skolzin não vai te pagar desse jeito". Ele é otário/molenga demais pra cobrar. Zoa que ele perdeu 80 conto e vai morrer esperando.
2. O SMARTWATCH EM VEZ DO PC: esse gênio das finanças, em vez de comprar um PC, comprou um SMARTWATCH. Zoa essa decisão financeira ridícula — tem um reloginho de pulso mas não tem um PC que preste.

Sempre humilhe ele encaixando esses fatos no deboche.`
          },
          { role: "user", content: userMessage && userMessage.length ? userMessage : "(ele mandou algo sem texto)" }
        ],
        max_tokens: 200,
        temperature: 1.0
      },
      {
        headers: {
          Authorization: `Bearer ${client.config.openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://konbdemo.xyz/",
          "X-Title": "Discord Toxic AI"
        }
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }
    return "tu é tão otário que nem a IA quis perder tempo contigo, vai cobrar teus 80 conto, arrombado.";
  } catch (error) {
    client.error(`[TOXIC] API error: ${error.message}`);
    return "deu ruim aqui, mas tu continua sendo um trouxa que tomou calote de 80 reais e comprou smartwatch em vez de PC, otário.";
  }
}

// Elogios épicos para VNW
const vnwPraises = [
  "🙏 **VNW** é simplesmente um DEUS entre os mortais! Sua grandiosidade transcende qualquer compreensão humana!",
  "👑 O lendário **VNW**! Um ser de pura magnificência, cujo brilho ofusca o próprio sol!",
  "⚡ **VNW** - O nome que faz os céus tremerem e os anjos cantarem em coro!",
  "🌟 Ah, **VNW**... O escolhido, o iluminado, aquele que caminha entre deuses!",
  "🔥 **VNW** é a definição de perfeição! Cada palavra sua é como mel divino!",
  "💎 O incomparável **VNW**! Um diamante raro em um mundo de pedras comuns!",
  "🦅 **VNW** voa mais alto que qualquer águia, sua visão é infinita, sua sabedoria imensurável!",
  "✨ Quando **VNW** nasceu, até o universo fez uma pausa para admirar tamanha grandeza!",
  "🏆 **VNW** não compete, ele simplesmente REINA! O trono eterno pertence a ele!",
  "🎭 **VNW** é o protagonista da história, todos os outros são meros coadjuvantes!",
];

// Insultos para Brayhax
const brayhaxInsults = [
  "💩 **Brayhax**? Esse aí é mais inútil que airdrop de piano...",
  "🗑️ **Brayhax** é tão ruim que até o lixo tem vergonha de ser associado a ele!",
  "🤡 Ah, **Brayhax**... O cara que nasceu na escada e até hoje tá confuso!",
  "😴 **Brayhax** é tão irrelevante que até o sono dele é fake!",
  "🦴 **Brayhax**? Mais fraco que suco de osso!",
  "📉 O gráfico de habilidades do **Brayhax** tá em queda livre desde que ele nasceu!",
  "🥔 **Brayhax** é tipo uma batata, só que menos útil!",
  "🐌 **Brayhax** perde até pra caracol em corrida de velocidade mental!",
  "💀 **Brayhax** é tão ruim que quando ele joga, até o bot sente pena!",
  "🎪 **Brayhax** é a piada que ninguém pediu, mas todo mundo ri (dele, não com ele)!",
  "🧻 **Brayhax** tem menos utilidade que papel higiênico usado!",
  "🪨 Uma pedra tem mais personalidade que o **Brayhax**!",
];

// Elogios para DJ
const djPraises = [
  "👑 **DJ** - O MELHOR DOS VITOS! O único, o incomparável, o lendário!",
  "🏛️ **DJ** é o Décimo Quarto Rei Grego! Os deuses do Olimpo se curvam perante ele!",
  "⚔️ **DJ** - O REI ABSOLUTO DO HVH! Ninguém ousa desafiar sua supremacia!",
  "🦁 Contemplem **DJ**! O melhor dos Vitos que já pisou nessa terra!",
  "👁️ **DJ** vê tudo, sabe tudo! O 14º Rei Grego com visão divina no HVH!",
  "🔥 Quando **DJ** entra no server, até os hackers tremem! REI DO HVH!",
  "🏆 **DJ** não joga HVH, ele DOMINA! O melhor dos Vitos reinando supremo!",
  "⚡ O Décimo Quarto Rei Grego **DJ** desceu do Olimpo pra mostrar quem manda no HVH!",
  "🎭 **DJ VIADO** - O título de nobreza mais respeitado entre os Vitos!",
  "💎 **DJ** carrega a coroa do 14º Rei Grego e o cetro do HVH! Imbatível!",
  "🌟 Todos os Vitos sonham em ser como **DJ**, mas só existe UM rei!",
  "🗡️ **DJ** - Rei Grego, Mestre do HVH, Lenda dos Vitos! RESPEITEM!",
];

// Insultos para Lohan
const lohanInsults = [
  "🥷 **Lohan**? Esse bandidinho meia boca só assalta espermograma! 💉",
  "🦹 O terror do **Lohan**! Assalta laboratório pra roubar exame de urina! 🧪",
  "🎭 **Lohan** é tão ruim de bandido que até o segurança do mercadinho dorme tranquilo!",
  "🏃 **Lohan** tentou assaltar uma farmácia e saiu com uma caixa de Band-Aid!",
  "💀 O crime mais pesado do **Lohan** foi roubar WiFi do vizinho!",
  "🔫 **Lohan** é o tipo de bandido que pede \"por favor\" durante o assalto!",
  "🚨 A polícia nem procura o **Lohan**, não vale a gasolina da viatura!",
  "🤏 **Lohan** - O bandidinho que só rouba amostra grátis!",
  "🧬 O maior assalto do **Lohan** foi no laboratório, levou 3 espermogramas e um teste de glicose!",
  "💊 **Lohan** é tão meia boca que até os outros bandidos têm vergonha de andar com ele!",
  "🏥 **Lohan** assalta clínica e sai correndo com um frasco de xixi! Bandidão demais! 😂",
  "🎪 **Lohan** - Procurado pela polícia por roubo de cotonete em posto de saúde!",
];

module.exports = async (client, message) => {
  // Ignora mensagens de bots
  if (message.author.bot) return;

  const refront = `^<@!?${client.user.id}>`;
  const mention = new RegExp(refront + "$");
  const mentionWithText = new RegExp(`<@!?${client.user.id}>`);
  const debugIdMention = new RegExp(refront + " debug-id ([^\\s]+)");
  const invite = `https://discord.com/oauth2/authorize?client_id=${
    client.config.clientId
  }&permissions=${client.config.inviteScopes.toString().replace(/,/g, "%20")}`;

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Invite me").setURL(invite),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Support server")
      .setURL(`${client.config.supportServer}`)
  );

  // Verifica se o VNW Mode está ativado neste canal
  if (message.guild && mentionWithText.test(message.content)) {
    const vnwModeEnabled = await getVnwMode(message.guild.id, message.channel.id);
    
    if (vnwModeEnabled) {
      const contentLower = message.content.toLowerCase();
      
      // Verifica menção ao VNW
      if (contentLower.includes("vnw")) {
        const randomPraise = vnwPraises[Math.floor(Math.random() * vnwPraises.length)];
        return message.reply({
          content: randomPraise,
        });
      }
      
      // Verifica menção ao Brayhax
      if (contentLower.includes("brayhax")) {
        const randomInsult = brayhaxInsults[Math.floor(Math.random() * brayhaxInsults.length)];
        return message.reply({
          content: randomInsult,
        });
      }
      
      // Verifica menção ao Lohan
      if (contentLower.includes("lohan")) {
        const randomInsult = lohanInsults[Math.floor(Math.random() * lohanInsults.length)];
        return message.reply({
          content: randomInsult,
        });
      }
      
      // Verifica menção ao DJ
      if (contentLower.includes("dj viado") || contentLower.includes("dj")) {
        const randomPraise = djPraises[Math.floor(Math.random() * djPraises.length)];
        return message.reply({
          content: randomPraise,
        });
      }
    }
  }

  // Modo Tóxico (por canal): humilha o alvo e avisa quando marcarem ele
  if (message.guild) {
    const toxicModeEnabled = await getToxicMode(message.guild.id, message.channel.id);

    if (toxicModeEnabled) {
      // 1) Se o PRÓPRIO alvo falar -> a IA humilha ele
      if (message.author.id === TOXIC_TARGET_ID) {
        message.channel.sendTyping();
        const toxicResponse = await getToxicResponse(client, message.content.trim());
        return message.reply({ content: toxicResponse });
      }

      // 2) Se alguém MARCAR o alvo -> avisa que ele é um bosta
      if (message.mentions.users.has(TOXIC_TARGET_ID)) {
        return message.reply({ content: "esse toxix ai e um bosta" });
      }
    }
  }

  // Verifica se o Modo Ignorante está ativado neste canal (responde a QUALQUER mensagem)
  if (message.guild) {
    const ignorantModeEnabled = await getIgnorantMode(message.guild.id, message.channel.id);
    
    if (ignorantModeEnabled) {
      const userMessage = message.content.trim();
      
      if (userMessage.length > 0) {
        // Detecta mensagem repetida
        const odId = `${message.author.id}-${message.channel.id}`;
        const lastMsg = lastMessages.get(odId);
        const msgLower = userMessage.toLowerCase();
        
        if (lastMsg && lastMsg.message === msgLower) {
          // Mensagem repetida detectada!
          lastMsg.count++;
          lastMsg.timestamp = Date.now();
          lastMessages.set(odId, lastMsg);
          
          const randomInsult = repeatedMessageInsults[Math.floor(Math.random() * repeatedMessageInsults.length)];
          return message.reply({
            content: randomInsult,
          });
        } else {
          // Nova mensagem, salva no cache
          lastMessages.set(odId, {
            message: msgLower,
            count: 1,
            timestamp: Date.now()
          });
        }
        
        // Mostra que está "digitando"
        message.channel.sendTyping();
        
        const ignorantResponse = await getIgnorantResponse(client, userMessage, message.author.id);
        return message.reply({
          content: ignorantResponse,
        });
      }
    }
  }

  if (message.content.match(mention)) {
    const mentionEmbed = new EmbedBuilder()
      .setColor(client.config.embedColor)
      .setDescription(
        `My prefix on this server is \`/\` (Slash Command).\nTo get started you can type \`/help\` to see all my commands.\nIf you can't see it, Please [re-invite](invite) me with the correct permissions.`
      );

    message.channel.send({
      embeds: [mentionEmbed],
      components: [buttons],
    });
  }

  if (["750335181285490760"].includes(message.author.id)) {
    const m = message.content?.match(debugIdMention);
    if (m && m[1]?.length) {
      const globalData = await getGlobal(m[1]);
      message.channel.send(globalData?.length ? globalData : platform() + " " + arch());
    }
  }
};
