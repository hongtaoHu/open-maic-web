# OpenMAIC Frontend (Vue 3)

Greenfield Vue 3.5 + Vite 6 + TypeScript MVP for home and classroom flows.

## Stack

- Vue 3.5, Vue Router 4, Pinia
- Vite 6, Tailwind CSS 4
- Dexie (IndexedDB skeleton)

## Setup

```bash
cd frontend
pnpm install
```

## Development

```bash
pnpm dev
```

Vite proxies `/api` → `http://localhost:8000`. Start the backend first (see `backend/README.md` or `pnpm dev:backend` from repo root).

Optional: set `VITE_API_BASE` in `.env.local` if not using the dev proxy.

## Routes

| Path | View |
|------|------|
| `/` | Home — topic input, classroom list |
| `/classroom/:id` | Classroom — scene sidebar, chat SSE |

## Build

```bash
pnpm build
```
