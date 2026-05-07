"use strict";

const helper = require("node-red-node-test-helper");
const assert = require("assert");

const serverNode = require("../nodes/openccu-loom-server.js");
const eventsNode = require("../nodes/openccu-loom-events.js");
const setValueNode = require("../nodes/openccu-loom-set-value.js");
const sysvarNode = require("../nodes/openccu-loom-sysvar.js");
const programNode = require("../nodes/openccu-loom-program.js");
const deviceNode = require("../nodes/openccu-loom-device.js");
const deviceAdminNode = require("../nodes/openccu-loom-device-admin.js");
const installModeNode = require("../nodes/openccu-loom-install-mode.js");
const paramsetNode = require("../nodes/openccu-loom-paramset.js");
const messagesNode = require("../nodes/openccu-loom-messages.js");
const interfacesNode = require("../nodes/openccu-loom-interfaces.js");
const snapshotNode = require("../nodes/openccu-loom-snapshot.js");
const healthNode = require("../nodes/openccu-loom-health.js");
const centralsNode = require("../nodes/openccu-loom-centrals.js");
const wsCallNode = require("../nodes/openccu-loom-ws-call.js");
const apiNode = require("../nodes/openccu-loom-api.js");

helper.init(require.resolve("node-red"));

describe("contrib loads", function () {
  beforeEach(function (done) {
    helper.startServer(done);
  });

  afterEach(function (done) {
    helper.unload().then(() => helper.stopServer(done));
  });

  it("registers openccu-loom-server with port 8080 default", function (done) {
    const flow = [
      {
        id: "s1",
        type: "openccu-loom-server",
        name: "test",
        host: "127.0.0.1",
        port: 8080,
        tls: false,
        authMethod: "basic",
        timeout: 1000,
      },
    ];
    helper.load(serverNode, flow, function () {
      try {
        const n = helper.getNode("s1");
        assert.ok(n);
        assert.strictEqual(n.host, "127.0.0.1");
        assert.strictEqual(n.port, 8080);
        assert.strictEqual(n.authMethod, "basic");
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  function loadCommandNode(nodeModule, type, extra, cb) {
    const flow = [
      {
        id: "s1",
        type: "openccu-loom-server",
        name: "test",
        host: "127.0.0.1",
        port: 8080,
        tls: false,
        authMethod: "basic",
        timeout: 1000,
      },
      Object.assign({ id: "n1", type, server: "s1", wires: [[]] }, extra || {}),
    ];
    helper.load([serverNode, nodeModule], flow, function () {
      try {
        const n = helper.getNode("n1");
        assert.ok(n, `${type} failed to register`);
        cb();
      } catch (e) {
        cb(e);
      }
    });
  }

  const cases = [
    [setValueNode, "openccu-loom-set-value", {}],
    [sysvarNode, "openccu-loom-sysvar", { mode: "read" }],
    [programNode, "openccu-loom-program", { mode: "list" }],
    [deviceNode, "openccu-loom-device", { scope: "list" }],
    [deviceAdminNode, "openccu-loom-device-admin", { action: "refresh" }],
    [installModeNode, "openccu-loom-install-mode", { action: "status" }],
    [paramsetNode, "openccu-loom-paramset", { mode: "read", key: "VALUES" }],
    [messagesNode, "openccu-loom-messages", { kind: "alarm", action: "list" }],
    [interfacesNode, "openccu-loom-interfaces", { action: "list" }],
    [snapshotNode, "openccu-loom-snapshot", {}],
    [healthNode, "openccu-loom-health", { scope: "health" }],
    [centralsNode, "openccu-loom-centrals", { action: "list" }],
    [apiNode, "openccu-loom-api", { method: "GET", path: "/info" }],
  ];

  for (const [mod, type, extra] of cases) {
    it(`registers ${type}`, function (done) {
      loadCommandNode(mod, type, extra, done);
    });
  }

  it("registers openccu-loom-events", function (done) {
    loadCommandNode(eventsNode, "openccu-loom-events", { topics: "" }, done);
  });

  it("registers openccu-loom-ws-call", function (done) {
    loadCommandNode(wsCallNode, "openccu-loom-ws-call", { command: "" }, done);
  });
});
