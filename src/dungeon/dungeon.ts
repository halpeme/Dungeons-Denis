import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';

export interface Cell {
  type: 'empty' | 'floor' | 'wall' | 'door' | 'stairs';
  roomId?: string;
}

export interface Marker {
  id: string;
  x: number;
  y: number;
  type: 'trap' | 'treasure' | 'monster' | 'npc' | 'custom';
  label: string;
  gmOnly: boolean;
}

export interface Dungeon {
  id: string;
  name: string;
  gridWidth: number;
  gridHeight: number;
  cells: Cell[][];
  markers: Marker[];
  backgroundImage?: string;
  createdAt: number;
  updatedAt: number;
}

interface DungeonRow {
  id: string;
  name: string;
  grid_width: number;
  grid_height: number;
  cells: string;
  markers: string;
  background_image: string | null;
  created_at: number;
  updated_at: number;
}

export class DungeonManager {
  // Create a new dungeon
  createDungeon(name: string, width: number = 20, height: number = 20): Dungeon {
    const id = nanoid();
    const now = Date.now();

    // Initialize empty grid
    const cells: Cell[][] = [];
    for (let y = 0; y < height; y++) {
      cells[y] = [];
      for (let x = 0; x < width; x++) {
        cells[y][x] = { type: 'empty' };
      }
    }

    const stmt = db.prepare(`
      INSERT INTO dungeons (id, name, grid_width, grid_height, cells, markers, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, name, width, height, JSON.stringify(cells), '[]', now, now);

    return {
      id,
      name,
      gridWidth: width,
      gridHeight: height,
      cells,
      markers: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  // Get dungeon by ID
  getDungeon(id: string): Dungeon | null {
    const stmt = db.prepare('SELECT * FROM dungeons WHERE id = ?');
    const row = stmt.get(id) as DungeonRow | undefined;
    return row ? this.rowToDungeon(row) : null;
  }

  // Get all dungeons (list)
  getAllDungeons(): { id: string; name: string; gridWidth: number; gridHeight: number }[] {
    const stmt = db.prepare('SELECT id, name, grid_width, grid_height FROM dungeons ORDER BY updated_at DESC');
    const rows = stmt.all() as { id: string; name: string; grid_width: number; grid_height: number }[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      gridWidth: row.grid_width,
      gridHeight: row.grid_height,
    }));
  }

  // Update dungeon
  updateDungeon(id: string, updates: Partial<Pick<Dungeon, 'name' | 'cells' | 'markers' | 'backgroundImage'>>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.cells !== undefined) {
      fields.push('cells = ?');
      values.push(JSON.stringify(updates.cells));
    }
    if (updates.markers !== undefined) {
      fields.push('markers = ?');
      values.push(JSON.stringify(updates.markers));
    }
    if (updates.backgroundImage !== undefined) {
      fields.push('background_image = ?');
      values.push(updates.backgroundImage);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = db.prepare(`UPDATE dungeons SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  // Delete dungeon
  deleteDungeon(id: string): void {
    const stmt = db.prepare('DELETE FROM dungeons WHERE id = ?');
    stmt.run(id);
  }

  // Get dungeon data for table display (excludes GM-only markers, applies fog)
  getDungeonForTable(id: string, revealedCells: number[][]): Partial<Dungeon> | null {
    const dungeon = this.getDungeon(id);
    if (!dungeon) return null;

    // Filter out GM-only markers
    const visibleMarkers = dungeon.markers.filter(m => !m.gmOnly);

    // Only include markers in revealed cells
    const revealedSet = new Set(revealedCells.map(c => `${c[0]},${c[1]}`));
    const tableMarkers = visibleMarkers.filter(m => revealedSet.has(`${m.x},${m.y}`));

    return {
      id: dungeon.id,
      name: dungeon.name,
      gridWidth: dungeon.gridWidth,
      gridHeight: dungeon.gridHeight,
      cells: dungeon.cells, // Client applies fog
      markers: tableMarkers,
      backgroundImage: dungeon.backgroundImage,
    };
  }

  // Convert DB row to Dungeon object
  private rowToDungeon(row: DungeonRow): Dungeon {
    return {
      id: row.id,
      name: row.name,
      gridWidth: row.grid_width,
      gridHeight: row.grid_height,
      cells: JSON.parse(row.cells),
      markers: JSON.parse(row.markers),
      backgroundImage: row.background_image || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const dungeonManager = new DungeonManager();
