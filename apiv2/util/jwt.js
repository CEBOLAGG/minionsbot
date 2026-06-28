"use strict";

/**
 * Mini JWT HS256 — sem dependências (usa só `crypto` nativo).
 * Usado para os "tickets" de WebSocket que a dashboard (Vercel) assina e o bot
 * verifica. Os dois lados compartilham o mesmo segredo (REALTIME_SECRET).
 *
 * Mantemos o algoritmo idêntico ao da Vercel (lib/realtime no dashboard usa
 * a Web Crypto, mas o payload/encoding é o mesmo) para que os tickets batam.
 */

const crypto = require("crypto");

function b64url(input) {
	return Buffer.from(input)
		.toString("base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
}

function b64urlJson(obj) {
	return b64url(JSON.stringify(obj));
}

function fromB64url(str) {
	str = str.replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	return Buffer.from(str, "base64");
}

/**
 * Assina um payload com HS256.
 * @param {object} payload
 * @param {string} secret
 * @param {number} [expiresInSec=120]
 * @returns {string}
 */
function sign(payload, secret, expiresInSec = 120) {
	const now = Math.floor(Date.now() / 1000);
	const body = { iat: now, exp: now + expiresInSec, ...payload };
	const header = { alg: "HS256", typ: "JWT" };
	const data = `${b64urlJson(header)}.${b64urlJson(body)}`;
	const sig = crypto.createHmac("sha256", secret).update(data).digest();
	return `${data}.${b64url(sig)}`;
}

/**
 * Verifica e decodifica um token HS256. Lança se inválido/expirado.
 * @param {string} token
 * @param {string} secret
 * @returns {object} payload
 */
function verify(token, secret) {
	if (!token || typeof token !== "string") throw new Error("missing token");
	const parts = token.split(".");
	if (parts.length !== 3) throw new Error("malformed token");
	const [h, p, s] = parts;
	const data = `${h}.${p}`;
	const expected = crypto.createHmac("sha256", secret).update(data).digest();
	const got = fromB64url(s);
	if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
		throw new Error("bad signature");
	}
	let payload;
	try {
		payload = JSON.parse(fromB64url(p).toString("utf8"));
	} catch {
		throw new Error("bad payload");
	}
	const now = Math.floor(Date.now() / 1000);
	if (typeof payload.exp === "number" && now > payload.exp) {
		throw new Error("token expired");
	}
	return payload;
}

module.exports = { sign, verify };
