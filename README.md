# Real-Time Collaborative Notes (100x Workspace)

A high-performance, multiplayer knowledge workspace built on **Yjs CRDT** (Conflict-free Replicated Data Types), **NestJS 11**, **PostgreSQL 16**, **Redis**, and **Next.js 15** with a Notion-grade editorial interface.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │   Next.js 15 Frontend (:3000)          │
                      │   - Tiptap / ProseMirror Block Editor  │
                      │   - Yjs CRDT Client & Live Cursors     │
                      │   - Notion Warm Paper Aesthetic        │
                      └───────────────────┬────────────────────┘
                                          │ WebSocket (Binary CRDT Deltas)
                                          ▼
                      ┌────────────────────────────────────────┐
                      │   NestJS 11 WebSocket Gateway (:8000)  │
                      │   - Yjs Real-Time State Sync           │
                      │   - RoomMember RBAC Enforcement        │
                      │   - Socket.IO Redis Clustering         │
                      └─────────┬────────────────────┬─────────┘
        Peer Presence Broadcast │                    │ Debounced Snapshots
                                ▼                    ▼
                      ┌───────────────────┐┌───────────────────┐
                      │   Redis (6379)    ││ PostgreSQL (5432) │
                      │   Pub/Sub Cluster ││ Prisma 7 Storage  │
                      └───────────────────┘└───────────────────┘
```

---

## Root Commands Quick Reference

All commands can now be run directly from this root directory:

| Command | Description |
| :--- | :--- |
| **`npm run dev`** | Runs both **Backend API** (:8000) and **Frontend Web** (:3000) concurrently with colored terminal logs |
| **`npm run dev:api`** | Runs only the NestJS backend in development watch mode |
| **`npm run dev:web`** | Runs only the Next.js frontend in development mode |
| **`npm run build`** | Compiles and builds both API and Frontend for production |
| **`npm run test`** | Executes all unit test suites (8/8 tests passing) |
| **`npm run test:e2e`** | Runs the live multi-client CRDT concurrency and RBAC integration test |
| **`npm run db:push`** | Synchronizes Prisma schema with your local PostgreSQL database |
| **`npm run db:generate`** | Generates the Prisma 7 client |
| **`npm run db:studio`** | Launches Prisma Studio to view database tables in the browser |

---

## Concurrency Guarantee (Strong Eventual Consistency)

Unlike legacy text editors that send full-string replacements with version counters (`expectedVersion === note.version`), this system uses **Yjs CRDT**:
* Character insertions and deletions are decomposed into commutative binary operations.
* Multiple users typing in the exact same sentence merge automatically in real time without alert modals or overwritten text.
* Zero merge conflicts, zero dropped keystrokes.

---

## Security & RBAC

The system enforces role-based access control directly at the WebSocket layer:
* **`OWNER`**: Full room management, member invites, and write access.
* **`EDITOR`**: Real-time collaborative typing, block formatting, and cursor broadcasting.
* **`VIEWER`**: Read-only presence; any unauthorized write attempt throws an immediate `WsException('Forbidden: Viewers cannot edit notes')`.
