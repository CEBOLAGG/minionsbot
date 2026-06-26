const { Router } = require("express");
const api = Router();
const Auth = require("../middlewares/auth");

api.get("/", Auth, (req, res) => {
	const profile = req.user?.profile;
	if (!profile) {
		return res.status(401).json({ error: "Not authenticated" });
	}
	res.json({
		id: profile.id,
		username: profile.username,
		avatar: profile.avatar,
		discriminator: profile.discriminator || "0",
	});
});

module.exports = api;
