# node-red-contrib-openccu-loom

Node-RED nodes for the [openccu-loom](https://github.com/SukramJ/openccu-loom)
daemon — the bridge to Homematic / HomematicIP CCUs (CCU2, CCU3, RaspberryMatic)
via the daemon's REST API (`/api/v1`) and its bidirectional WebSocket
(`/api/v1/events`).

> Compatible with **Node-RED ≥ 4.1.9** and **Node.js ≥ 18.5**.

## Installation

In your Node-RED user directory (typically `~/.node-red`):

```sh
npm install node-red-contrib-openccu-loom
```

Restart Node-RED. The nodes appear under the **openccu-loom** palette category.

## Configuration

All nodes reference an `openccu-loom-server` config node:

| Field | Meaning |
|---|---|
| Host | Hostname / IP of the openccu-loom daemon |
| Port | Defaults to 8080 (REST + WebSocket). Adjust for TLS. |
| TLS | Use HTTPS + WSS instead of HTTP + WS |
| Skip certificate check | Accept self-signed certificates (test setups only) |
| Auth | `HTTP Basic`, `Bearer Token`, `Session cookie + CSRF`, or `None` |
| User / Password | For HTTP Basic and Session auth |
| Token | For Bearer (issued via `POST /auth/tokens` or `/auth/tokens/v2`; OIDC tokens can be passed through) |
| Timeout | Request timeout in ms (default 10000) |

The dialog includes a **Test connection** button that performs a `GET /info`
against the entered host.

> The daemon binds REST + WebSocket on `:8080` and the bootstrap UI on `:8081`
> by default; this contrib talks to `:8080`. If you reverse-proxy through TLS,
> set the port accordingly.

### OIDC

OIDC requires a browser-driven login flow that is not practical from a
headless backend. The recommended pattern is:

1. Log in to openccu-loom via OIDC interactively (browser).
2. Issue a long-lived API token at `POST /auth/tokens` (admin role required).
3. Use that token in the **Bearer Token** auth field.

## Nodes

### `events` (input, WebSocket)

Subscribes to the bidirectional WebSocket event stream. Every received frame
becomes `msg.payload`; `msg.topic`, `msg.eventType`, `msg.kind`
(`initial|change|refresh`) and `msg.seq` are populated from the envelope.

* Topic filter: comma-separated patterns, e.g. `device.*,hub.*,central.*,matter.*`.
* Live changes via `msg.op = "subscribe"|"unsubscribe"` and `msg.topics`.
* `msg.op = "reauth"` with `msg.token` rotates the bearer credential on the open connection.
* **Resume**: the node tracks the last seen `seq` and asks the daemon to replay
  buffered events on reconnect. If the buffer ceiling (1024 frames) is exceeded
  the daemon answers with `replay_lost`; the node emits a control message
  `{control: "replay_lost", oldest_seq: M}` — pipe it into the `snapshot` node to resync.
* Reconnects with exponential backoff (1 s … 30 s); on HTTP 401/403 during the
  handshake the loop is halted.

### `ws call` (WebSocket RPC)

Dispatches a WebSocket command (`assets/wsapi.json`, currently 95 commands) over
the shared connection of the configured server. The frame is
`{op:"call", id:<auto>, command, args}` and the matching `result` is correlated
by id. Common targets: `ccu.get_signal_quality`, `paramset.form_schema`,
`config.session.open/save/discard/undo/redo`, `backup.trigger`,
`matter.commissioning_window_opened`.

### `set value`

Writes a data-point value. `PUT /devices/{addr}/channels/{no}/data-points/{param}/value`.

`msg.payload` carries the value. Address, channel, parameter, priority and
`Idempotency-Key` are configurable on the node or per message
(`msg.address`, `msg.channel`, `msg.parameter`, `msg.priority`, `msg.idempotencyKey`).
The daemon caches the response for 5 minutes when a key is supplied; replays
set `msg.idempotentReplay = true`.

### `paramset`

Reads or writes a paramset atomically. `GET/PUT /devices/{addr}/paramsets/{VALUES|MASTER|LINK}`.
Honours `msg.idempotencyKey`.

### `sysvar`

Read, write, list, create, patch (metadata) or delete CCU system variables.
`GET/PUT/POST/PATCH/DELETE /sysvars[/{name}]`.

### `program`

Execute, fetch details or list CCU programs.

### `device`

Reads device, channel, and data-point information. Scope choices:
`list`, `device`, `channels`, `channel`, `data-points`, `data-point`.

### `device admin`

Administrative device operations: batch write, registry refresh, accept inbox
device, firmware update, delete.

### `install mode`

Activate / deactivate / query the CCU install (pairing) mode.

### `interfaces`

List, get or reconnect southbound interfaces.

### `messages`

List or acknowledge alarm / service messages.

### `snapshot`

`GET /snapshot` — full daemon state (devices, programs, sysvars …). Use this
after a `replay_lost` control frame from the events node.

### `health`

Diagnostics: `/info`, `/health`, `/config`, `/config/effective`, `/config/schema`.

### `centrals`

Multi-CCU registry CRUD (`/centrals`, `/centrals/{name}`). Mutating calls
require admin role.

### `api`

Generic REST call against the openccu-loom API. Path is relative to
`/api/v1`. Honours `msg.method`, `msg.path`, `msg.payload`, `msg.query`,
`msg.headers`, `msg.idempotencyKey`.

## Examples

Four importable example flows ship under `examples/`:

- `01-event-stream.json` — subscribe to the event stream, auto-resync on `replay_lost`.
- `02-set-value.json` — periodically write a thermostat set point with Idempotency-Key.
- `03-sysvar-and-program.json` — set a sysvar, then trigger a program.
- `04-ws-call.json` — dispatch a WS-RPC (`ccu.get_signal_quality`).

## Localisation

UI strings and inline labels ship in `en-US` and `de`. Inline help texts are
English; the editor picks the matching label set automatically.

## Development

```sh
npm install
npm test            # mocha smoke tests + HTTP-client integration tests
```

To try the package against a local Node-RED:

```sh
npm link
cd ~/.node-red
npm link node-red-contrib-openccu-loom
```

## Licence

MIT — see [LICENSE](./LICENSE).
