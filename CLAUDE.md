# CLAUDE.md - Project Instructions

## Project Overview

**Dungeons & Denis** - A local fog-of-war map controller for in-person tabletop RPGs (Splittermond).

- **Single-session mode**: Designed for local WiFi use with friends
- **GM Controller** (`/gm`): Mobile-friendly interface for revealing/hiding map areas (auto-connects)
- **Table Display** (`/table`): Full-screen display for TV/monitor (auto-joins active session)
- **Real-time sync**: WebSocket communication between GM and table

## Tech Stack

- **Backend**: Node.js, Fastify, TypeScript, SQLite (better-sqlite3)
- **Frontend**: Vanilla JS, Tailwind CSS (CDN), HTML5 Canvas
- **Build**: tsx (TypeScript execution), Vitest (testing)

## Commands

npm run dev           # Start dev server (port 3001) - PRIMARY DEV COMMAND
npm run tray:dev      # Start tray app in dev mode
npm run build:dist    # Create Windows distribution (dist-release/) - ONLY for release
npm run build         # Compile TypeScript
npm run test          # Run tests
npm run download-maps # Download Splittermond preset maps
```

## Development Workflow

- **Always use `npm run dev`** for local development.
- Do **not** build the distribution (`npm run build:dist`) during development; it's slow and meant for final release only.

## Project Structure

```
public/
  gm/           # GM controller (mobile UI)
    gm.js       # Main controller logic
    gm.css      # Styles
    index.html  # GM interface
  table/        # Table display (TV/monitor)
  shared/       # Shared WebSocket client
  maps/presets/ # Downloaded Splittermond maps (.jpg)
src/
  server.ts     # Fastify server entry
  websocket/    # WebSocket handlers
  session/      # Session management
  db/           # SQLite database
scripts/
  download-maps.js  # PDF to JPG converter for preset maps
```

## Documentation

- [Architecture Notes](agent_docs/architecture.md) - Canvas system, viewport transforms, and input handling logic.


## Critical Warnings

### DO NOT use `taskkill` or `Stop-Process` to kill Node processes broadly
Using `taskkill /F /IM node.exe` or `Stop-Process -Name node` will kill **ALL** Node processes on the system.

**Known Consequence:**
- Kills **Remote Mouse** server (and likely other Electron/Node-based tools).
- Kills Claude Code itself.

**Safe alternatives (Manual):**
1. Use `Ctrl+C` in the terminal.
2. Kill specific PIDs: `taskkill /F /PID <pid>`
3. Relies on the **App's Internal Cleanup**: The app (`src/tray/wrapper.ts`) safely cleans up port 3001 only by checking strict socket addresses. It is safe to run.

**Never run:**
- `taskkill /F /IM node.exe`
- `Stop-Process -Name node`
- `taskkill /F /IM cmd.exe`

## Git Repository

- **Remote**: https://github.com/halpeme/Dungeons-Denis
- **Branch**: main
