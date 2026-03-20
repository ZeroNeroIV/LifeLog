// ─────────────────────────────────────────────────────────────────────────────
// src/db.js  –  Life-Log  ·  SQLite persistence layer
//
// Compatible with expo-sqlite v15 / v16 (async API).
// Uses a module-level singleton so the database is opened exactly once and
// reused across the entire app lifetime, including background notification
// handlers that will be added in Step 5.
// ─────────────────────────────────────────────────────────────────────────────

import * as SQLite from "expo-sqlite";

// ─── Singleton ───────────────────────────────────────────────────────────────

/** @type {SQLite.SQLiteDatabase | null} */
let _db = null;

/**
 * Return the open database handle, opening (and bootstrapping) it on first call.
 * @returns {Promise<SQLite.SQLiteDatabase>}
 */
const getDB = async () => {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("lifelog.db");
  await _bootstrapSchema(_db);
  return _db;
};

// ─── Default Settings ────────────────────────────────────────────────────────

/**
 * Seed values written with INSERT OR IGNORE so existing user edits are never
 * overwritten during subsequent app launches.
 *
 * Units:
 *   pomodoro_*         → minutes
 *   water_fav*_ml      → millilitres
 *   caffeine_fav*_mg   → milligrams
 *   mood_check_*       → boolean string / hour / minutes
 */
const DEFAULT_SETTINGS = [
  // ── Pomodoro ──────────────────────────────────────────────
  ["pomodoro_work_minutes", "25"],
  ["pomodoro_break_minutes", "5"],

  // ── Water quick-adds ──────────────────────────────────────
  ["water_fav1_ml", "250"], // standard glass
  ["water_fav2_ml", "500"], // large bottle cap

  // ── Caffeine quick-adds ───────────────────────────────────
  ["caffeine_fav1_mg", "80"], // ~1 espresso shot
  ["caffeine_fav2_mg", "160"], // ~standard filter coffee

  // ── Mood-check notification window ───────────────────────
  ["mood_check_enabled", "true"],
  ["mood_check_start_hour", "9"],
  ["mood_check_end_hour", "21"],
  ["mood_check_interval_minutes", "60"],
];

// ─── Schema & Migration ──────────────────────────────────────────────────────

// Increment this constant whenever the schema changes.
// The migration block below will detect the old version and upgrade cleanly.
const SCHEMA_VERSION = 1;

/**
 * Versioned migration runner.
 *
 * PRAGMA user_version is a free 32-bit integer stored in the SQLite file
 * header – perfect for cheap schema version checks with zero extra tables.
 *
 * Strategy:
 *   - Fresh DB            → user_version = 0  → run v1 migration
 *   - Broken/stale DB     → user_version = 0  → same path, drops old tables
 *   - Already on v1       → user_version = 1  → skip (no-op)
 *   - Future v2 migration → add an `if (v < 2)` block below
 *
 * The version stamp is written LAST so a crash mid-migration leaves the DB
 * at version 0 and the next launch retries from scratch.
 *
 * @param {SQLite.SQLiteDatabase} db
 */
const _bootstrapSchema = async (db) => {
  // WAL: concurrent reads do not block writes – much faster on mobile.
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");

  // Read the schema version from the database file header (default = 0).
  const vRow = await db.getFirstAsync("PRAGMA user_version;");
  const installedVersion = vRow?.user_version ?? 0;

  if (installedVersion >= SCHEMA_VERSION) {
    // Schema is already current – nothing to do.
    return;
  }

  // ── Migration: v0 → v1 ───────────────────────────────────────────────────
  // Drops any partial/corrupt tables left by a previous failed init attempt,
  // then creates the full schema from scratch.

  await db.execAsync("DROP INDEX IF EXISTS idx_logs_type_ts;");
  await db.execAsync("DROP TABLE IF EXISTS logs;");
  await db.execAsync("DROP TABLE IF EXISTS settings;");

  // logs: one row per metric event
  //   type  = 'water' | 'caffeine' | 'mood' | 'focus'
  //   value = mL      | mg         | 1-5    | minutes
  await db.execAsync(
    `CREATE TABLE logs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      type      TEXT    NOT NULL,
      value     REAL    NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );`,
  );

  // Composite index for fast type + time-range queries
  await db.execAsync(
    `CREATE INDEX idx_logs_type_ts ON logs (type, timestamp);`,
  );

  // settings: simple key-value store, values always stored as TEXT
  await db.execAsync(
    `CREATE TABLE settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );`,
  );

  // Seed default settings – INSERT OR IGNORE is safe to repeat
  for (const [key, value] of DEFAULT_SETTINGS) {
    await db.runAsync(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);",
      [key, value],
    );
  }

  // Stamp the version LAST – if anything above throws, the next launch
  // will find user_version = 0 and retry the whole migration cleanly.
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open the database and apply the schema.
 * Call once in the root layout (_layout.jsx) before rendering any screens.
 *
 * @returns {Promise<void>}
 */
export const initializeDB = async () => {
  await getDB();
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  Logs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append a new metric entry to the logs table.
 *
 * @param {'water' | 'caffeine' | 'mood' | 'focus'} type
 * @param {number} value  –  mL / mg / 1-5 rating / minutes
 * @returns {Promise<number>}  The newly inserted row id.
 *
 * @example
 *   const id = await addLog('water', 250);
 */
export const addLog = async (type, value) => {
  const db = await getDB();
  const timestamp = Math.floor(Date.now() / 1000);

  const result = await db.runAsync(
    "INSERT INTO logs (type, value, timestamp) VALUES (?, ?, ?);",
    [type, value, timestamp],
  );

  return result.lastInsertRowId;
};

/**
 * Return daily totals for the **last 7 days** for a given metric type,
 * sorted ascending by date so chart libraries can use the array directly.
 *
 * @param {'water' | 'caffeine' | 'mood' | 'focus'} type
 * @returns {Promise<Array<{ date: string, total: number }>>}
 *   `date` is formatted 'YYYY-MM-DD' in the device's local timezone.
 *
 * @example
 *   const rows = await getWeeklyData('water');
 *   // → [{ date: '2025-05-01', total: 1750 }, …]
 */
export const getWeeklyData = async (type) => {
  const db = await getDB();
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  
  const aggregate = type === 'mood' ? 'AVG(value)' : 'SUM(value)';

  return await db.getAllAsync(
    `SELECT
       strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch', 'localtime')) AS date,
       ${aggregate} AS total
     FROM logs
     WHERE type = ? AND timestamp >= ?
     GROUP BY date
     ORDER BY date ASC;`,
    [type, sevenDaysAgo],
  );
};

/**
 * Return the sum of all values logged **today** for a given type.
 * Returns 0 when no entries exist (never throws).
 *
 * @param {'water' | 'caffeine' | 'mood' | 'focus'} type
 * @returns {Promise<number>}
 *
 * @example
 *   const total = await getTodayTotal('water');  // e.g. 750 (mL)
 */
export const getTodayTotal = async (type) => {
  const db = await getDB();
  // Floor to the start of the current calendar day in local time.
  const startOfDay = Math.floor(
    new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000,
  );

  const row = await db.getFirstAsync(
    `SELECT COALESCE(SUM(value), 0) AS total
     FROM logs
     WHERE type = ? AND timestamp >= ?;`,
    [type, startOfDay],
  );

  return row?.total ?? 0;
};

/**
 * Return all individual log entries for **today**, newest-first.
 * Useful for rendering a "Today's activity" list on the dashboard.
 *
 * @param {'water' | 'caffeine' | 'mood' | 'focus'} type
 * @returns {Promise<Array<{ id: number, type: string, value: number, timestamp: number }>>}
 */
export const getTodayLogs = async (type) => {
  const db = await getDB();
  const startOfDay = Math.floor(
    new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000,
  );

  return await db.getAllAsync(
    `SELECT *
     FROM logs
     WHERE type = ? AND timestamp >= ?
     ORDER BY timestamp DESC;`,
    [type, startOfDay],
  );
};

/**
 * Permanently delete **every** log entry.
 * Used by the "Clear All Data" button added in Step 6.
 *
 * @returns {Promise<void>}
 */
export const clearAllLogs = async () => {
  const db = await getDB();
  await db.runAsync("DELETE FROM logs;");
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  Settings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert a single setting.  The value is coerced to a string for storage.
 *
 * @param {string} key
 * @param {string | number | boolean} value
 * @returns {Promise<void>}
 *
 * @example
 *   await updateSetting('pomodoro_work_minutes', 30);
 */
export const updateSetting = async (key, value) => {
  const db = await getDB();
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);",
    [key, String(value)],
  );
};

/**
 * Read a single setting by key.
 *
 * @param {string} key
 * @param {string | null} [defaultValue=null]  Returned when the key is absent.
 * @returns {Promise<string | null>}
 *
 * @example
 *   const minutes = await getSetting('pomodoro_work_minutes', '25');
 */
export const getSetting = async (key, defaultValue = null) => {
  const db = await getDB();
  const row = await db.getFirstAsync(
    "SELECT value FROM settings WHERE key = ?;",
    [key],
  );
  return row?.value ?? defaultValue;
};

/**
 * Load **all** settings into a plain object for bulk reads
 * (e.g., hydrating a Settings modal with a single await).
 *
 * @returns {Promise<Record<string, string>>}
 *
 * @example
 *   const cfg = await getAllSettings();
 *   console.log(cfg.pomodoro_work_minutes); // '25'
 */
export const getAllSettings = async () => {
  const db = await getDB();
  const rows = await db.getAllAsync("SELECT key, value FROM settings;");
  return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
};
