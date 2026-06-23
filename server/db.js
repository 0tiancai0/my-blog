import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'blog.db');

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

let db;

/**
 * Initialize the database: load from disk or create fresh.
 * Must be called once at startup before any queries.
 */
export async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // ── Comments ──
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT    NOT NULL,
      author      TEXT    NOT NULL,
      content     TEXT    NOT NULL,
      parent_id   INTEGER DEFAULT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      ip_hash     TEXT    NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(slug)`);

  // ── Likes ──
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      slug  TEXT    NOT NULL UNIQUE,
      count INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS like_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT    NOT NULL,
      fingerprint TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_likelogs_fp ON like_logs(slug, fingerprint)`);

  // ── Users ──
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // ── Favorites ──
  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      slug       TEXT    NOT NULL,
      title      TEXT    NOT NULL DEFAULT '',
      created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, slug)
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)`);

  // ── Migrations: add user_id to existing tables ──
  try { db.run(`ALTER TABLE comments ADD COLUMN user_id INTEGER REFERENCES users(id)`); } catch { /* exists */ }
  try { db.run(`ALTER TABLE like_logs ADD COLUMN user_id INTEGER REFERENCES users(id)`); } catch { /* exists */ }

  saveDB();
  console.log('  Database initialized successfully');
}

/** Persist in-memory DB to disk */
export function saveDB() {
  if (!db) return;
  const buffer = db.export();
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, Buffer.from(buffer));
  fs.renameSync(tmp, DB_PATH);
}

/** Get a single row as an object */
export function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      const row = {};
      cols.forEach((c, i) => { row[c] = vals[i]; });
      return row;
    }
    return null;
  } finally {
    stmt.free();
  }
}

/** Get all rows as objects */
export function getAll(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    while (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      const row = {};
      cols.forEach((c, i) => { row[c] = vals[i]; });
      results.push(row);
    }
  } finally {
    stmt.free();
  }
  return results;
}

/** Execute a statement and return { lastInsertRowid, changes } */
export function run(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
  saveDB();
  return {
    lastInsertRowid: lastId,
  };
}

export default { initDB, saveDB, getOne, getAll, run };
