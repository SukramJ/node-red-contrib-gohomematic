"use strict";

const { createClient, describeError, mergeIdempotency } = require("../lib/client");

const KEYS = new Set(["VALUES", "MASTER", "LINK"]);

module.exports = function (RED) {
  function OpenccuLoomParamsetNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);
    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }
    node.idempotencyKey = config.idempotencyKey || "";
    const client = createClient(server);

    node.on("input", async (msg, send, done) => {
      const addr = msg.address || config.address;
      const key = String(msg.key || config.key || "VALUES").toUpperCase();
      const mode = msg.mode || config.mode || "read";
      if (!addr) return done(new Error("address missing"));
      if (!KEYS.has(key)) return done(new Error(`paramset key must be VALUES|MASTER|LINK`));

      const path = `/devices/${encodeURIComponent(addr)}/paramsets/${encodeURIComponent(key)}`;
      node.status({ fill: "yellow", shape: "ring", text: `${mode} ${key}` });
      try {
        let res;
        if (mode === "read") {
          res = await client.get(path);
        } else if (mode === "write") {
          if (typeof msg.payload !== "object" || msg.payload === null) {
            return done(new Error("msg.payload must be an object with paramset values"));
          }
          const headers = mergeIdempotency(undefined, msg, node);
          res = await client.put(path, msg.payload, { headers });
        } else {
          return done(new Error(`unknown mode: ${mode}`));
        }
        msg.payload = res.data ?? { status: res.status };
        msg.statusCode = res.status;
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

  RED.nodes.registerType("openccu-loom-paramset", OpenccuLoomParamsetNode);
};
