# CLAUDE.md - Project Instructions

## Overview

**Dungeons & Denis** - Local fog-of-war map controller for in-person tabletop RPGs (Splittermond).

| Endpoint | Purpose |
|----------|---------|
| `/gm` | Mobile GM controller - reveal/hide map areas |
| `/table` | Full-screen TV display - auto-joins session |

**Tech**: Node.js + Fastify + TypeScript + SQLite | Vanilla JS + Canvas + Tailwind CDN

## Commands

```bash
npm run dev           # Start dev server (port 3001) ← PRIMARY
npm run build         # Compile TypeScript
npm run download-maps # Download Splittermond preset maps
```

**IMPORTANT**: Do NOT run `npm run build:dist` during development—it's slow and for final release only.

## Project Structure

```
src/
  server.ts           # Fastify entry point
  config.ts           # Port, paths, constants
  tray/wrapper.ts     # System tray + server lifecycle
  websocket/          # WS handlers (events.ts, handlers/)
  session/            # Session state (manager.ts, types.ts)
  db/                 # SQLite (schema.ts, connection.ts)
  routes/api.ts       # REST endpoints
public/
  gm/                 # GM controller (gm.js, state.js, canvas.js, fog.js, ui.js)
  table/              # Table display (table.js)
  shared/             # Shared modules (ws-client.js, viewport.js, touch-gestures.js)
scripts/              # Build & utility scripts
```

## Code Style

- **Backend**: TypeScript, ES modules, async/await
- **Frontend**: Vanilla JS (no framework), module pattern with explicit exports
- **State**: GM uses centralized `state.js` with batch updaters
- **Canvas**: Multi-layer system with offscreen buffers (see architecture.md)

## Documentation

- [Architecture Notes](agent_docs/architecture.md) — Canvas layers, viewport transforms, touch handling

## Critical Warnings

### NEVER kill Node processes broadly

```bash
# ❌ NEVER RUN - kills Remote Mouse, Claude Code, and other tools
taskkill /F /IM node.exe
Stop-Process -Name node
```

**Safe alternatives:**
1. `Ctrl+C` in terminal
2. `taskkill /F /PID <specific-pid>`
3. App's internal cleanup handles port 3001 safely

## Repository

- **Remote**: https://github.com/halpeme/Dungeons-Denis
- **Branch**: main
