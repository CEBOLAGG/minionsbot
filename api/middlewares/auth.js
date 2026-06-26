/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 * @returns {Promise<void>}
 */

const Auth = (req, res, next) => {
	if (!req.user) {
		// Return JSON for API requests, redirect for page requests
		if (req.path.startsWith("/api/") || req.xhr || req.headers.accept?.includes("application/json")) {
			return res.status(401).json({ error: "Not authenticated" });
		}
		return res.redirect("/login");
	} else {
		next();
	}
};

module.exports = Auth;
