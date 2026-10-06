# Signal Messenger Clone

A full-stack, real-time messaging platform inspired by Signal Desktop, featuring end-to-end encrypted messaging semantics, WebSocket broadcasts, typing indicators, and delivery/read receipts.

---

## Tech Stack

* **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Zustand, Lucide Icons, Date-fns
* **Backend:** FastAPI, Uvicorn, Python 3.14, SQLAlchemy 2.0 (Asyncio), SQLite (`aiosqlite`), WebSockets
* **Architecture:** Decoupled client-server architecture communicating via RESTful APIs and full-duplex WebSockets

---

## System Architecture

```text
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│       Next.js 14 Client         │         │         FastAPI Backend         │
│  (Port 3000 - Zustand / WS)     │         │    (Port 8000 - Asyncio / DB)   │
└────────────────┬────────────────┘         └────────────────┬────────────────┘
                 │                                           │
                 ├────────── REST (HTTP Endpoints) ──────────┤
                 │   GET  /users                             │
                 │   POST /auth/login                        │
                 │   GET  /conversations/{user_id}           │
                 │   GET  /conversations/{id}/messages       │
                 │                                           │
                 ├────── Full-Duplex WebSockets (/ws) ───────┤
                 │   -> send_message                         │
                 │   <- new_message                          │
                 │   <-> typing indicator                    │
                 │   <-> presence_update (online/offline)    │
                 │   <-> receipt_update (sent/delivered/read)│
                 │                                           │
                 └───────────────────────────────────────────┴───► [SQLite DB]

