"use strict";

const { createClient, describeError, mergeIdempotency } = require("../lib/client");

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

module.exports = function (RED) {
  function OpenccuLoomApiNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);
    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }
    const client = createClient(server);

    node.on("input", async (msg, send, done) => {
      const method = String(msg.method || config.method || "GET").toUpperCase();
      let path = msg.path || config.path;
      if (!path) return done(new Error("path missing"));
      if (!ALLOWED_METHODS.has(method)) return done(new Error(`method not allowed: ${method}`));
      if (!path.startsWith("/")) path = "/" + path;

      node.status({ fill: "yellow", shape: "ring", text: `${method} ${path}` });
      try {
        const headers = mergeIdempotency(msg.headers, msg);
        const res = await client.request({
          method,
          url: path,
          data: msg.payload,
          params: msg.query,
          headers,
        });
        msg.payload = res.data;
        msg.statusCode = res.status;
        msg.headers = res.headers;
        if (res.headers && res.headers["idempotent-replay"]) msg.idempotentReplay = true;
        node.status({ fill: "green", shape: "dot", text: `OK (${res.status})` });
        send(msg);
        done();
      } catch (err) {
        node.status({ fill: "red", shape: "ring", text: "error" });
        done(new Error(describeError(err)));
      }
    });
  }

  RED.nodes.registerType("openccu-loom-api", OpenccuLoomApiNode);
};
