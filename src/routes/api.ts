import type { FastifyInstance } from 'fastify';
import { sessionManager } from '../session/manager.js';

export async function apiRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Session cleanup (cron-like endpoint)
  fastify.post('/api/cleanup', async () => {
    const deleted = sessionManager.cleanupOldSessions();
    return { deletedSessions: deleted };
  });
}
