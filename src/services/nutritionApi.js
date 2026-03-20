// src/services/nutritionApi.js
// Multi-Tiered Nutrition API Fetcher
// Cascades across USDA -> Open Food Facts -> Local Mock Database

const USDA_DEMO_KEY = 'DEMO_KEY';

const FALLBACK_DRINKS = [
  { id: 'mock-1', name: 'Espresso', brand: 'Generic', water: { value: 98, unit: 'g' }, caffeine: { value: 212, unit: 'mg' }, vitaminC: null, sugar: null },
  { id: 'mock-2', name: 'Filter Coffee', brand: 'Generic', water: { value: 99, unit: 'g' }, caffeine: { value: 40, unit: 'mg' }, vitaminC: null, sugar: null },
  { id: 'mock-3', name: 'Green Tea', brand: 'Generic', water: { value: 99, unit: 'g' }, caffeine: { value: 12, unit: 'mg' }, vitaminC: null, sugar: null },
  { id: 'mock-4', name: 'Orange Juice', brand: 'Generic', water: { value: 88, unit: 'g' }, caffeine: null, vitaminC: { value: 50, unit: 'mg' }, sugar: { value: 9, unit: 'g' } },
  { id: 'mock-5', name: 'Cola Soda', brand: 'Generic', water: { value: 90, unit: 'g' }, caffeine: { value: 8, unit: 'mg' }, vitaminC: null, sugar: { value: 11, unit: 'g' } },
  { id: 'mock-6', name: 'Energy Drink', brand: 'Monster', water: { value: 85, unit: 'g' }, caffeine: { value: 32, unit: 'mg' }, vitaminC: { value: 30, unit: 'mg' }, sugar: { value: 11, unit: 'g'} },
];

/**
 * USDA FoodData Central
 * Highly accurate scientific data, but rate-limited (30/hour on DEMO KEY)
 */
async function fetchUSDA(query) {
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${USDA_DEMO_KEY}&pageSize=15`);
  if (!res.ok) throw new Error('USDA API Rate Limit Reached');
  
  const data = await res.json();
  if (!data.foods || data.foods.length === 0) return [];
  
  return data.foods.map(f => {
      const getNutrient = (nameSnippet) => {
         const n = f.foodNutrients.find(n => n.nutrientName.toLowerCase().includes(nameSnippet.toLowerCase()));
         return n ? { value: n.value, unit: n.unitName.toLowerCase() } : null;
      };
      
      return {
        id: `usda-${f.fdcId}`,
        name: f.description,
        brand: f.brandOwner || '',
        water: getNutrient('water'),
        caffeine: getNutrient('caffeine'),
        vitaminC: getNutrient('vitamin c'),
        sugar: getNutrient('sugars, total')
      };
  });
}

/**
 * Open Food Facts API
 * Fully free, unauthenticated crowdsourced global barcode database.
 */
async function fetchOpenFoodFacts(query) {
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15`);
  if (!res.ok) throw new Error('Open Food Facts API Error');
  
  const data = await res.json();
  if (!data.products || data.products.length === 0) return [];

  // OFF provides numeric values usually normalized to per 100g, natively measured in grams.
  // Caffeine and Vitamin C are extremely small so they are returned as grams by OFF. Note: 1g = 1000mg.
  return data.products.map(p => {
    return {
      id: `off-${p._id}`,
      name: p.product_name || query,
      brand: p.brands || '',
      water: null, // Open Food Facts rarely tracks explicit raw water content. We'll implicitly calculate it to 90% in the UI.
      caffeine: (p.nutriments?.caffeine_100g || p.nutriments?.caffeine_value) ? { value: (p.nutriments.caffeine_100g || p.nutriments.caffeine_value) * 1000, unit: 'mg' } : null,
      vitaminC: p.nutriments?.['vitamin-c_100g'] ? { value: p.nutriments['vitamin-c_100g'] * 1000, unit: 'mg' } : null,
      sugar: p.nutriments?.sugars_100g ? { value: p.nutriments.sugars_100g, unit: 'g' } : null,
    };
  }).filter(p => p.name);
}

/**
 * Orchestrator fetching function. Combines all database sources into a bulletproof pipeline.
 * @param {string} query Search text
 * @returns {Promise<Array>} List of parsed items mapped to standard nutritional values
 */
export const searchDrinks = async (query) => {
  if (!query || query.length < 2) return [];

  // 1. USDA (The Gold Standard)
  try {
    const usdaData = await fetchUSDA(query);
    if (usdaData?.length > 0) return usdaData;
  } catch (err) {
    console.warn("[USDA Failed. Cascading...]", err.message);
  }

  // 2. Open Food Facts (The Wikipedia of Food)
  try {
    const offData = await fetchOpenFoodFacts(query);
    if (offData?.length > 0) return offData;
  } catch (err) {
    console.warn("[Open Food Facts Failed. Cascading...]", err.message);
  }

  // 3. Fallback Mock Data (Guarantees the UI never spins indefinitely and always has something to show)
  console.warn("[Using Local Data Dictionary]");
  return FALLBACK_DRINKS.filter(d => d.name.toLowerCase().includes(query.toLowerCase()));
};
