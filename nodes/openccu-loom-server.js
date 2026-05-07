"use strict";

const { createClient, describeError } = require("../lib/client");

module.exports = function (RED) {
  function OpenccuLoomServerNode(config) {
    RED.nodes.createNode(this, config);
    this.host = config.host || "127.0.0.1";
    this.port = parseInt(config.port, 10) || 8080;
    this.tls = !!config.tls;
    this.insecureTLS = !!config.insecureTLS;
    this.authMethod = config.authMethod || "basic";
    this.timeout = parseInt(config.timeout, 10) || 10000;
  }

  RED.nodes.registerType("openccu-loom-server", OpenccuLoomServerNode, {
    credentials: {
      username: { type: "text" },
      password: { type: "password" },
      token: { type: "password" },
    },
  });

  RED.httpAdmin.post(
    "/openccu-loom/test-connection",
    RED.auth.needsPermission("openccu-loom.write"),
    async (req, res) => {
      const body = req.body || {};
      const id = body.id;
      const probe = {
        host: body.host || "127.0.0.1",
        port: parseInt(body.port, 10) || 8080,
        tls: !!body.tls,
        insecureTLS: !!body.insecureTLS,
        authMethod: body.authMethod || "basic",
        timeout: parseInt(body.timeout, 10) || 10000,
        credentials: {
          username: body.username || "",
          password: body.password || "",
          token: body.token || "",
        },
      };
      if (id) {
        const existing = RED.nodes.getCredentials(id) || {};
        if (!probe.credentials.username) probe.credentials.username = existing.username || "";
        if (!probe.credentials.password) probe.credentials.password = existing.password || "";
        if (!probe.credentials.token) probe.credentials.token = existing.token || "";
      }
      try {
        const client = createClient(probe);
        const r = await client.get("/info");
        res.json({ ok: true, status: r.status, info: r.data });
      } catch (err) {
        res.status(200).json({ ok: false, error: describeError(err) });
      }
    }
  );
};
