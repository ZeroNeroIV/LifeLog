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
export const getDB = async () => {
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

  // ── Nutrition Goals ──────────────────────────────────────
  ["nutrition_calorie_goal", "2000"],
  ["nutrition_protein_goal", "50"],
  ["nutrition_carbs_goal", "250"],
  ["nutrition_fat_goal", "65"],
  ["nutrition_fiber_goal", "30"],

  // ── LLM Model Settings ───────────────────────────────────
  ["llm_model_downloaded", "false"],
  ["llm_model_path", ""],
  ["usda_db_downloaded", "false"],
  ["usda_db_path", ""],
];

// ─── Schema & Migration ──────────────────────────────────────────────────────

// Increment this constant whenever the schema changes.
// The migration block below will detect the old version and upgrade cleanly.
const SCHEMA_VERSION = 2;

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
  //   type  = 'water' | 'caffeine' | 'mood' | 'focus' | 'vitamin_c' | 'sugar'
  //   value = mL      | mg         | 1-5    | minutes | mg          | g
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

  // Stamp v1 so incremental v2 migration can detect it
  await db.execAsync("PRAGMA user_version = 1;");

  // ── Migration: v1 → v2 ───────────────────────────────────────────────────
  // Fall through to v2 migration for fresh installs

  // ── Migration: v1 → v2 (Nutrition AI Feature) ────────────────────────────
  // Adds tables for meals, AI chat, and food reporting

  // meals: Container for meal/snack entries
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS meals (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT    NOT NULL CHECK (type IN ('meal', 'snack')),
      timestamp  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      notes      TEXT
    );`,
  );
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_meals_timestamp ON meals (timestamp);`,
  );

  // meal_foods: Individual food items within a meal
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS meal_foods (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id     INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      fdc_id      TEXT,
      name        TEXT    NOT NULL,
      calories    REAL    NOT NULL DEFAULT 0,
      protein_g   REAL    NOT NULL DEFAULT 0,
      carbs_g     REAL    NOT NULL DEFAULT 0,
      fat_g       REAL    NOT NULL DEFAULT 0,
      fiber_g     REAL    NOT NULL DEFAULT 0,
      quantity_g  REAL    NOT NULL DEFAULT 100,
      source      TEXT    NOT NULL CHECK (source IN ('usda', 'ai', 'custom')) DEFAULT 'ai'
    );`,
  );
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_meal_foods_meal_id ON meal_foods (meal_id);`,
  );

  // food_reports: User-submitted missing food reports (draft GitHub issues)
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS food_reports (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      ai_estimates     TEXT,
      ingredients      TEXT,
      photo_uri        TEXT,
      notes            TEXT,
      status           TEXT    NOT NULL CHECK (status IN ('draft', 'submitted', 'resolved')) DEFAULT 'draft',
      github_issue_url TEXT,
      created_at       INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at       INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );`,
  );

  // ai_conversations: Chat session metadata with compacted summaries
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS ai_conversations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      summary    TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );`,
  );

  // ai_messages: Individual messages within a conversation
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS ai_messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      role            TEXT    NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content         TEXT    NOT NULL,
      timestamp       INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );`,
  );
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_id ON ai_messages (conversation_id, timestamp);`,
  );

  // Seed any new default settings for v2
  for (const [key, value] of DEFAULT_SETTINGS) {
    await db.runAsync(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);",
      [key, value],
    );
  }

  // Stamp the final version LAST – if anything above throws, the next launch
  // will find user_version < SCHEMA_VERSION and retry the migration cleanly.
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
 * @param {'water' | 'caffeine' | 'mood' | 'focus' | 'vitamin_c' | 'sugar'} type
 * @param {number} value  –  mL / mg / 1-5 rating / minutes / mg / g
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
 * @param {'water' | 'caffeine' | 'mood' | 'focus' | 'vitamin_c' | 'sugar'} type
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
 * @param {'water' | 'caffeine' | 'mood' | 'focus' | 'vitamin_c' | 'sugar'} type
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
 * @param {'water' | 'caffeine' | 'mood' | 'focus' | 'vitamin_c' | 'sugar'} type
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
 * Used by the "Clear All Data" button.
 * 
 * This will delete:
 * - All logs (water, caffeine, mood, focus, vitamin_c, sugar)
 * - All meals and their associated foods
 * - All nutrition entries
 * - All conversation history
 * - Keep settings intact (user preferences are preserved)
 *
 * @returns {Promise<void>}
 */
export const clearAllLogs = async () => {
  const db = await getDB();
  
  // Clear all tables in a transaction for consistency
  await db.withTransactionAsync(async () => {
    // Clear logs (water, caffeine, mood, focus, etc.)
    await db.runAsync("DELETE FROM logs;");
    
    // Clear nutrition data
    await db.runAsync("DELETE FROM foods;");  // This will cascade to meals via foreign key
    await db.runAsync("DELETE FROM meals;");
    await db.runAsync("DELETE FROM nutrition;");
    
    // Clear conversation history
    await db.runAsync("DELETE FROM conversation_messages;");
    await db.runAsync("DELETE FROM conversations;");
    
    // Reset SQLite sequence counters for auto-increment IDs
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name IN ('logs', 'meals', 'foods', 'nutrition', 'conversations', 'conversation_messages');");
  });
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

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  Meals & Nutrition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new meal/snack entry.
 *
 * @param {'meal' | 'snack'} type
 * @param {string} [notes]
 * @param {number} [timestamp] - Unix timestamp, defaults to now
 * @returns {Promise<number>} The newly inserted meal id.
 */
export const createMeal = async (type, notes = null, timestamp = null) => {
  const db = await getDB();
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  
  const result = await db.runAsync(
    "INSERT INTO meals (type, notes, timestamp) VALUES (?, ?, ?);",
    [type, notes, ts],
  );
  
  return result.lastInsertRowId;
};

/**
 * Add a food item to an existing meal.
 *
 * @param {number} mealId
 * @param {Object} food
 * @param {string} food.name
 * @param {string} [food.fdcId] - USDA FDC ID if from database
 * @param {number} [food.calories=0]
 * @param {number} [food.proteinG=0]
 * @param {number} [food.carbsG=0]
 * @param {number} [food.fatG=0]
 * @param {number} [food.fiberG=0]
 * @param {number} [food.quantityG=100]
 * @param {'usda' | 'ai' | 'custom'} [food.source='ai']
 * @returns {Promise<number>} The newly inserted meal_food id.
 */
export const addFoodToMeal = async (mealId, food) => {
  const db = await getDB();
  
  const result = await db.runAsync(
    `INSERT INTO meal_foods 
     (meal_id, fdc_id, name, calories, protein_g, carbs_g, fat_g, fiber_g, quantity_g, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      mealId,
      food.fdcId ?? null,
      food.name,
      food.calories ?? 0,
      food.proteinG ?? 0,
      food.carbsG ?? 0,
      food.fatG ?? 0,
      food.fiberG ?? 0,
      food.quantityG ?? 100,
      food.source ?? 'ai',
    ],
  );
  
  return result.lastInsertRowId;
};

/**
 * Get a meal with all its food items.
 *
 * @param {number} mealId
 * @returns {Promise<Object | null>}
 */
export const getMealWithFoods = async (mealId) => {
  const db = await getDB();
  
  const meal = await db.getFirstAsync(
    "SELECT * FROM meals WHERE id = ?;",
    [mealId],
  );
  
  if (!meal) return null;
  
  const foods = await db.getAllAsync(
    "SELECT * FROM meal_foods WHERE meal_id = ? ORDER BY id ASC;",
    [mealId],
  );
  
  return { ...meal, foods };
};

/**
 * Get all meals for today with their foods.
 *
 * @returns {Promise<Array>}
 */
export const getTodayMeals = async () => {
  const db = await getDB();
  const startOfDay = Math.floor(
    new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000,
  );
  
  const meals = await db.getAllAsync(
    `SELECT * FROM meals WHERE timestamp >= ? ORDER BY timestamp DESC;`,
    [startOfDay],
  );
  
  // Fetch foods for each meal
  for (const meal of meals) {
    meal.foods = await db.getAllAsync(
      "SELECT * FROM meal_foods WHERE meal_id = ? ORDER BY id ASC;",
      [meal.id],
    );
  }
  
  return meals;
};

/**
 * Get nutrition totals for today.
 *
 * @returns {Promise<{ calories: number, protein: number, carbs: number, fat: number, fiber: number }>}
 */
export const getTodayNutritionTotals = async () => {
  const db = await getDB();
  const startOfDay = Math.floor(
    new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000,
  );
  
  const row = await db.getFirstAsync(
    `SELECT 
       COALESCE(SUM(mf.calories), 0) AS calories,
       COALESCE(SUM(mf.protein_g), 0) AS protein,
       COALESCE(SUM(mf.carbs_g), 0) AS carbs,
       COALESCE(SUM(mf.fat_g), 0) AS fat,
       COALESCE(SUM(mf.fiber_g), 0) AS fiber
     FROM meals m
     JOIN meal_foods mf ON m.id = mf.meal_id
     WHERE m.timestamp >= ?;`,
    [startOfDay],
  );
  
  return row ?? { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
};

/**
 * Delete a meal and all its associated foods (cascade).
 *
 * @param {number} mealId
 * @returns {Promise<void>}
 */
export const deleteMeal = async (mealId) => {
  const db = await getDB();
  await db.runAsync("DELETE FROM meals WHERE id = ?;", [mealId]);
};

/**
 * Delete a specific food from a meal.
 *
 * @param {number} foodId
 * @returns {Promise<void>}
 */
export const deleteFoodFromMeal = async (foodId) => {
  const db = await getDB();
  await db.runAsync("DELETE FROM meal_foods WHERE id = ?;", [foodId]);
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  AI Conversations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new AI conversation.
 *
 * @returns {Promise<number>} The newly inserted conversation id.
 */
export const createConversation = async () => {
  const db = await getDB();
  const result = await db.runAsync(
    "INSERT INTO ai_conversations DEFAULT VALUES;",
  );
  return result.lastInsertRowId;
};

/**
 * Add a message to a conversation.
 *
 * @param {number} conversationId
 * @param {'user' | 'assistant' | 'system'} role
 * @param {string} content
 * @returns {Promise<number>} The newly inserted message id.
 */
export const addMessage = async (conversationId, role, content) => {
  const db = await getDB();
  
  const result = await db.runAsync(
    "INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, ?, ?);",
    [conversationId, role, content],
  );
  
  // Update conversation's updated_at timestamp
  await db.runAsync(
    "UPDATE ai_conversations SET updated_at = strftime('%s', 'now') WHERE id = ?;",
    [conversationId],
  );
  
  return result.lastInsertRowId;
};

/**
 * Get all messages for a conversation.
 *
 * @param {number} conversationId
 * @returns {Promise<Array<{ id: number, role: string, content: string, timestamp: number }>>}
 */
export const getConversationMessages = async (conversationId) => {
  const db = await getDB();
  return await db.getAllAsync(
    "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY timestamp ASC;",
    [conversationId],
  );
};

/**
 * Get the most recent conversation, or null if none exists.
 *
 * @returns {Promise<Object | null>}
 */
export const getLatestConversation = async () => {
  const db = await getDB();
  return await db.getFirstAsync(
    "SELECT * FROM ai_conversations ORDER BY updated_at DESC LIMIT 1;",
  );
};

/**
 * Update a conversation's summary (for context compaction).
 *
 * @param {number} conversationId
 * @param {string} summary
 * @returns {Promise<void>}
 */
export const updateConversationSummary = async (conversationId, summary) => {
  const db = await getDB();
  await db.runAsync(
    "UPDATE ai_conversations SET summary = ?, updated_at = strftime('%s', 'now') WHERE id = ?;",
    [summary, conversationId],
  );
};

/**
 * Delete old messages from a conversation, keeping only the most recent N.
 * Used for context compaction after summarization.
 *
 * @param {number} conversationId
 * @param {number} keepCount - Number of recent messages to retain
 * @returns {Promise<void>}
 */
export const compactConversation = async (conversationId, keepCount = 10) => {
  const db = await getDB();
  await db.runAsync(
    `DELETE FROM ai_messages 
     WHERE conversation_id = ? 
       AND id NOT IN (
         SELECT id FROM ai_messages 
         WHERE conversation_id = ? 
         ORDER BY timestamp DESC 
         LIMIT ?
       );`,
    [conversationId, conversationId, keepCount],
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  Food Reports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a food report for a missing/unknown food item.
 *
 * @param {Object} report
 * @param {string} report.name
 * @param {string} [report.aiEstimates] - JSON string of AI-estimated nutrition
 * @param {string} [report.ingredients]
 * @param {string} [report.photoUri]
 * @param {string} [report.notes]
 * @returns {Promise<number>} The newly inserted report id.
 */
export const createFoodReport = async (report) => {
  const db = await getDB();
  
  const result = await db.runAsync(
    `INSERT INTO food_reports (name, ai_estimates, ingredients, photo_uri, notes)
     VALUES (?, ?, ?, ?, ?);`,
    [
      report.name,
      report.aiEstimates ?? null,
      report.ingredients ?? null,
      report.photoUri ?? null,
      report.notes ?? null,
    ],
  );
  
  return result.lastInsertRowId;
};

/**
 * Get all pending (draft) food reports.
 *
 * @returns {Promise<Array>}
 */
export const getPendingFoodReports = async () => {
  const db = await getDB();
  return await db.getAllAsync(
    "SELECT * FROM food_reports WHERE status = 'draft' ORDER BY created_at DESC;",
  );
};

/**
 * Mark a food report as submitted and store the GitHub issue URL.
 *
 * @param {number} reportId
 * @param {string} githubIssueUrl
 * @returns {Promise<void>}
 */
export const markFoodReportSubmitted = async (reportId, githubIssueUrl) => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE food_reports 
     SET status = 'submitted', github_issue_url = ?, updated_at = strftime('%s', 'now')
     WHERE id = ?;`,
    [githubIssueUrl, reportId],
  );
};

/**
 * Get weekly nutrition totals for charts.
 *
 * @returns {Promise<Array<{ date: string, calories: number, protein: number, carbs: number, fat: number }>>}
 */
export const getWeeklyNutritionData = async () => {
  const db = await getDB();
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  return await db.getAllAsync(
    `SELECT 
       strftime('%Y-%m-%d', datetime(m.timestamp, 'unixepoch', 'localtime')) AS date,
       COALESCE(SUM(mf.calories), 0) AS calories,
       COALESCE(SUM(mf.protein_g), 0) AS protein,
       COALESCE(SUM(mf.carbs_g), 0) AS carbs,
       COALESCE(SUM(mf.fat_g), 0) AS fat
     FROM meals m
     LEFT JOIN meal_foods mf ON m.id = mf.meal_id
     WHERE m.timestamp >= ?
     GROUP BY date
     ORDER BY date ASC;`,
    [sevenDaysAgo],
  );
};

/**
 * Calculate nutrition goal streak (consecutive days meeting calorie goal).
 *
 * @param {number} calorieGoal
 * @param {number} [tolerance=0.1] - Fraction below goal still counts (10% default)
 * @returns {Promise<{ currentStreak: number, longestStreak: number }>}
 */
/**
 * Calculate nutrition goal streak (consecutive days meeting calorie goal).
 *
 * @param {number} calorieGoal
 * @param {number} [tolerance=0.1] - Fraction below goal still counts (10% default)
 * @returns {Promise<{ currentStreak: number, longestStreak: number }>}
 */
export const getNutritionStreak = async (calorieGoal, tolerance = 0.1) => {
  const db = await getDB();
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  const minCalories = calorieGoal * (1 - tolerance);

  const data = await db.getAllAsync(
    `SELECT 
       strftime('%Y-%m-%d', datetime(m.timestamp, 'unixepoch', 'localtime')) AS date,
       COALESCE(SUM(mf.calories), 0) AS calories
     FROM meals m
     LEFT JOIN meal_foods mf ON m.id = mf.meal_id
     WHERE m.timestamp >= ?
     GROUP BY date
     ORDER BY date DESC;`,
    [thirtyDaysAgo],
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let streakBroken = false;

  // Helper to get local date string (YYYY-MM-DD)
  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getLocalDateString(new Date());
  
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    
    const dayData = data.find(r => r.date === dateStr);
    const metGoal = dayData && dayData.calories >= minCalories;

    if (metGoal) {
      tempStreak++;
      if (!streakBroken) currentStreak = tempStreak;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      if (i === 0) {
        // Today doesn't count against streak if not over yet
        continue;
      }
      streakBroken = true;
      tempStreak = 0;
    }
  }

  return { currentStreak, longestStreak };
};
