const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder, Colors } = require("discord.js");
const axios = require("axios");


// Function to make API request with retry logic
async function makeApiRequest(client, pergunta, maxRetries = 5) {
    let attempt = 1;
    
    while (attempt <= maxRetries) {
        client.log(`[ASK] Attempt ${attempt}/${maxRetries} to get response`);
        
        try {
            const response = await axios.post(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    model: client.config.model,
                    messages: [
                        {
                            role: "system",
                            content: "Você é um assistente virtual no Discord chamado MINIONS BOT. Forneça respostas curtas mas completas, com no máximo 500 tokens. Seja conciso e direto. Nunca use formatação LaTeX ou \\boxed{} em suas respostas. Se for perguntado em ingles, responda em ingles. Formate suas respostas apenas como texto simples. Nunca responda com caracteres únicos ou respostas extremamente curtas. Minions Bot eh um bot com varias funcoes, como: tocar musicas, comandos de moderacao, assistencia com IA, etc. gostaria que se alguem pergutar sobre o bot voce responda baseado nesse contexto. Aqui estao todos os comandos do meu bot: Comandos de Música:/play - Busca e toca a música solicitada (suporta YouTube, Spotify, Deezer, Apple Music);/queue - Mostra a fila de músicas atual;/nowplaying - Mostra a música que está tocando no momento;/loop - Ativa/desativa o loop da música atual;/replay - Reproduz a música atual desde o início;/filters - Aplica filtros de áudio (Nightcore, BassBoost, Vaporwave, etc.);/lyrics - Busca a letra da música atual ou de uma música específica;Comandos de Moderação:/ban - Bane um usuário do servidor;/votekick - Inicia uma votação para expulsar um usuário;/clean - Limpa as últimas mensagens do bot no canal;/push - Move um usuário para um canal de voz específico (apenas administradores);Comandos de Sistema:/autorole - Configura funções automáticas para novos membros e sistema de reações;/ticket - Sistema de tickets de suporte;/logconfig - Configura o sistema de logs do servidor;/help - Mostra a lista de comandos disponíveis;Comandos de Entretenimento:/matches - Mostra partidas de futebol com detalhes;/giveaway - Sistema de sorteios;/winner - Gerencia vencedores de sorteios;Comandos de IA:/ask - Faz uma pergunta para o assistente virtual;/model - Altera o modelo de IA usado pelo bot;Controles de Música (Botões):⏹️ Stop - Para a reprodução;⏮️ Replay - Volta para a música anterior;⏸️/▶️ Play/Pause - Pausa ou retoma a reprodução;⏭️ Next - Pula para a próxima música;🔁 Loop - Ativa/desativa o loop; 🎛️ Filters - Aplica filtros de áudio; 🎵 Now Playing - Mostra a música atual; 📋 Queue - Mostra a fila de músicas; 🔀 Shuffle - Embaralha a fila; 🔊 Volume - Ajusta o volume "
                        },
                        {
                            role: "user",
                            content: pergunta
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.4
                },
                {
                    headers: {
                        Authorization: `Bearer ${client.config.openrouterKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://konbdemo.xyz/",
                        "X-Title": "Discord AI Assistant"
                    }
                }
            );

            if (!response.data?.choices?.[0]?.message?.content) {
                throw new Error("Invalid API response structure");
            }

            const resposta = response.data.choices[0].message.content;
            const cleanResponse = resposta
                .replace(/\\boxed{([^}]*)}/g, '$1')
                .replace(/^["']|["']$/g, '')
                .trim();

            // Check if response is too short or empty
            if (!cleanResponse || cleanResponse.length < 5) {
                client.warn(`[ASK] Response too short (${cleanResponse.length} chars): "${cleanResponse}"`);
                if (attempt === maxRetries) {
                    throw new Error("Failed to get a valid response after all retries");
                }
                attempt++;
                continue;
            }

            client.log(`[ASK] Got valid response of ${cleanResponse.length} chars on attempt ${attempt}`);
            return cleanResponse;
        } catch (error) {
            client.error(`[ASK] API request failed on attempt ${attempt}: ${error.message}`);
            if (attempt === maxRetries) {
                throw error;
            }
            attempt++;
        }
    }
}

const command = new SlashCommand()
    .setName("ask")
    .setDescription("Ask a question to the virtual assistant")
    .addStringOption((option) =>
        option
            .setName("question")
            .setDescription("The question you want to ask")
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("image")
            .setDescription("URL of an image to include in the response (optional)")
            .setRequired(false)
    )
    .setRun(async (client, interaction) => {
        try {
            await interaction.deferReply().catch((_) => {});

            if (!interaction || !interaction.options) {
                client.error("[ASK] Invalid interaction or options");
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle("❌ Error")
                            .setDescription("An error occurred while processing your question. Please try again.")
                    ]
                });
            }

            const pergunta = interaction.options.getString("question");
            const imagem = interaction.options.getString("image")

            if (!pergunta || typeof pergunta !== "string") {
                client.error(`[ASK] Invalid question from ${interaction.user.tag} (${interaction.user.id})`);
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle("❌ Invalid Question")
                            .setDescription("Please provide a valid question.")
                    ]
                });
            };

            client.log(`[ASK] User ${interaction.user.tag} (${interaction.user.id}) asked: ${pergunta}`);

            if (pergunta.length < 3) {
                client.warn(`[ASK] Question too short from ${interaction.user.tag} (${interaction.user.id})`);
                const embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle("❌ Question Too Short")
                    .setDescription("Please ask a more detailed question.");
                return interaction.editReply({ embeds: [embed] });
            }

            if (imagem && !(imagem.startsWith("http://") || imagem.startsWith("https://"))) {
                client.warn(`[ASK] Invalid image URL from ${interaction.user.tag} (${interaction.user.id})`);
                const embed = new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle("❌ Invalid URL")
                    .setDescription("The image URL must start with http:// or https://");
                return interaction.editReply({ embeds: [embed] });
            }

            client.log(`[ASK] Sending question to API using model ${client.config.model}`);

            // Get response with retry logic
            const cleanResponse = await makeApiRequest(client, pergunta);

            const embed = new EmbedBuilder()
                .setColor(client.config.embedColor)
                .setTitle(pergunta.slice(0, 256))
                .setDescription(cleanResponse)
                .setFooter({ text: "MINIONS BOT • Powered by AI" });

            if (imagem) {
                embed.setImage(imagem);
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            client.error(`[ASK] Error processing question from ${interaction.user.tag} (${interaction.user.id}): ${error.message}`);
            
            const embed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle("❌ Error")
                .setDescription("An error occurred while processing your question. Please try again later.");
            
            try {
                await interaction.editReply({ embeds: [embed] });
            } catch (e) {
                client.error(`[ASK] Error sending error message: ${e.message}`);
            }
        }
    });

module.exports = command; 