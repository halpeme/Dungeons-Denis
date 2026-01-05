# CLAUDE.md - Project Instructions

## Project Overview

**Dungeons & Denis** - A real-time fog-of-war map controller for tabletop RPGs (Splittermond).

- **GM Controller** (`/gm`): Mobile-friendly interface for revealing/hiding map areas
- **Table Display** (`/table`): Full-screen display for TV/monitor showing the player view
- **Real-time sync**: WebSocket communication between GM and table

## Tech Stack

- **Backend**: Node.js, Fastify, TypeScript, SQLite (better-sqlite3)
- **Frontend**: Vanilla JS, Tailwind CSS (CDN), HTML5 Canvas
- **Build**: tsx (TypeScript execution), Vitest (testing)

## Commands

```bash
npm run dev          # Start dev server (port 3001)
npm run build        # Compile TypeScript
npm run test         # Run tests
npm run download-maps # Download Splittermond preset maps (requires poppler)
```

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

## Architecture Notes

### Canvas System (GM Controller)
The GM controller uses a multi-layer canvas system with viewport transforms:

1. **mapCanvas** (z-index: 1) - Base map image
2. **figureCanvas** (z-index: 2) - Player/enemy figures
3. **fogCanvas** (z-index: 3) - Fog of war overlay (0.7 opacity for GM)
4. **previewCanvas** (z-index: 10) - Preview before confirming actions

### Viewport Transform System
- Uses canvas context transforms (`ctx.setTransform()`) instead of CSS transforms
- **Offscreen canvases**: `fogDataCanvas` and `previewDataCanvas` store untransformed data
- Display canvases render from offscreen canvases with viewport transform applied
- Coordinate conversion: `screenToCanvas()` handles CSS scaling + viewport transform

### Key State Objects
```javascript
const viewport = {
  x: 0,        // Pan offset X (internal canvas pixels)
  y: 0,        // Pan offset Y (internal canvas pixels)
  scale: 1,    // Zoom level (0.5 to 3)
  rotation: 0  // Rotation in degrees (0, 90, 180, 270)
};
```

### Pan/Draw Mode
- At 100% zoom: Always draw mode
- When zoomed in: Drag to pan by default, toggle "Draw Mode" button to draw

### Map Interaction Logic
- **Pinch-Zoom**: Anchored to the **initial** pinch center (not updated during gesture). This prevents "walking" or jumping when moving hands while zooming.
- **Multi-touch**: Panning (`isPanning`) is immediately disabled when a second finger is detected (`e.touches.length === 2`) to prevent conflicting updates from single-touch pan logic.
- **Viewport**: `screenToCanvas()` converts client coordinates -> internal canvas resolution -> applied viewport transform.

## Critical Warnings

### DO NOT use `taskkill` to kill Node processes broadly
Using `taskkill /F /IM node.exe` or similar commands will kill ALL Node processes on the system, including Claude Code itself, causing a crash.

**Safe alternatives:**
1. Use `Ctrl+C` in the terminal running the process
2. Kill specific PIDs only: `taskkill /F /PID <specific-pid>`
3. Let the user handle process termination manually

**Never run:**
- `taskkill /F /IM node.exe` (kills ALL node processes)
- `taskkill /F /IM cmd.exe` (may kill Claude Code's shell)

## Git Repository

- **Remote**: https://github.com/halpeme/Dungeons-Denis
- **Branch**: main
