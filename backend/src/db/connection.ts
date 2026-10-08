import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import { Database } from './schema.js';
import { PGliteDialect } from './pglite-dialect.js';
import { runMigrations } from './migrations.js';

let dbInstance: Kysely<Database> | null = null;
let pgliteInstance: PGlite | null = null;
let pgPoolInstance: pg.Pool | null = null;

export interface DatabaseConfig {
  databaseUrl?: string;
  dataDir?: string;
}

export async function initDatabase(config: DatabaseConfig = {}): Promise<Kysely<Database>> {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;

  if (databaseUrl) {
    // Production / Remote PostgreSQL via connection pool
    pgPoolInstance = new pg.Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DB_POOL_MAX || 20),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: databaseUrl.includes('neon.tech') ? true : undefined,
    });

    dbInstance = new Kysely<Database>({
      dialect: new PostgresDialect({
        pool: pgPoolInstance,
      }),
    });
  } else {
    // Local development & standalone testing via PGlite WASM
    const dataDir = config.dataDir || path.resolve(process.cwd(), '.data', 'pglite');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    pgliteInstance = new PGlite(dataDir);
    dbInstance = new Kysely<Database>({
      dialect: new PGliteDialect(pgliteInstance),
    });
  }

  // Execute idempotent schema migrations
  await runMigrations(dbInstance);

  return dbInstance;
}

export function getDb(): Kysely<Database> {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
    pgliteInstance = null;
    pgPoolInstance = null;
  } else if (pgliteInstance) {
    if (!pgliteInstance.closed) {
      await pgliteInstance.close();
    }
    pgliteInstance = null;
  } else if (pgPoolInstance) {
    await pgPoolInstance.end();
    pgPoolInstance = null;
  }
}
