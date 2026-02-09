import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';

/**
 * SQLite Database Connection Manager
 */

let dbInstance: Database.Database | null = null;

export interface DatabaseConfig {
  filename: string; // Path to SQLite file
  verbose?: boolean;
}

/**
 * Initialize database connection
 */
export function initDatabase(config: DatabaseConfig): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = new Database(config.filename, {
    verbose: config.verbose ? console.log : undefined,
  });

  // Enable foreign keys
  dbInstance.pragma('foreign_keys = ON');

  // Create tables
  dbInstance.exec(SCHEMA);

  return dbInstance;
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
