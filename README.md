# Dungeons & Denis

Real-time companion tool for in-person D&D sessions. The Game Master controls everything from their phone while a shared TV/monitor displays the dungeon map, handouts, and puzzles to the players.

## Features

- **Fog of War Maps** - Players only see explored areas; GM reveals as the party moves
- **Dungeon Builder** - Create dungeons with rooms, corridors, doors, and stairs
- **Live Reveal** - Tap on the GM's mini-map to reveal areas with smooth animations
- **Party Tracking** - Move the party marker as players explore
- **Handouts** - Push images (maps, letters, portraits) to the Table display
- **Decision Points** - Show multiple-choice options when players reach crossroads
- **Puzzles** - Interactive riddles, multiple-choice, and sequence puzzles
- **Real-time Sync** - All changes instantly update on the Table display

## Quick Start

### Prerequisites

- Node.js 18+ (with npm)

### Installation

```bash
# Clone or navigate to the project directory
cd dungeon-bridge

# Install dependencies
npm install

# Start development server
npm run dev
```

### Usage

1. Open the GM Controller on your phone/tablet: `http://localhost:3001/gm`
2. Click "Create New Session" - you'll get a 6-character code
3. Open the Table Display on your TV/monitor: `http://localhost:3001/table`
4. Enter the code to connect

## How It Works

```
┌─────────────────────┐      WebSocket      ┌─────────────────────┐
│   GM Controller     │◄──────────────────►│      Server         │
│   (Phone/Tablet)    │                     │   (Node.js)         │
└─────────────────────┘                     └──────────┬──────────┘
                                                       │
                                                       │ WebSocket
                                                       ▼
                                            ┌─────────────────────┐
                                            │   Table Display     │
                                            │   (TV/Monitor)      │
                                            └─────────────────────┘
```

## GM Controller

The GM Controller is a mobile-first interface with these tabs:

- **Map** - Select/create dungeons, tap to reveal areas, move party marker
- **Handouts** - Upload or paste image URLs, push to Table display
- **Decisions** - Create multiple-choice options for the party
- **Puzzles** - Send riddles, sequences, or multiple-choice puzzles
- **Settings** - View session code, change display mode, end session

### Dungeon Editor

1. Go to Map tab and click "Create New Dungeon"
2. Name your dungeon and set the grid size
3. Use the tools to draw:
   - **Floor** - Walkable areas
   - **Wall** - Solid walls
   - **Door** - Door markers
   - **Stairs** - Stairways
   - **Erase** - Clear cells
4. Save and it will automatically load on the Table

### Revealing Areas

- Click "Reveal" button to enter reveal mode
- Tap cells on the mini-map to reveal them
- Click "Party" to move the party marker (also reveals that cell)

## Table Display

The Table Display is designed for a TV/monitor at your gaming table:

- **Blank Mode** - Just the logo (default)
- **Map Mode** - Fog of war dungeon view
- **Handout Mode** - Fullscreen image
- **Decision Mode** - Shows options for players
- **Puzzle Mode** - Interactive puzzle interface

The display automatically updates when the GM makes changes.

## Project Structure

```
dungeon-bridge/
├── src/                    # TypeScript backend
│   ├── server.ts          # Fastify entry point
│   ├── db/                # SQLite database
│   ├── websocket/         # WebSocket handlers
│   ├── session/           # Session management
│   └── dungeon/           # Dungeon data model
├── public/                 # Frontend files
│   ├── gm/                # GM Controller
│   ├── table/             # Table Display
│   └── shared/            # Shared utilities
└── db/                     # SQLite database files
```

## Scripts

```bash
npm run dev      # Development with hot reload
npm run build    # Build TypeScript
npm start        # Production server
npm test         # Run tests
```

## Network Setup

For local network play:

1. Find your computer's local IP (e.g., `192.168.1.100`)
2. GM accesses: `http://192.168.1.100:3001/gm`
3. Table Display accesses: `http://192.168.1.100:3001/table`

Make sure your firewall allows port 3001.

## Tech Stack

- **Backend**: Fastify + TypeScript
- **WebSocket**: @fastify/websocket
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Vanilla JavaScript + Canvas
- **Styling**: Tailwind CSS

## License

MIT
