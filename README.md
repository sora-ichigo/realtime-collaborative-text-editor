# Realtime Collaborative Text Editor

A web-based plain-text editor with real-time collaborative editing. Multiple
clients edit one shared document and stay in sync through a backend server,
using [Yjs](https://yjs.dev/) CRDTs so concurrent edits merge without losing
characters. The same client also runs as a macOS desktop app via Electron.

## Features

- 📝 **Plain-text editing** — open, edit, and save `.txt` files
- 💾 **Save back to the same file** — overwrites the opened file via the File
  System Access API (with a download fallback for unsupported browsers)
- 🔵 **Unsaved-changes indicator** — shows whether the document differs from the
  last saved/opened state
- 💿 **Auto-save draft** — every change is persisted to `localStorage`
- 🔄 **Real-time sync** across clients, with three switchable transports:
  **WebSocket**, **SSE**, and **HTTP polling**
- 🧩 **CRDT merging (Yjs)** — concurrent edits converge with no lost edits
- 🖥️ **macOS desktop app** (Electron)

## How sync works

All clients connect to a single backend server that owns one authoritative
`Y.Doc`. Each edit is encoded as a Yjs binary update, sent to the server,
applied to the shared document, and relayed to every other client — regardless
of which transport that client uses. A WebSocket client and a polling client
therefore stay in sync with each other.

| Transport     | Down (server → client) | Up (client → server) | Latency        |
| ------------- | ---------------------- | -------------------- | -------------- |
| **WebSocket** | live push over `/ws`   | live push over `/ws` | lowest         |
| **SSE**       | `GET /api/events`      | `POST /api/update`   | low            |
| **Polling**   | `GET /api/state?sv=…`  | `POST /api/update`   | ~1s (interval) |

You switch transports per client with the buttons in the toolbar.

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

Then open <http://localhost:5173/> in **two windows** and type in one — the text
appears in the other in real time. The Vite dev server proxies `/api` and `/ws`
to the sync server on port `8787`.

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
├── server/                 # Hono sync server (single authoritative Y.Doc)
│   ├── docHub.ts           # owns the doc, applies & fans out updates
│   └── index.ts            # WebSocket / SSE / polling endpoints
├── electron/               # Electron main + preload (desktop app)
└── src/
    ├── sync/               # transports, encoding, server-url + types
    ├── lib/                # text-file, storage, and Y.Text diff helpers
    ├── hooks/useCollab.ts  # owns the Y.Doc and swaps transports
    └── components/Editor.tsx
```

## Limitations

- **Single shared document** — everyone edits the same text; there are no rooms.
- **In-memory only** — the server does not persist the document, so restarting
  it resets the shared text.
- **Local server** — clients target `localhost:8787`; syncing across different
  machines requires hosting the server and updating the client URL.
