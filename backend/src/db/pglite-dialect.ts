import { PGlite } from '@electric-sql/pglite';
import {
  CompiledQuery,
  DatabaseConnection,
  Dialect,
  Driver,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  QueryResult,
  Kysely,
} from 'kysely';

export class PGliteDriver implements Driver {
  private pglite: PGlite;

  constructor(pglite: PGlite) {
    this.pglite = pglite;
  }

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    const executeQuery = async <R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> => {
      const result = await this.pglite.query<R>(
        compiledQuery.sql,
        compiledQuery.parameters as unknown[]
      );
      return {
        rows: result.rows,
        numAffectedRows:
          result.affectedRows != null ? BigInt(result.affectedRows) : undefined,
      };
    };

    return {
      executeQuery,
      async *streamQuery<R>(
        compiledQuery: CompiledQuery,
        _chunkSize?: number
      ): AsyncIterableIterator<QueryResult<R>> {
        const result = await executeQuery<R>(compiledQuery);
        yield result;
      },
    };
  }

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {
    await this.pglite.close();
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('BEGIN'));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('COMMIT'));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('ROLLBACK'));
  }
}

export class PGliteDialect implements Dialect {
  private pglite: PGlite;

  constructor(pglite: PGlite) {
    this.pglite = pglite;
  }

  createDriver(): Driver {
    return new PGliteDriver(this.pglite);
  }

  createQueryCompiler(): PostgresQueryCompiler {
    return new PostgresQueryCompiler();
  }

  createAdapter(): PostgresAdapter {
    return new PostgresAdapter();
  }

  createIntrospector(db: Kysely<any>): PostgresIntrospector {
    return new PostgresIntrospector(db);
  }
}
