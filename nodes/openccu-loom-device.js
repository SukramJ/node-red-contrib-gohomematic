"use strict";

const { createClient, describeError } = require("../lib/client");

module.exports = function (RED) {
  function OpenccuLoomDeviceNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);
    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }
    const client = createClient(server);

    function buildPath(scope, addr, channel, param) {
      switch (scope) {
        case "list":
          return "/devices";
        case "device":
          return `/devices/${encodeURIComponent(addr)}`;
        case "channels":
          return `/devices/${encodeURIComponent(addr)}/channels`;
        case "channel":
          return `/devices/${encodeURIComponent(addr)}/channels/${encodeURIComponent(channel)}`;
        case "data-points":
          return `/devices/${encodeURIComponent(addr)}/channels/${encodeURIComponent(channel)}/data-points`;
        case "data-point":
          return `/devices/${encodeURIComponent(addr)}/channels/${encodeURIComponent(channel)}/data-points/${encodeURIComponent(param)}`;
        default:
          throw new Error(`unknown scope: ${scope}`);
      }
    }

    node.on("input", async (msg, send, done) => {
      const scope = msg.scope || config.scope || "device";
      const addr = msg.address || config.address;
      const channel = msg.channel != null ? msg.channel : config.channel;
      const param = msg.parameter || config.parameter;

      const needsAddr = scope !== "list";
      const needsChannel = ["channel", "data-points", "data-point"].includes(scope);
      const needsParam = scope === "data-point";

      if (needsAddr && !addr) return done(new Error("address missing"));
      if (needsChannel && (channel == null || channel === "")) return done(new Error("channel missing"));
      if (needsParam && !param) return done(new Error("parameter missing"));

      let path;
      try {
        path = buildPath(scope, addr, channel, param);
      } catch (err) {
        return done(err);
      }

      node.status({ fill: "yellow", shape: "ring", text: scope });
      try {
        const res = await client.get(path);
        msg.payload = res.data;
        msg.statusCode = res.status;
        node.status({ fill: "green", shape: "dot", text: `OK (${res.status})` });
        send(msg);
        done();
      } catch (err) {
        node.status({ fill: "red", shape: "ring", text: "error" });
        done(new Error(describeError(err)));
      }
    });
  }

  RED.nodes.registerType("openccu-loom-device", OpenccuLoomDeviceNode);
};
