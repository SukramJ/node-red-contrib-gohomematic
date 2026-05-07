"use strict";

const { createClient, describeError, mergeIdempotency } = require("../lib/client");

module.exports = function (RED) {
  function OpenccuLoomDeviceAdminNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);
    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }
    const client = createClient(server);

    node.on("input", async (msg, send, done) => {
      const action = msg.action || config.action || "refresh";
      const addr = msg.address || config.address;

      node.status({ fill: "yellow", shape: "ring", text: action });
      try {
        let res;
        switch (action) {
          case "batch":
            if (!Array.isArray(msg.payload)) {
              return done(new Error("msg.payload must be an array of {address, channel, parameter, value, priority?}"));
            }
            res = await client.post("/devices/values:batch", { values: msg.payload }, {
              headers: mergeIdempotency(undefined, msg),
            });
            break;
          case "refresh":
            res = await client.post("/devices/refresh");
            break;
          case "accept":
            if (!addr) return done(new Error("address missing"));
            res = await client.post(`/devices/${encodeURIComponent(addr)}/accept`);
            break;
          case "firmware":
            if (!addr) return done(new Error("address missing"));
            res = await client.post(`/devices/${encodeURIComponent(addr)}/firmware/update`);
            break;
          case "delete":
            if (!addr) return done(new Error("address missing"));
            res = await client.delete(`/devices/${encodeURIComponent(addr)}`);
            break;
          default:
            return done(new Error(`unknown action: ${action}`));
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

  RED.nodes.registerType("openccu-loom-device-admin", OpenccuLoomDeviceAdminNode);
};
