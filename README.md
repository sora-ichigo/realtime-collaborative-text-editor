# Realtime Collaborative Text Editor

A web-based plain-text editor with real-time collaborative editing. Documents
live in per-user **filesystems** on a backend server and stay in sync using
[Yjs](https://yjs.dev/) CRDTs, so concurrent edits merge without losing
characters. The same client also runs as a macOS desktop app via Electron.

## Features

- 📝 **Plain-text editing** — edit text, import/export `.txt` files (the export
  overwrites the opened file via the File System Access API)
- 🗂️ **Per-user filesystems** — each browser gets a persistent `userId`; a
  document is identified by `(owner, filename)`
- 🙋 **Display names + picker** — set an editable name; pick any filesystem from
  a dropdown of known users by name (no UUID typing)
- 👥 **Open shared files** — editing the same `(owner, filename)` syncs in real
  time; different files don't. Any user can open another user's filesystem.
- 📦 **1 MB quota per filesystem** — the server rejects edits beyond the limit;
  a usage bar shows how full each filesystem is
- 🔵 **Unsaved-changes indicator** for local import/export
- 🔄 **Real-time sync** with three switchable transports: **WebSocket**, **SSE**,
  and **HTTP polling**
- 🧩 **CRDT merging (Yjs)** — concurrent edits converge with no lost edits
- 🗄️ **Server persistence** — every file is saved to disk and restored on restart
- 🖥️ **macOS desktop app** (Electron)

## How sync works

The server keeps one authoritative `Y.Doc` **per `(owner, filename)` room**.
Each edit is encoded as a Yjs binary update, sent to the server, applied to that
room's document, and relayed to every other client in the same room — regardless
of transport. So a WebSocket client and a polling client editing the same file
stay in sync, while different files never mix.

| Transport     | Down (server → client) | Up (client → server) | Latency        |
| ------------- | ---------------------- | -------------------- | -------------- |
| **WebSocket** | live push over `/ws`   | live push over `/ws` | lowest         |
| **SSE**       | `GET /api/events`      | `POST /api/update`   | low            |
| **Polling**   | `GET /api/state?sv=…`  | `POST /api/update`   | ~1s (interval) |

You switch transports per client with the buttons in the toolbar. Each request
carries `owner` and `file` query params to select the room.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite
- **CRDT:** Yjs
- **Server:** Hono + `@hono/node-ws` (Node.js)
- **Desktop:** Electron
- **Tests:** Vitest + Testing Library

## Getting started

### Prerequisites

- Node.js 22+
- npm

### Install

```bash
npm install
```

### Run (web)

Start the client and the sync server together:

```bash
npm run dev
```

Then open <http://localhost:5173/>. The Vite dev server proxies `/api` and `/ws`
to the sync server on port `8787`.

To see real-time sync, two clients must be in the **same room** (same `owner`
and `file`):

- **Two tabs/windows of the same browser** share a `userId`, so the same
  filename syncs automatically — type in one, watch the other.
- **Different browsers** get different `userId`s. To collaborate, pick the other
  person from the **Filesystem** dropdown (they appear by name once they've
  opened the app) and use the same filename.

## Desktop app (macOS)

### Run in development

With the dev server running (`npm run dev`), open the native window:

```bash
npm run electron:dev
```

### Build a standalone `.app`

```bash
npm run electron:dist
```

This produces `release/mac-arm64/Realtime Collaborative Text Editor.app`
(`mac-x64` on Intel). The packaged app **connects to a running server**, so
start one first:

```bash
npm run dev:server
```

> The app is not code-signed. On first launch, right-click the app → **Open** to
> get past macOS Gatekeeper.

## Scripts

| Script                  | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Run the client (`:5173`) and sync server (`:8787`) |
| `npm run dev:client`    | Run only the Vite client                           |
| `npm run dev:server`    | Run only the sync server                           |
| `npm run build`         | Type-check all projects and build the client       |
| `npm test`              | Run the unit tests once                            |
| `npm run test:watch`    | Run the unit tests in watch mode                   |
| `npm run electron:dev`  | Open the desktop window (waits for the client)     |
| `npm run electron:dist` | Build the standalone macOS app                     |
| `npm run lint`          | Run ESLint                                         |

## Project structure

```
.
├── server/                 # Hono sync server
│   ├── docHub.ts           # one Y.Doc: applies & fans out updates
│   ├── docRegistry.ts      # one hub per (owner, file) + per-owner quota
│   ├── docStore.ts         # per-file persistence on disk
│   ├── persistence.ts      # debounced saver
│   └── index.ts            # WebSocket / SSE / polling + /api/files endpoints
├── electron/               # Electron main + preload (desktop app)
└── src/
    ├── sync/               # transports, encoding, server-url + types
    ├── lib/                # text-file, storage, userId, Y.Text diff helpers
    ├── hooks/useCollab.ts  # owns the per-room Y.Doc, quota, and transports
    └── components/Editor.tsx
```

## Configuration (server)

| Env var       | Default          | Description                                   |
| ------------- | ---------------- | --------------------------------------------- |
| `PORT`        | `8787`           | Server port                                   |
| `DATA_DIR`    | `server/data`    | Where documents are persisted (one file each) |
| `QUOTA_BYTES` | `1048576` (1 MB) | Storage quota per filesystem (owner)          |

## Limitations

- **No authentication** — a `userId` is just a random id in `localStorage`, and
  anyone who knows an owner id can open that filesystem. There is no access
  control; this is a learning project, not a secure multi-tenant service.
- **Local server** — clients target `localhost:8787`; syncing across different
  machines requires hosting the server and updating the client URL.
