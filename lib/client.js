"use strict";

const axios = require("axios");
const https = require("https");

const SESSION_COOKIE = "openccu_loom_session";
const CSRF_COOKIE = "openccu_loom_csrf";
const CSRF_HEADER = "X-CSRF-Token";
const IDEMPOTENCY_HEADER = "Idempotency-Key";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildBaseURL(server) {
  const scheme = server.tls ? "https" : "http";
  const port = server.port || (server.tls ? 443 : 8080);
  return `${scheme}://${server.host}:${port}/api/v1`;
}

function buildWSURL(server) {
  const scheme = server.tls ? "wss" : "ws";
  const port = server.port || (server.tls ? 443 : 8080);
  return `${scheme}://${server.host}:${port}/api/v1/events`;
}

function basicAuthHeader(creds) {
  if (!creds || !creds.username) return null;
  const raw = `${creds.username}:${creds.password || ""}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

function bearerAuthHeader(creds) {
  if (!creds || !creds.token) return null;
  return `Bearer ${creds.token}`;
}

function buildAuthHeader(server) {
  const auth = (server.authMethod || "basic").toLowerCase();
  const creds = server.credentials || {};
  if (auth === "bearer") {
    const h = bearerAuthHeader(creds);
    return h ? { Authorization: h } : {};
  }
  if (auth === "basic") {
    const h = basicAuthHeader(creds);
    return h ? { Authorization: h } : {};
  }
  return {};
}

function parseSetCookie(headers) {
  const raw = headers && (headers["set-cookie"] || headers["Set-Cookie"]);
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((line) => {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) return null;
      return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
    })
    .filter(Boolean);
}

class OpenccuLoomClient {
  constructor(server) {
    this.server = server;
    this.cookies = new Map();
    const httpsAgent =
      server.tls && server.insecureTLS
        ? new https.Agent({ rejectUnauthorized: false })
        : undefined;
    this.axios = axios.create({
      baseURL: buildBaseURL(server),
      timeout: server.timeout || 10000,
      httpsAgent,
      validateStatus: (s) => s >= 200 && s < 300,
    });
  }

  cookieHeader() {
    const parts = [];
    for (const [name, value] of this.cookies) parts.push(`${name}=${value}`);
    return parts.join("; ");
  }

  storeCookies(headers) {
    for (const c of parseSetCookie(headers)) {
      if (c.value === "" || c.value === "deleted") this.cookies.delete(c.name);
      else this.cookies.set(c.name, c.value);
    }
  }

  buildHeaders(method, extra) {
    const h = { Accept: "application/json", "Content-Type": "application/json" };
    const auth = (this.server.authMethod || "basic").toLowerCase();
    if (auth === "basic" || auth === "bearer") {
      Object.assign(h, buildAuthHeader(this.server));
    } else if (auth === "session") {
      const cookie = this.cookieHeader();
      if (cookie) h.Cookie = cookie;
      if (MUTATING.has(method.toUpperCase())) {
        const csrf = this.cookies.get(CSRF_COOKIE);
        if (csrf) h[CSRF_HEADER] = csrf;
      }
    }
    return Object.assign(h, extra || {});
  }

  async login() {
    const creds = this.server.credentials || {};
    if (!creds.username) throw new Error("session auth: no username configured");
    const res = await this.axios.post(
      "/auth/login",
      { username: creds.username, password: creds.password || "" },
      { headers: { "Content-Type": "application/json", Accept: "application/json" } }
    );
    this.storeCookies(res.headers);
    if (!this.cookies.has(SESSION_COOKIE)) {
      throw new Error("session auth: no session cookie in /auth/login response");
    }
    return res.data;
  }

  async ensureSession() {
    if ((this.server.authMethod || "basic").toLowerCase() !== "session") return;
    if (!this.cookies.has(SESSION_COOKIE)) await this.login();
  }

  async request(cfg) {
    await this.ensureSession();
    const method = (cfg.method || "GET").toUpperCase();
    const headers = this.buildHeaders(method, cfg.headers);
    const exec = () => this.axios.request({ ...cfg, method, headers });
    try {
      const res = await exec();
      this.storeCookies(res.headers);
      return res;
    } catch (err) {
      const status = err.response && err.response.status;
      const isSession = (this.server.authMethod || "basic").toLowerCase() === "session";
      if (isSession && (status === 401 || status === 403)) {
        this.cookies.clear();
        await this.login();
        const headers2 = this.buildHeaders(method, cfg.headers);
        const res = await this.axios.request({ ...cfg, method, headers: headers2 });
        this.storeCookies(res.headers);
        return res;
      }
      throw err;
    }
  }

  get(url, opts) {
    return this.request({ ...(opts || {}), method: "GET", url });
  }
  post(url, data, opts) {
    return this.request({ ...(opts || {}), method: "POST", url, data });
  }
  put(url, data, opts) {
    return this.request({ ...(opts || {}), method: "PUT", url, data });
  }
  patch(url, data, opts) {
    return this.request({ ...(opts || {}), method: "PATCH", url, data });
  }
  delete(url, opts) {
    return this.request({ ...(opts || {}), method: "DELETE", url });
  }
}

function createClient(server) {
  return new OpenccuLoomClient(server);
}

function describeError(err) {
  if (err.response) {
    const body = err.response.data;
    const detail =
      typeof body === "object" && body
        ? body.detail || body.title || JSON.stringify(body)
        : String(body || "");
    return `HTTP ${err.response.status} ${err.response.statusText}${detail ? ": " + detail : ""}`;
  }
  return err.message || String(err);
}

function mergeIdempotency(headers, msg, node) {
  const key = (msg && msg.idempotencyKey) || (node && node.idempotencyKey);
  if (!key) return headers;
  return Object.assign({}, headers || {}, { [IDEMPOTENCY_HEADER]: String(key) });
}

module.exports = {
  OpenccuLoomClient,
  createClient,
  buildWSURL,
  buildAuthHeader,
  describeError,
  mergeIdempotency,
  CSRF_HEADER,
  CSRF_COOKIE,
  SESSION_COOKIE,
  IDEMPOTENCY_HEADER,
};
