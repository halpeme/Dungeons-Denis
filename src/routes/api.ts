import type { FastifyInstance } from 'fastify';
import { dungeonManager } from '../dungeon/dungeon.js';
import { sessionManager } from '../session/manager.js';

export async function apiRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // List all dungeons
  fastify.get('/api/dungeons', async () => {
    return dungeonManager.getAllDungeons();
  });

  // Get a specific dungeon (for GM)
  fastify.get<{ Params: { id: string } }>('/api/dungeons/:id', async (request, reply) => {
    const dungeon = dungeonManager.getDungeon(request.params.id);
    if (!dungeon) {
      reply.status(404);
      return { error: 'Dungeon not found' };
    }
    return dungeon;
  });

  // Create a new dungeon
  fastify.post<{ Body: { name: string; width?: number; height?: number } }>('/api/dungeons', async (request) => {
    const { name, width, height } = request.body;
    const dungeon = dungeonManager.createDungeon(name, width, height);
    return dungeon;
  });

  // Update a dungeon
  fastify.put<{
    Params: { id: string };
    Body: { name?: string; cells?: unknown; markers?: unknown; backgroundImage?: string };
  }>('/api/dungeons/:id', async (request, reply) => {
    const dungeon = dungeonManager.getDungeon(request.params.id);
    if (!dungeon) {
      reply.status(404);
      return { error: 'Dungeon not found' };
    }

    dungeonManager.updateDungeon(request.params.id, request.body as any);
    return { success: true };
  });

  // Delete a dungeon
  fastify.delete<{ Params: { id: string } }>('/api/dungeons/:id', async (request, reply) => {
    const dungeon = dungeonManager.getDungeon(request.params.id);
    if (!dungeon) {
      reply.status(404);
      return { error: 'Dungeon not found' };
    }

    dungeonManager.deleteDungeon(request.params.id);
    return { success: true };
  });

  // Upload image (base64)
  fastify.post<{ Body: { image: string } }>('/api/upload', async (request) => {
    // For simplicity, we're storing base64 directly
    // In production, you'd want to save to disk and return a URL
    const { image } = request.body;
    const id = `img_${Date.now()}`;
    // TODO: Save to disk
    return { id, url: image };
  });

  // Session cleanup (cron-like endpoint)
  fastify.post('/api/cleanup', async () => {
    const deleted = sessionManager.cleanupOldSessions();
    return { deletedSessions: deleted };
  });
}
