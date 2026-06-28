"use strict";

const { Router } = require("express");
const {
	Wallet,
	Bet,
	getOrCreateWallet,
	getUserBets,
	getAllPendingBets,
} = require("../../util/mongodb");

/** @param {{client:any,cfg:any,hub:any}} ctx */
module.exports = (ctx) => {
	const r = Router({ caseSensitive: true });
	const { client } = ctx;

	async function resolveUser(odId) {
		let u = client.users.cache.get(odId);
		if (!u) u = await client.users.fetch(odId).catch(() => null);
		return u
			? { tag: u.tag || u.username, avatar: u.displayAvatarURL({ size: 64 }) }
			: { tag: null, avatar: null };
	}

	// GET /v2/economy/leaderboard?limit=20 — ranking de bananas
	r.get("/leaderboard", async (req, res) => {
		const limit = Math.min(Number(req.query.limit) || 20, 100);
		try {
			const wallets = await Wallet.find().sort({ balance: -1 }).limit(limit).lean();
			const rows = await Promise.all(
				wallets.map(async (w, i) => {
					const u = await resolveUser(w.odId);
					const games = (w.winCount || 0) + (w.loseCount || 0);
					return {
						rank: i + 1,
						userId: w.odId,
						tag: u.tag,
						avatar: u.avatar,
						balance: w.balance || 0,
						totalWon: w.totalWon || 0,
						totalLost: w.totalLost || 0,
						winCount: w.winCount || 0,
						loseCount: w.loseCount || 0,
						totalBets: w.totalBets || 0,
						winRate: games ? Math.round(((w.winCount || 0) / games) * 100) : 0,
					};
				}),
			);
			res.json(rows);
		} catch (e) {
			res.status(500).json({ error: "falha no ranking: " + (e?.message || e) });
		}
	});

	// GET /v2/economy/stats — agregados da economia
	r.get("/stats", async (_req, res) => {
		try {
			const [users, circulating, pending, settled] = await Promise.all([
				Wallet.countDocuments(),
				Wallet.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]),
				Bet.countDocuments({ status: "pending" }),
				Bet.aggregate([
					{ $match: { status: { $in: ["won", "lost"] } } },
					{ $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$betAmount" } } },
				]),
			]);
			const settledMap = Object.fromEntries(settled.map((s) => [s._id, s]));
			res.json({
				users,
				circulating: circulating?.[0]?.total || 0,
				pendingBets: pending,
				wonBets: settledMap.won?.count || 0,
				lostBets: settledMap.lost?.count || 0,
				wageredWon: settledMap.won?.amount || 0,
				wageredLost: settledMap.lost?.amount || 0,
			});
		} catch (e) {
			res.status(500).json({ error: "falha nas stats: " + (e?.message || e) });
		}
	});

	// GET /v2/economy/users/:userId — carteira + apostas recentes
	r.get("/users/:userId", async (req, res) => {
		try {
			const wallet = await getOrCreateWallet(req.params.userId);
			const bets = await getUserBets(req.params.userId, 25);
			const u = await resolveUser(req.params.userId);
			res.json({
				userId: req.params.userId,
				tag: u.tag,
				avatar: u.avatar,
				wallet: {
					balance: wallet.balance || 0,
					totalWon: wallet.totalWon || 0,
					totalLost: wallet.totalLost || 0,
					totalBets: wallet.totalBets || 0,
					winCount: wallet.winCount || 0,
					loseCount: wallet.loseCount || 0,
					lastDaily: wallet.lastDaily || null,
				},
				bets: (bets || []).map((b) => ({
					id: String(b._id),
					match: `${b.homeTeam} x ${b.awayTeam}`,
					betType: b.betType,
					betAmount: b.betAmount,
					odds: b.odds,
					potentialWin: b.potentialWin,
					status: b.status,
					matchDate: b.matchDate,
					settledAt: b.settledAt || null,
				})),
			});
		} catch (e) {
			res.status(500).json({ error: "falha na carteira: " + (e?.message || e) });
		}
	});

	// GET /v2/economy/bets/pending — apostas pendentes (todas as guilds)
	r.get("/bets/pending", async (_req, res) => {
		try {
			const bets = await getAllPendingBets();
			const rows = await Promise.all(
				(bets || []).slice(0, 100).map(async (b) => {
					const u = await resolveUser(b.odId);
					return {
						id: String(b._id),
						userId: b.odId,
						tag: u.tag,
						avatar: u.avatar,
						match: `${b.homeTeam} x ${b.awayTeam}`,
						betType: b.betType,
						betAmount: b.betAmount,
						odds: b.odds,
						potentialWin: b.potentialWin,
						matchDate: b.matchDate,
					};
				}),
			);
			res.json(rows);
		} catch (e) {
			res.status(500).json({ error: "falha nas apostas: " + (e?.message || e) });
		}
	});

	return r;
};
