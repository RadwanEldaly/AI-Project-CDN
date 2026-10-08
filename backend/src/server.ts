import dotenv from 'dotenv';
dotenv.config();

import { initDatabase, closeDatabase } from './db/connection.js';
import { buildApp } from './app.js';

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    // 1. Initialize Database & Run Migrations
    await initDatabase();
    console.log('✅ PostgreSQL Database connected and migrations applied.');

    // 2. Build Fastify Server
    const app = await buildApp();

    // 3. Graceful Shutdown Handlers
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        console.log(`\n🛑 Received ${signal}. Draining HTTP connections and shutting down...`);
        try {
          await app.close();
          await closeDatabase();
          console.log('✅ Server and database closed gracefully.');
          process.exit(0);
        } catch (err) {
          console.error('❌ Error during shutdown:', err);
          process.exit(1);
        }
      });
    }

    // 4. Start Listening
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 DevSpace API Server listening at http://localhost:${PORT}`);
    console.log(`📡 Health Check available at http://localhost:${PORT}/healthz`);
    console.log(`Ready Probe available at http://localhost:${PORT}/readyz`);
  } catch (error) {
    console.error('❌ Failed to start DevSpace API Server:', error);
    process.exit(1);
  }
}

startServer();
