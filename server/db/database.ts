import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { Database as SqlDatabase } from 'sql.js';

let dbInstance: SqlDatabase | null = null;
const DB_DIR = path.resolve(process.cwd(), '.slowsort');
const DB_FILE = path.join(DB_DIR, 'slowsort.sqlite');

export async function getDb(): Promise<SqlDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch {
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  saveDb();
  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  }
}

function initSchema(db: SqlDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      folder_path TEXT NOT NULL,
      connected_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      folder_path TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      file_count INTEGER NOT NULL,
      total_bytes INTEGER NOT NULL,
      duplicate_groups_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scanned_files (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      filename TEXT NOT NULL,
      extension TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER NOT NULL,
      modified_at TEXT NOT NULL,
      sha256_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      source_relative_path TEXT NOT NULL,
      target_relative_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      proposed_filename TEXT NOT NULL,
      category TEXT NOT NULL,
      reason TEXT NOT NULL,
      confidence REAL NOT NULL,
      operation_type TEXT NOT NULL,
      conflict_warning TEXT,
      status TEXT NOT NULL, -- pending, approved, rejected, executed, failed
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operations_history (
      id TEXT PRIMARY KEY,
      proposal_id TEXT,
      batch_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      source_path TEXT NOT NULL,
      destination_path TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      status TEXT NOT NULL, -- success, failed, undone
      error_message TEXT,
      executed_at TEXT NOT NULL,
      undone_at TEXT
    );
  `);

  // Default settings
  const defaultSettings: Record<string, string> = {
    gemini_model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    extract_text_content: 'false',
    max_scan_depth: '6',
    allowed_root: process.env.ALLOWED_ROOT || process.cwd(),
  };

  for (const [key, val] of Object.entries(defaultSettings)) {
    const existing = db.exec(`SELECT value FROM settings WHERE key = '${key}'`);
    if (existing.length === 0 || existing[0].values.length === 0) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, val]);
    }
  }
}
