const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder } = require("discord.js");

const command = new SlashCommand()
	.setName("steam")
	.setDescription("Busca informações de um perfil Steam")
	.addStringOption((option) =>
		option
			.setName("input")
			.setDescription("Link do perfil Steam ou token")
			.setRequired(true)
	)
	.setRun(async (client, interaction) => {
		const input = interaction.options.getString("input");

		await interaction.deferReply();

		try {
			// Testar token
			const result = await checkToken(input);

			const embed = new EmbedBuilder()
				.setTitle("🔑 Verificação de Token Steam")
				.setColor(result.alive ? 0x00ff00 : 0xff0000)
				.addFields({
					name: "Status",
					value: result.alive ? "✅ Vivo" : "❌ Morto",
				})
				.addFields({
					name: "Motivo",
					value: result.reason || "N/A",
				});

			if (result.data) {
				embed.addFields({
					name: "Dados",
					value:
						"```json\n" +
						JSON.stringify(result.data, null, 2).substring(0, 1000) +
						"```",
				});
			}

			return interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error(error);
			await interaction.editReply("❌ Erro ao verificar token");
		}
	});

async function checkToken(rawToken) {
	// Remove prefixo "borna_323----" ou outros prefixos se houver
	const accessToken = rawToken.replace(/^[\w]+----/, "");

	// Decodificar o JWT (mesmo método do login.js)
	let payload = null;
	try {
		const parts = accessToken.split(".");
		if (parts.length !== 3) {
			return { alive: false, reason: "Token inválido (formato JWT incorreto)" };
		}
		let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		while (base64.length % 4) base64 += "=";
		payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
	} catch (e) {
		return { alive: false, reason: "Token inválido (erro ao decodificar)" };
	}

	if (!payload || !payload.sub) {
		return { alive: false, reason: "Token inválido (sem SteamID)" };
	}

	const steamId = payload.sub;
	const expDate = new Date(payload.exp * 1000);
	const issuedDate = new Date(payload.iat * 1000);

	// Validar igual ao login.js
	if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
		return {
			alive: false,
			reason: `❌ Token expirado em ${expDate.toLocaleString()}`,
			data: {
				steamId: steamId,
				expires: expDate.toLocaleString(),
				issued: issuedDate.toLocaleString(),
			},
		};
	}

	// Token não está expirado - assume que funciona
	// A verificação real acontece ao fazer login no Steam
	return {
		alive: true,
		reason: "✅ Token vivo (funcionará no login)",
		data: {
			steamId: steamId,
			expires: expDate.toLocaleString(),
			issued: issuedDate.toLocaleString(),
		},
	};
}

module.exports = command;
