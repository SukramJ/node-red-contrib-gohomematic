"use strict";

const { createClient, describeError, mergeIdempotency } = require("../lib/client");

module.exports = function (RED) {
  function OpenccuLoomSetValueNode(config) {
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
      const channel = msg.channel != null ? msg.channel : config.channel;
      const param = msg.parameter || config.parameter;
      const value = msg.payload != null ? msg.payload : config.value;
      const priority = msg.priority || config.priority;

      if (!addr || channel == null || channel === "" || !param) {
        done(new Error("address, channel and parameter are required"));
        return;
      }

      const path = `/devices/${encodeURIComponent(addr)}/channels/${encodeURIComponent(
        channel
      )}/data-points/${encodeURIComponent(param)}/value`;
      const body = { value };
      if (priority) body.priority = priority;

      const headers = mergeIdempotency(undefined, msg, node);

      node.status({ fill: "yellow", shape: "ring", text: "writing..." });
      try {
        const res = await client.put(path, body, { headers });
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

  RED.nodes.registerType("openccu-loom-set-value", OpenccuLoomSetValueNode);
};
