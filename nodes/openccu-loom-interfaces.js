"use strict";

const { createClient, describeError } = require("../lib/client");

module.exports = function (RED) {
  function OpenccuLoomInterfacesNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);
    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }
    const client = createClient(server);

    node.on("input", async (msg, send, done) => {
      const action = msg.action || config.action || "list";
      const id = msg.id || config.id;

      node.status({ fill: "yellow", shape: "ring", text: action });
      try {
        let res;
        if (action === "list") {
          res = await client.get("/interfaces");
        } else if (action === "get") {
          if (!id) return done(new Error("msg.id missing"));
          res = await client.get(`/interfaces/${encodeURIComponent(id)}`);
        } else if (action === "reconnect") {
          if (!id) return done(new Error("msg.id missing"));
          res = await client.post(`/interfaces/${encodeURIComponent(id)}/reconnect`);
        } else {
          return done(new Error(`unknown action: ${action}`));
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

  RED.nodes.registerType("openccu-loom-interfaces", OpenccuLoomInterfacesNode);
};
