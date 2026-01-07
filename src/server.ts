import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import fastifyMultipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initializeSchema } from './db/schema.js';
import { apiRoutes } from './routes/api.js';
import { setupWebSocket } from './websocket/index.js';
import { sessionManager } from './session/manager.js';
import { closeDb } from './db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store server instance for graceful shutdown
let serverInstance: FastifyInstance | null = null;

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);

  if (!serverInstance) {
    process.exit(0);
  }

  try {
    // Close Fastify server (this will close all WebSocket connections)
    console.log('Closing server...');
    await serverInstance.close();

    // Close database connection
    console.log('Closing database...');
    closeDb();

    console.log('Server stopped cleanly');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function start() {
  // Initialize database
  initializeSchema();

  // Create Fastify instance
  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'production' ? true : {
      level: 'info',
    },
  });

  // Store for graceful shutdown
  serverInstance = fastify;

  // Global request logging
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/ws')) {
      console.log(`[HTTP] Incoming request: ${request.method} ${request.url} from ${request.ip}`);
      console.log(`[HTTP] Headers: ${JSON.stringify(request.headers, null, 2)}`);
    }
  });

  // Register WebSocket plugin
  // Disable perMessageDeflate for Safari 26 compatibility
  await fastify.register(fastifyWebsocket, {
    options: {
      perMessageDeflate: false,
      clientTracking: true,
    }
  });

  // Register multipart support for file uploads
  await fastify.register(fastifyMultipart);

  // Upload endpoint
  fastify.post('/api/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const fileId = randomUUID();
    const ext = path.extname(data.filename) || '.png';
    const filename = `${fileId}${ext}`;
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uploadPath = path.join(uploadsDir, filename);

    await pipeline(data.file, fs.createWriteStream(uploadPath));

    return { url: `/uploads/${filename}` };
  });

  // Setup WebSocket handlers (Must be before static files to ensure Upgrade request is handled correctly)
  await setupWebSocket(fastify);

  // Register static file serving (disable caching for development)
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
    cacheControl: false,
    etag: false,
    lastModified: false,
  });

  // Register API routes
  await fastify.register(apiRoutes);

  // Setup WebSocket handlers
  // await setupWebSocket(fastify); // moved up

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
    console.log(`\n🏰 Dungeons & Denis running at http://localhost:${config.port}`);
    console.log(`   GM Controller: http://localhost:${config.port}/gm`);
    console.log(`   Table Display: http://localhost:${config.port}/table\n`);

    // Run cleanup on startup
    const initialClean = sessionManager.cleanupOldSessions();
    if (initialClean > 0) console.log(`[Cleanup] Removed ${initialClean} expired sessions`);

    // Schedule periodic cleanup (every hour)
    setInterval(() => {
      const cleaned = sessionManager.cleanupOldSessions();
      if (cleaned > 0) console.log(`[Cleanup] Removed ${cleaned} expired sessions`);
    }, 60 * 60 * 1000);
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${config.port} is already in use!`);
      console.error(`   Another instance of Dungeons & Denis is probably already running.`);
      console.error(`   Stop the other instance first, or use Ctrl+C in its terminal.\n`);
      process.exit(1);
    }
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
