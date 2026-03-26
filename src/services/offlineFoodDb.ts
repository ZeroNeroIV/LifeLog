// src/services/offlineFoodDb.ts
// Offline Food Database using bundled SQLite
// Uses expo-sqlite for local data storage

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export interface FoodItem {
  id: string;
  name: string;
  source: string;
  dataType: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fiber: number;
  sugars: number;
  fat: number;
  sodium: number;
  potassium: number;
  calcium: number;
  vitaminC: number;
  vitaminD: number;
  iron: number;
  caffeine: number;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  source: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fiber: number;
  fat: number;
}

/**
 * Initialize the offline food database
 */
export async function initOfflineFoodDb(): Promise<void> {
  if (db) return;
  try {
    db = await SQLite.openDatabaseAsync('foods.db');
    console.log('[OfflineFoodDB] Database opened successfully');
  } catch (error) {
    console.error('[OfflineFoodDB] Failed to open database:', error);
    throw error;
  }
}

/**
 * Search foods by name (case-insensitive, partial match)
 */
export async function searchFoods(query: string, limit: number = 20): Promise<FoodSearchResult[]> {
  if (!db) await initOfflineFoodDb();
  if (!db || !query || query.length < 2) return [];
  
  try {
    const results = await db.getAllAsync<FoodSearchResult>(
      `SELECT id, name, source, calories, protein, carbohydrates, fiber, fat 
       FROM foods 
       WHERE name LIKE ? 
       ORDER BY 
         CASE WHEN name LIKE ? THEN 0 ELSE 1 END,
         calories DESC
       LIMIT ?`,
      [`%${query}%`, `${query}%`, limit]
    );
    return results;
  } catch (error) {
    console.error('[OfflineFoodDB] Search failed:', error);
    return [];
  }
}

/**
 * Get full food details by ID
 */
export async function getFoodById(id: string): Promise<FoodItem | null> {
  if (!db) await initOfflineFoodDb();
  if (!db || !id) return null;
  
  try {
    const result = await db.getFirstAsync<FoodItem>(
      `SELECT * FROM foods WHERE id = ?`,
      [id]
    );
    return result || null;
  } catch (error) {
    console.error('[OfflineFoodDB] Get by ID failed:', error);
    return null;
  }
}

/**
 * Check if database is available
 */
export async function isOfflineDbAvailable(): Promise<boolean> {
  try {
    if (!db) db = await SQLite.openDatabaseAsync('foods.db');
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM foods');
    return (result?.count || 0) > 0;
  } catch {
    return false;
  }
}