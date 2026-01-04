import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initializeSchema } from './db/schema.js';
import { apiRoutes } from './routes/api.js';
import { setupWebSocket } from './websocket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  // Initialize database
  initializeSchema();

  // Create Fastify instance
  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'production' ? true : {
      level: 'info',
    },
  });

  // Register WebSocket plugin
  await fastify.register(fastifyWebsocket);

  // Register static file serving
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
  });

  // Register API routes
  await fastify.register(apiRoutes);

  // Setup WebSocket handlers
  await setupWebSocket(fastify);

  // Serve index.html for root
  fastify.get('/', async (request, reply) => {
    return reply.sendFile('index.html');
  });

  // Serve GM page
  fastify.get('/gm', async (request, reply) => {
    return reply.sendFile('gm/index.html');
  });

  // Serve Table page
  fastify.get('/table', async (request, reply) => {
    return reply.sendFile('table/index.html');
  });

  // Start server
  try {
    await fastify.listen({ port: config.port, host: config.host });
    console.log(`\n🏰 Dungeon & Denis running at http://localhost:${config.port}`);
    console.log(`   GM Controller: http://localhost:${config.port}/gm`);
    console.log(`   Table Display: http://localhost:${config.port}/table\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
