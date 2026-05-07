# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-05-27

### Changed (breaking)
- **Renamed package** from `node-red-contrib-gohomematic` to
  `node-red-contrib-openccu-loom`. All node types now use the
  `openccu-loom-*` prefix; the palette category is `openccu-loom`.
  Existing flows must be re-pointed.
- **Default REST port** changed from 8081 to **8080** (openccu-loom binds
  REST + WebSocket on `:8080` and the bootstrap UI on `:8081`).
- **Session cookie names** updated to `openccu_loom_session` /
  `openccu_loom_csrf` to match the daemon (`internal/auth/session.go`,
  `internal/auth/csrf.go`). Without this fix, Session-Cookie auth fails
  silently against the current daemon.
- Admin-endpoint moved to `/openccu-loom/test-connection`.

### Added
- `Idempotency-Key` header support: `set value`, `paramset`,
  `device admin batch` and `api` accept `msg.idempotencyKey`; daemon-side
  replays set `msg.idempotentReplay = true`.
- WebSocket **resume**: events node tracks the last `seq` and asks for
  `since:N` on reconnect. `replay_done`/`replay_lost` control frames are
  surfaced as `msg.control` so flows can pull a fresh `GET /snapshot`.
- WebSocket **reauth**: events node accepts `msg.op = "reauth"` with
  `msg.token`.
- WebSocket **kind discriminator** (`initial|change|refresh`) is exposed
  as `msg.kind`.
- New node **`ws call`** (`openccu-loom-ws-call`): generic
  `{op:"call", command, args}` RPC over the shared WS connection, with
  per-call timeout and result correlation.
- New REST nodes:
  - `paramset` — `GET/PUT /devices/{addr}/paramsets/{VALUES|MASTER|LINK}`
  - `messages` — list / ack alarm + service messages
  - `interfaces` — list / get / reconnect interfaces
  - `snapshot` — `GET /snapshot`
  - `health` — `/info`, `/health`, `/config`, `/config/effective`,
    `/config/schema`
  - `centrals` — multi-CCU registry CRUD
  - `device admin` — batch write, refresh, accept, firmware update, delete
- `sysvar` node gained `create`, `patch` and `delete` modes.
- `program` node gained `get` (details) in addition to `execute` / `list`.
- Fourth example flow `04-ws-call.json` demonstrating WS-RPC.

### Removed
- All `gohomematic-*` node-type identifiers, file names and locale keys.

## [0.1.0] - 2026-05-07

### Added
- Initial release.
- Config node `gohomematic-server` with HTTP Basic, Bearer Token, and
  Session cookie + CSRF authentication, optional TLS.
- Admin endpoint `POST /gohomematic/test-connection` and a Test button
  in the editor.
- Input node `gohomematic-events`: WebSocket subscriber for
  `/api/v1/events` with topic filter, exponential-backoff reconnect, and
  halt-on-auth-failure during the handshake.
- Command nodes:
  - `gohomematic-set-value` (write a data point)
  - `gohomematic-sysvar` (read / write / list system variables)
  - `gohomematic-program` (execute / list CCU programs)
  - `gohomematic-device` (read devices / channels / data points)
  - `gohomematic-install-mode` (control pairing mode)
  - `gohomematic-api` (generic REST call)
- i18n resources for `en-US` and `de`.
- Example flows under `examples/`.
- Smoke tests with `node-red-node-test-helper` plus HTTP-client
  integration tests against an in-process server.

[0.2.0]: https://github.com/SukramJ/node-red-contrib-openccu-loom/releases/tag/v0.2.0
[0.1.0]: https://github.com/SukramJ/node-red-contrib-openccu-loom/releases/tag/v0.1.0
