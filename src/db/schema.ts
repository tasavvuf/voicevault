import * as SQLite from 'expo-sqlite';

let database: SQLite.SQLiteDatabase | null = null;
let schemaInitialized = false;

function initSchema(db: SQLite.SQLiteDatabase) {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      local_audio_uri TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      stage TEXT,
      stage_message TEXT,
      title TEXT,
      summary TEXT,
      transcript TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      action_items TEXT NOT NULL DEFAULT '[]',
      server_id TEXT,
      failure_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS upload_queue (
      note_id TEXT PRIMARY KEY NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER NOT NULL
    );
  `);

  try { db.execSync('ALTER TABLE notes ADD COLUMN stage TEXT;'); } catch {}
  try { db.execSync('ALTER TABLE notes ADD COLUMN stage_message TEXT;'); } catch {}
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) {
    try {
      // Ping native handle to verify it is alive and not released during Fast Refresh
      database.getFirstSync('SELECT 1');
      return database;
    } catch {
      database = null;
    }
  }

  const db = SQLite.openDatabaseSync('voicevault.db');
  if (!schemaInitialized) {
    try {
      initSchema(db);
      schemaInitialized = true;
    } catch {}
  }

  database = db;
  return database;
}
