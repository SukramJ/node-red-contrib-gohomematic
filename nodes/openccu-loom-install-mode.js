"use strict";

const { createClient, describeError } = require("../lib/client");

module.exports = function (RED) {
  function OpenccuLoomInstallModeNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);
    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }
    const client = createClient(server);

    node.on("input", async (msg, send, done) => {
      const action = msg.action || config.action || "status";
      const seconds =
        msg.seconds != null ? Number(msg.seconds) : Number(config.seconds || 60);

      node.status({ fill: "yellow", shape: "ring", text: action });
      try {
        let res;
        if (action === "status") {
          res = await client.get("/install-mode");
        } else if (action === "start") {
          res = await client.post("/install-mode", {
            active: true,
            seconds: seconds > 0 ? seconds : 60,
          });
        } else if (action === "stop") {
          res = await client.post("/install-mode", { active: false });
        } else {
          done(new Error(`unknown action: ${action}`));
          return;
        }
        msg.payload = res.data ?? { status: res.status };
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

  RED.nodes.registerType("openccu-loom-install-mode", OpenccuLoomInstallModeNode);
};
