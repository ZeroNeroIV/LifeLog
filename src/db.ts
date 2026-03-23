// ─────────────────────────────────────────────────────────────────────────────
// src/db.ts  –  Life-Log  ·  SQLite persistence layer
//
// Compatible with expo-sqlite v15 / v16 (async API).
// Uses a module-level singleton so the database is opened exactly once and
// reused across the entire app lifetime, including background notification
// handlers that will be added in Step 5.
// ─────────────────────────────────────────────────────────────────────────────

import * as SQLite from "expo-sqlite";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogType = 'water' | 'caffeine' | 'mood' | 'focus' | 'vitamin_c' | 'sugar';
export type MealType = 'meal' | 'snack';
export type MessageRole = 'user' | 'assistant' | 'system';
export type FoodSource = 'usda' | 'ai' | 'custom';
export type FoodReportStatus = 'draft' | 'submitted' | 'resolved';

export interface LogEntry {
  id: number;
  type: string;
  value: number;
  timestamp: number;
}

export interface WeeklyDataPoint {
  date: string;
  total: number;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface FoodItem {
  id?: number;
  fdc_id?: string | null;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  quantity_g: number;
  source: FoodSource;
}

export interface FoodInput {
  name: string;
  fdcId?: string | null;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  quantityG?: number;
  source?: FoodSource;
}

export interface Meal {
  id: number;
  type: MealType;
  timestamp: number;
  notes: string | null;
  foods: FoodItem[];
}

export interface MealRow {
  meal_id: number;
  meal_type: MealType;
  meal_timestamp: number;
  notes: string | null;
  food_id: number | null;
  fdc_id: string | null;
  food_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  quantity_g: number | null;
  source: FoodSource | null;
}

export interface Conversation {
  id: number;
  summary: string | null;
  created_at: number;
  updated_at: number;
}

export interface ConversationMessage {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface FoodReport {
  id: number;
  name: string;
  ai_estimates: string | null;
  ingredients: string | null;
  photo_uri: string | null;
  notes: string | null;
  status: FoodReportStatus;
  github_issue_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface FoodReportInput {
  name: string;
  aiEstimates?: string | null;
  ingredients?: string | null;
  photoUri?: string | null;
  notes?: string | null;
}

export interface WeeklyNutritionPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionStreak {
  currentStreak: number;
  longestStreak: number;
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Return the open database handle, opening (and bootstrapping) it on first call.
 * Uses a promise-based singleton to prevent concurrent open attempts.
 */
export const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (_db) return _db;
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("lifelog.db");
      await _bootstrapSchema(db);
      return db;
    })();
  }
  _db = await _dbPromise;
  return _db;
};

// ─── Default Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: [string, string][] = [
  ["pomodoro_work_minutes", "25"],
  ["pomodoro_break_minutes", "5"],
  ["water_fav1_ml", "250"],
  ["water_fav2_ml", "500"],
  ["caffeine_fav1_mg", "80"],
  ["caffeine_fav2_mg", "160"],
  ["mood_check_enabled", "true"],
  ["mood_check_start_hour", "9"],
  ["mood_check_end_hour", "21"],
  ["mood_check_interval_minutes", "60"],
  ["nutrition_calorie_goal", "2000"],
  ["nutrition_protein_goal", "50"],
  ["nutrition_carbs_goal", "250"],
  ["nutrition_fat_goal", "65"],
  ["nutrition_fiber_goal", "30"],
  ["llm_model_downloaded", "false"],
  ["llm_model_path", ""],
  ["usda_db_downloaded", "false"],
  ["usda_db_path", ""],
];

// ─── Schema & Migration ──────────────────────────────────────────────────────

const SCHEMA_VERSION = 2;

const _bootstrapSchema = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");

  const vRow = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const installedVersion = vRow?.user_version ?? 0;

  if (installedVersion >= SCHEMA_VERSION) {
    return;
  }

  if (installedVersion < 1) {
    await db.execAsync("DROP INDEX IF EXISTS idx_logs_type_ts;");
    await db.execAsync("DROP TABLE IF EXISTS logs;");
    await db.execAsync("DROP TABLE IF EXISTS settings;");

    await db.execAsync(
      `CREATE TABLE logs (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        type      TEXT    NOT NULL,
        value     REAL    NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );`,
    );

    await db.execAsync(
      `CREATE INDEX idx_logs_type_ts ON logs (type, timestamp);`,
    );

    await db.execAsync(
      `CREATE TABLE settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );`,
    );

    for (const [key, value] of DEFAULT_SETTINGS) {
      await db.runAsync(
        "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);",
        [key, value],
      );
    }

    await db.execAsync("PRAGMA user_version = 1;");
  }

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

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS ai_conversations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      summary    TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );`,
  );

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

  for (const [key, value] of DEFAULT_SETTINGS) {
    await db.runAsync(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);",
      [key, value],
    );
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

export const initializeDB = async (): Promise<void> => {
  await getDB();
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  Logs
// ─────────────────────────────────────────────────────────────────────────────

export const addLog = async (type: LogType, value: number): Promise<number> => {
  const db = await getDB();
  const timestamp = Math.floor(Date.now() / 1000);

  const result = await db.runAsync(
    "INSERT INTO logs (type, value, timestamp) VALUES (?, ?, ?);",
    [type, value, timestamp],
  );

  return result.lastInsertRowId;
};

export const getWeeklyData = async (type: LogType): Promise<WeeklyDataPoint[]> => {
  const db = await getDB();
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  
  const aggregate = type === 'mood' ? 'AVG(value)' : 'SUM(value)';

  return await db.getAllAsync<WeeklyDataPoint>(
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

export const getTodayTotal = async (type: LogType): Promise<number> => {
  const db = await getDB();
  const startOfDay = Math.floor(
    new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000,
  );

  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(value), 0) AS total
     FROM logs
     WHERE type = ? AND timestamp >= ?;`,
    [type, startOfDay],
  );

  return row?.total ?? 0;
};

export const getTodayLogs = async (type: LogType): Promise<LogEntry[]> => {
  const db = await getDB();
  const startOfDay = Math.floor(
    new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000,
  );

  return await db.getAllAsync<LogEntry>(
    `SELECT *
     FROM logs
     WHERE type = ? AND timestamp >= ?
     ORDER BY timestamp DESC;`,
    [type, startOfDay],
  );
};

export const clearAllLogs = async (): Promise<void> => {
  const db = await getDB();
  
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM logs;");
    await db.runAsync("DELETE FROM meal_foods;");
    await db.runAsync("DELETE FROM meals;");
    await db.runAsync("DELETE FROM food_reports;");
    await db.runAsync("DELETE FROM ai_messages;");
    await db.runAsync("DELETE FROM ai_conversations;");
    await db.runAsync("DELETE FROM sqlite_sequence WHERE name IN ('logs', 'meals', 'meal_foods', 'food_reports', 'ai_conversations', 'ai_messages');");
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  Settings
// ─────────────────────────────────────────────────────────────────────────────

export const updateSetting = async (key: string, value: string | number | boolean): Promise<void> => {
  const db = await getDB();
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);",
    [key, String(value)],
  );
};

export const getSetting = async (key: string, defaultValue: string | null = null): Promise<string | null> => {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?;",
    [key],
  );
  return row?.value ?? defaultValue;
};

export const getAllSettings = async (): Promise<Record<string, string>> => {
  const db = await getDB();
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings;");
  return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  Meals & Nutrition
// ─────────────────────────────────────────────────────────────────────────────

export const createMeal = async (type: MealType, notes: string | null = null, timestamp: number | null = null): Promise<number> => {
  const db = await getDB();
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  
  const result = await db.runAsync(
    "INSERT INTO meals (type, notes, timestamp) VALUES (?, ?, ?);",
    [type, notes, ts],
  );
  
  return result.lastInsertRowId;
};

export const addFoodToMeal = async (mealId: number, food: FoodInput): Promise<number> => {
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

export const getMealWithFoods = async (mealId: number): Promise<Meal | null> => {
  const db = await getDB();
  
  const meal = await db.getFirstAsync<Meal>(
    "SELECT * FROM meals WHERE id = ?;",
    [mealId],
  );
  
  if (!meal) return null;
  
  const foods = await db.getAllAsync<FoodItem>(
    "SELECT * FROM meal_foods WHERE meal_id = ? ORDER BY id ASC;",
    [mealId],
  );
  
  return { ...meal, foods };
};

export const getTodayMeals = async (): Promise<Meal[]> => {
  const db = await getDB();
  const startOfDay = Math.floor(
    new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000,
  );
  
  const rows = await db.getAllAsync<MealRow>(
    `SELECT 
       m.id AS meal_id, m.type AS meal_type, m.timestamp AS meal_timestamp, m.notes,
       mf.id AS food_id, mf.fdc_id, mf.name AS food_name, mf.calories, 
       mf.protein_g, mf.carbs_g, mf.fat_g, mf.fiber_g, mf.quantity_g, mf.source
     FROM meals m
     LEFT JOIN meal_foods mf ON m.id = mf.meal_id
     WHERE m.timestamp >= ?
     ORDER BY m.timestamp DESC, mf.id ASC;`,
    [startOfDay],
  );

  const mealsMap = new Map<number, Meal>();
  for (const row of rows) {
    if (!mealsMap.has(row.meal_id)) {
      mealsMap.set(row.meal_id, {
        id: row.meal_id,
        type: row.meal_type,
        timestamp: row.meal_timestamp,
        notes: row.notes,
        foods: [],
      });
    }
    if (row.food_id) {
      mealsMap.get(row.meal_id)!.foods.push({
        id: row.food_id,
        fdc_id: row.fdc_id,
        name: row.food_name!,
        calories: row.calories!,
        protein_g: row.protein_g!,
        carbs_g: row.carbs_g!,
        fat_g: row.fat_g!,
        fiber_g: row.fiber_g!,
        quantity_g: row.quantity_g!,
        source: row.source!,
      });
    }
  }

  return Array.from(mealsMap.values());
};

export const getTodayNutritionTotals = async (): Promise<NutritionTotals> => {
  const db = await getDB();
  const startOfDay = Math.floor(
    new Date(new Date().setHours(0, 0, 0, 0)).getTime() / 1000,
  );
  
  const row = await db.getFirstAsync<NutritionTotals>(
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

export const deleteMeal = async (mealId: number): Promise<void> => {
  const db = await getDB();
  await db.runAsync("DELETE FROM meals WHERE id = ?;", [mealId]);
};

export const deleteFoodFromMeal = async (foodId: number): Promise<void> => {
  const db = await getDB();
  await db.runAsync("DELETE FROM meal_foods WHERE id = ?;", [foodId]);
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  –  AI Conversations
// ─────────────────────────────────────────────────────────────────────────────

export const createConversation = async (): Promise<number> => {
  const db = await getDB();
  const result = await db.runAsync(
    "INSERT INTO ai_conversations DEFAULT VALUES;",
  );
  return result.lastInsertRowId;
};

export const addMessage = async (conversationId: number, role: MessageRole, content: string): Promise<number> => {
  const db = await getDB();
  
  const result = await db.runAsync(
    "INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, ?, ?);",
    [conversationId, role, content],
  );
  
  await db.runAsync(
    "UPDATE ai_conversations SET updated_at = strftime('%s', 'now') WHERE id = ?;",
    [conversationId],
  );
  
  return result.lastInsertRowId;
};

export const getConversationMessages = async (conversationId: number): Promise<ConversationMessage[]> => {
  const db = await getDB();
  return await db.getAllAsync<ConversationMessage>(
    "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY timestamp ASC;",
    [conversationId],
  );
};

export const getLatestConversation = async (): Promise<Conversation | null> => {
  const db = await getDB();
  return await db.getFirstAsync<Conversation>(
    "SELECT * FROM ai_conversations ORDER BY updated_at DESC LIMIT 1;",
  );
};

export const updateConversationSummary = async (conversationId: number, summary: string): Promise<void> => {
  const db = await getDB();
  await db.runAsync(
    "UPDATE ai_conversations SET summary = ?, updated_at = strftime('%s', 'now') WHERE id = ?;",
    [summary, conversationId],
  );
};

export const compactConversation = async (conversationId: number, keepCount: number = 10): Promise<void> => {
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

export const createFoodReport = async (report: FoodReportInput): Promise<number> => {
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

export const getPendingFoodReports = async (): Promise<FoodReport[]> => {
  const db = await getDB();
  return await db.getAllAsync<FoodReport>(
    "SELECT * FROM food_reports WHERE status = 'draft' ORDER BY created_at DESC;",
  );
};

export const markFoodReportSubmitted = async (reportId: number, githubIssueUrl: string): Promise<void> => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE food_reports 
     SET status = 'submitted', github_issue_url = ?, updated_at = strftime('%s', 'now')
     WHERE id = ?;`,
    [githubIssueUrl, reportId],
  );
};

export const getWeeklyNutritionData = async (): Promise<WeeklyNutritionPoint[]> => {
  const db = await getDB();
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  return await db.getAllAsync<WeeklyNutritionPoint>(
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

export const getNutritionStreak = async (calorieGoal: number, tolerance: number = 0.1): Promise<NutritionStreak> => {
  const db = await getDB();
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  const minCalories = calorieGoal * (1 - tolerance);

  const data = await db.getAllAsync<{ date: string; calories: number }>(
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

  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
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
        continue;
      }
      streakBroken = true;
      tempStreak = 0;
    }
  }

  return { currentStreak, longestStreak };
};
