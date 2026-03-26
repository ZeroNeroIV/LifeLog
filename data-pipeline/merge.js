const fs = require('fs-extra');
const path = require('path');
const { parse } = require('csv-parse/sync');
const Database = require('better-sqlite3');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
}

function loadUSDA() {
  console.log('Loading USDA Foundation Foods...');
  const basePath = path.join(__dirname, '../data/usda/foundation_foods/FoodData_Central_foundation_food_csv_2025-12-18');
  
  const foods = parseCSV(path.join(basePath, 'food.csv'));
  const foodNutrients = parseCSV(path.join(basePath, 'food_nutrient.csv'));
  
  console.log(`  ${foods.length} foods, ${foodNutrients.length} nutrient records`);
  
  const foodNutrientMap = {};
  foodNutrients.forEach(fn => {
    if (!foodNutrientMap[fn.fdc_id]) foodNutrientMap[fn.fdc_id] = {};
    foodNutrientMap[fn.fdc_id][fn.nutrient_id] = parseFloat(fn.amount) || 0;
  });
  
  const usdaFoods = [];
  foods.forEach(food => {
    const nutrients = foodNutrientMap[food.fdc_id] || {};
    const hasNutrients = Object.values(nutrients).some(v => v > 0);
    if (!hasNutrients) return;
    
    usdaFoods.push({
      id: `usda:${food.fdc_id}`,
      name: food.description,
      source: 'USDA Foundation',
      dataType: food.data_type,
      calories: nutrients['1008'] || 0,
      protein: nutrients['1003'] || 0,
      carbohydrates: nutrients['1005'] || 0,
      fiber: nutrients['1079'] || 0,
      sugars: nutrients['1063'] || 0,
      fat: nutrients['1004'] || 0,
      sodium: nutrients['1093'] || 0,
      potassium: nutrients['1092'] || 0,
      calcium: nutrients['1087'] || 0,
      vitaminC: nutrients['1162'] || 0,
      vitaminD: nutrients['1114'] || 0,
      iron: nutrients['1089'] || 0,
      caffeine: nutrients['1057'] || 0,
    });
  });
  
  console.log(`  ${usdaFoods.length} foods with nutrients`);
  return usdaFoods;
}

function loadOpenNutrition() {
  console.log('Loading OpenNutrition...');
  const filePath = path.join(__dirname, '../data/opennutrition/opennutrition/opennutrition_foods.tsv');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const openFoods = [];
  
  for (let i = 1; i < lines.length; i++) {
    try {
      const parts = lines[i].split('\t');
      const [id, name, , , , , , nutritionJson] = parts;
      if (!nutritionJson) continue;
      
      const nutrition = JSON.parse(nutritionJson);
      
      openFoods.push({
        id: `open:${id}`,
        name: name,
        source: 'OpenNutrition',
        dataType: 'generic',
        calories: nutrition.calories || 0,
        protein: nutrition.protein || 0,
        carbohydrates: nutrition.carbohydrates || 0,
        fiber: nutrition.dietary_fiber || 0,
        sugars: nutrition.total_sugars || 0,
        fat: nutrition.total_fat || 0,
        sodium: nutrition.sodium || 0,
        potassium: nutrition.potassium || 0,
        calcium: nutrition.calcium || 0,
        vitaminC: nutrition.vitamin_c || 0,
        vitaminD: nutrition.vitamin_d || 0,
        iron: nutrition.iron || 0,
        caffeine: nutrition.caffeine || 0,
      });
    } catch (e) {}
  }
  
  console.log(`  ${openFoods.length} foods`);
  return openFoods;
}

function mergeAndExport(usdaFoods, openFoods) {
  console.log('\nMerging datasets...');
  
  const foodMap = new Map();
  usdaFoods.forEach(f => foodMap.set(f.name.toLowerCase().trim(), f));
  
  let added = 0;
  openFoods.forEach(f => {
    const key = f.name.toLowerCase().trim();
    if (!foodMap.has(key)) {
      foodMap.set(key, f);
      added++;
    }
  });
  
  const merged = Array.from(foodMap.values());
  console.log(`  Total: ${merged.length} foods (${added} from OpenNutrition)`);
  
  console.log('\nExporting to SQLite...');
  const dbPath = path.join(__dirname, '../data/sqlite/foods.db');
  fs.ensureDirSync(path.dirname(dbPath));
  if (fs.existsSync(dbPath)) fs.removeSync(dbPath);
  
  const db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE foods (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, source TEXT, dataType TEXT,
      calories REAL DEFAULT 0, protein REAL DEFAULT 0, carbohydrates REAL DEFAULT 0,
      fiber REAL DEFAULT 0, sugars REAL DEFAULT 0, fat REAL DEFAULT 0,
      sodium REAL DEFAULT 0, potassium REAL DEFAULT 0, calcium REAL DEFAULT 0,
      vitaminC REAL DEFAULT 0, vitaminD REAL DEFAULT 0, iron REAL DEFAULT 0,
      caffeine REAL DEFAULT 0
    );
    CREATE INDEX idx_foods_name ON foods(name);
  `);
  
  // Use batch insert with transaction for speed
  const insertMany = db.transaction((foods) => {
    const stmt = db.prepare(`INSERT INTO foods (id, name, source, dataType, calories, protein, carbohydrates, fiber, sugars, fat, sodium, potassium, calcium, vitaminC, vitaminD, iron, caffeine) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const f of foods) {
      stmt.run(f.id, f.name, f.source, f.dataType, f.calories || 0, f.protein || 0, f.carbohydrates || 0,
        f.fiber || 0, f.sugars || 0, f.fat || 0, f.sodium || 0, f.potassium || 0, f.calcium || 0, 
        f.vitaminC || 0, f.vitaminD || 0, f.iron || 0, f.caffeine || 0);
    }
  });
  
  insertMany(merged);
  
  console.log(`  Exported ${merged.length} foods`);
  db.close();
}

const usdaFoods = loadUSDA();
const openFoods = loadOpenNutrition();
mergeAndExport(usdaFoods, openFoods);
console.log('\n✅ Done! Database saved to data/sqlite/foods.db');