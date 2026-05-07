"use strict";

const { getHub, releaseHub } = require("../lib/ws-hub");

module.exports = function (RED) {
  function OpenccuLoomWsCallNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);
    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }
    const hub = getHub(server);
    hub.addRef();

    const offStatus = hub.onStatus((s) => {
      if (typeof s === "object" && s && s.error) {
        node.status({ fill: "red", shape: "ring", text: "ws err" });
        return;
      }
      if (s === "open") node.status({ fill: "green", shape: "dot", text: "ready" });
      else if (s === "connecting") node.status({ fill: "yellow", shape: "ring", text: "connecting..." });
      else node.status({ fill: "red", shape: "ring", text: String(s) });
    });

    node.on("input", async (msg, send, done) => {
      const command = msg.command || config.command;
      if (!command) return done(new Error("msg.command missing"));
      const args = msg.args || msg.payload || {};
      const timeoutMs = Number(msg.timeoutMs || config.timeoutMs || 15000);
      node.status({ fill: "yellow", shape: "ring", text: command });
      try {
        const result = await hub.call(command, args, timeoutMs);
        msg.payload = result;
        node.status({ fill: "green", shape: "dot", text: command });
        send(msg);
        done();
      } catch (err) {
        node.status({ fill: "red", shape: "ring", text: "error" });
        const wrapped = new Error(err.message || String(err));
        if (err.details) wrapped.details = err.details;
        done(wrapped);
      }
    });

    node.on("close", (done) => {
      offStatus();
      releaseHub(server);
      done();
    });
  }

  RED.nodes.registerType("openccu-loom-ws-call", OpenccuLoomWsCallNode);
};
