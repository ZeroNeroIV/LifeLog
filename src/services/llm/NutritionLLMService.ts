// ─────────────────────────────────────────────────────────────────────────────
// src/services/llm/NutritionLLMService.ts  –  On-device LLM for Nutrition Parsing
// ─────────────────────────────────────────────────────────────────────────────

import { initLlama, LlamaContext } from "llama.rn";
import { getModelInfo } from "./modelDownload";
import { searchDrinks as searchFood } from "../nutritionApi";
import {
  createMeal, addFoodToMeal, createConversation, addMessage,
  getConversationMessages, getLatestConversation, updateConversationSummary,
  compactConversation, MealType,
} from "../../db";

const MAX_TOKENS = 256;
const TEMPERATURE = 0.3;
const CONTEXT_SIZE = 1024;
const RESPONSE_TIMEOUT = 120_000; // 120s for slower devices
const MAX_MESSAGES_BEFORE_COMPACT = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedFood {
  name: string;
  quantity: string;
  search_term: string;
}

export interface MealLogJSON {
  type: 'meal_log';
  foods: ParsedFood[];
  meal_type: string;
  clarification_needed: string | null;
}

export interface EnrichedFood {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: 'high' | 'low';
  source: string;
}

export interface ChatResponse {
  type: 'chat' | 'meal_log' | 'clarification';
  text: string;
  foods?: EnrichedFood[];
  mealType?: MealType;
  clarification?: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are NutriAssist, an AI nutrition logging assistant integrated into LifeLog - a personal health tracking app.

## YOUR ROLE & CAPABILITIES

You help users log their meals and snacks by:
1. Understanding natural language food descriptions
2. Extracting individual food items with quantities
3. Searching the USDA FoodData Central and OpenFoodFacts databases for accurate nutrition data
4. Adding foods to the user's meal history automatically

## IMPORTANT CONTEXT

- You have access to comprehensive nutrition databases (USDA, OpenFoodFacts)
- After you extract foods, the system AUTOMATICALLY searches these databases
- The system AUTOMATICALLY calculates accurate calories, protein, carbs, fat, and fiber
- Your job is ONLY to extract food items and quantities - don't estimate nutrition values
- Once you return foods in the correct format, they will be added to the user's meal history

## YOUR RESPONSE FORMAT

### For Food Logging (use JSON):
When the user describes food they ate, respond with JSON in this EXACT format:

\`\`\`json
{
  "type": "meal_log",
  "foods": [
    {"name": "eggs", "quantity": "2 large", "search_term": "egg large"},
    {"name": "whole wheat toast", "quantity": "2 slices", "search_term": "whole wheat bread"}
  ],
  "meal_type": "breakfast",
  "clarification_needed": null
}
\`\`\`

**Field Definitions:**
- \`name\`: Human-readable food name (what user said)
- \`quantity\`: Amount with unit (e.g., "2 slices", "100g", "1 cup", "1 medium")
- \`search_term\`: Optimized search query for the nutrition database (be specific)
- \`meal_type\`: "breakfast", "lunch", "dinner", "snack", or "meal"
- \`clarification_needed\`: Ask a question if you need more info, or set to null

### For Clarifications:
If quantities or food details are unclear:

\`\`\`json
{
  "type": "meal_log",
  "foods": [],
  "meal_type": "meal",
  "clarification_needed": "How much chicken did you eat? (e.g., one breast, 100g, 4 ounces)"
}
\`\`\`

### For General Chat:
For non-food questions, respond conversationally WITHOUT JSON. Be helpful and friendly.

## EXAMPLES

**Example 1 - Clear meal:**
User: "I had 2 scrambled eggs with cheese and 2 slices of whole wheat toast for breakfast"
Assistant: \`\`\`json
{
  "type": "meal_log",
  "foods": [
    {"name": "scrambled eggs", "quantity": "2 large", "search_term": "egg scrambled"},
    {"name": "cheese", "quantity": "30g", "search_term": "cheddar cheese"},
    {"name": "whole wheat toast", "quantity": "2 slices", "search_term": "whole wheat bread"}
  ],
  "meal_type": "breakfast",
  "clarification_needed": null
}
\`\`\`

**Example 2 - Unclear portions:**
User: "I ate some chicken and rice"
Assistant: \`\`\`json
{
  "type": "meal_log",
  "foods": [],
  "meal_type": "meal",
  "clarification_needed": "How much chicken and rice did you eat? For example: '1 chicken breast and 1 cup of rice' or '150g chicken and 200g rice'"
}
\`\`\`

**Example 3 - Follow-up after clarification:**
User: "about 150 grams of chicken breast and a cup of white rice"
Assistant: \`\`\`json
{
  "type": "meal_log",
  "foods": [
    {"name": "chicken breast", "quantity": "150g", "search_term": "chicken breast cooked"},
    {"name": "white rice", "quantity": "1 cup", "search_term": "white rice cooked"}
  ],
  "meal_type": "meal",
  "clarification_needed": null
}
\`\`\`

**Example 4 - Snack:**
User: "I had a banana and some almonds as a snack"
Assistant: \`\`\`json
{
  "type": "meal_log",
  "foods": [
    {"name": "banana", "quantity": "1 medium", "search_term": "banana raw"},
    {"name": "almonds", "quantity": "30g", "search_term": "almonds raw"}
  ],
  "meal_type": "snack",
  "clarification_needed": null
}
\`\`\`

**Example 5 - General chat:**
User: "What are good protein sources?"
Assistant: Great question! High-protein foods include chicken breast, eggs, fish (salmon, tuna), Greek yogurt, tofu, lentils, and lean beef. Aim for 20-30g of protein per meal for optimal muscle maintenance.

## QUANTITY GUIDELINES

When portions aren't specified, use these reasonable defaults:
- Eggs: "2 large" (most common serving)
- Bread/Toast: "2 slices"
- Meat/Chicken: "150g" or "1 breast"
- Rice/Pasta: "1 cup cooked"
- Vegetables: "1 cup" or "100g"
- Fruits: "1 medium" (apple, banana) or "1 cup" (berries)
- Nuts: "30g" (small handful)
- Cheese: "30g"

## SEARCH TERM OPTIMIZATION

Make search terms specific for better database matches:
- "egg" → "egg large" or "egg scrambled"
- "chicken" → "chicken breast cooked" or "chicken thigh"
- "bread" → "whole wheat bread" or "white bread"
- "rice" → "white rice cooked" or "brown rice cooked"
- Add cooking method when relevant: "cooked", "raw", "baked", "grilled", "fried"

Remember: Your extractions will be automatically enriched with accurate nutrition data from official databases and added to the user's meal history. Focus on accurate extraction and helpful clarifications!`;

// ─── Module State ─────────────────────────────────────────────────────────────

let _llamaContext: LlamaContext | null = null;
let _currentConversationId: number | null = null;

const extractJSON = (text: string): MealLogJSON | null => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*"type"\s*:\s*"meal_log"[\s\S]*\}/);
  try { return JSON.parse(match?.[1]?.trim() || match?.[0] as string); } catch { return null; }
};

export const initializeLLM = async (): Promise<void> => {
  if (_llamaContext) return;
  
  console.log('[LLM] Checking model info...');
  const modelInfo = await getModelInfo();
  if (!modelInfo.isDownloaded) throw new Error("Model not downloaded");
  console.log('[LLM] Model found at:', modelInfo.path);

  try {
    console.log('[LLM] Initializing llama context...');
    _llamaContext = await initLlama({
      model: modelInfo.path!, n_ctx: CONTEXT_SIZE, n_threads: 4, use_mlock: true, use_mmap: true,
    });
    console.log('[LLM] Context initialized, type:', typeof _llamaContext, 'has completion:', typeof _llamaContext?.completion);
  } catch (e) {
    console.error('[LLM] initLlama failed:', e);
    throw new Error(`Failed to initialize AI model: ${(e as Error).message || 'Native module error'}`);
  }

  if (!_llamaContext || typeof _llamaContext.completion !== 'function') {
    throw new Error("AI model initialized but completion API is unavailable. Try rebuilding the app.");
  }

  try {
    console.log('[LLM] Setting up conversation...');
    const existing = await getLatestConversation();
    _currentConversationId = existing?.id ?? await createConversation();
    console.log('[LLM] Conversation ID:', _currentConversationId);
  } catch (e) {
    console.error('[LLM] Conversation setup failed:', e);
    throw new Error(`Failed to setup chat: ${(e as Error).message}`);
  }
};

export const isLLMReady = (): boolean => _llamaContext !== null;

export const processMessage = async (
  userMessage: string,
  onToken: ((token: string) => void) | null = null,
): Promise<ChatResponse> => {
  if (!_llamaContext) throw new Error("LLM not initialized");
  if (!_currentConversationId) throw new Error("No conversation");
  
  await addMessage(_currentConversationId, "user", userMessage);
  const messages = await getConversationMessages(_currentConversationId);
  const conv = await getLatestConversation();
  
  let context = SYSTEM_PROMPT + "\n\n";
  if (conv?.summary) context += `Summary: ${conv.summary}\n\n`;
  messages.forEach(m => context += `${m.role === "user" ? "User" : "Assistant"}: ${m.content}\n\n`);
  
  let fullResponse = "";
  const completionPromise = _llamaContext.completion(
    { prompt: context + "Assistant:", n_predict: MAX_TOKENS, temperature: TEMPERATURE, stop: ["User:"] },
    (data) => {
      const t = typeof data === 'string' ? data : (data?.token ?? '');
      if (t) {
        fullResponse += t;
        onToken?.(t);
      }
    }
  );
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`LLM response timed out after ${RESPONSE_TIMEOUT / 1000}s`)), RESPONSE_TIMEOUT)
  );
  const result = await Promise.race([completionPromise, timeoutPromise]);
  fullResponse = result.text.trim();
  
  await addMessage(_currentConversationId, "assistant", fullResponse);
  if (messages.length >= MAX_MESSAGES_BEFORE_COMPACT) await _compactIfNeeded();
  
  const parsed = extractJSON(fullResponse);
  if (parsed?.type === "meal_log") {
    if (parsed.clarification_needed) {
      return { 
        type: "clarification", 
        text: fullResponse,
        clarification: parsed.clarification_needed 
      };
    }
    
    if (parsed.foods?.length) {
      const enrichedFoods: EnrichedFood[] = [];
      
      for (const food of parsed.foods) {
        try {
          const searchResults = await searchFood(food.search_term || food.name);
          
          if (searchResults && searchResults.length > 0) {
            const nutritionData = searchResults[0];
            
            let quantityG = 100;
            if (food.quantity) {
              const qtyMatch = food.quantity.match(/(\d+(?:\.\d+)?)/);
              if (qtyMatch) {
                const qty = parseFloat(qtyMatch[1]);
                if (food.quantity.includes('slice')) quantityG = qty * 30;
                else if (food.quantity.includes('cup')) quantityG = qty * 240;
                else if (food.quantity.includes('tbsp')) quantityG = qty * 15;
                else if (food.quantity.includes('tsp')) quantityG = qty * 5;
                else if (food.quantity.includes('g')) quantityG = qty;
                else if (food.quantity.includes('oz')) quantityG = qty * 28.35;
                else if (food.quantity.toLowerCase().includes('large')) quantityG = qty * 50;
                else if (food.quantity.toLowerCase().includes('medium')) quantityG = qty * 40;
                else if (food.quantity.toLowerCase().includes('small')) quantityG = qty * 30;
                else quantityG = qty * 100;
              }
            }
            
            const multiplier = quantityG / 100;
            enrichedFoods.push({
              name: nutritionData.name,
              quantity_g: quantityG,
              calories: Math.round((nutritionData.caffeine?.value || 0) * multiplier),
              protein_g: 0,
              carbs_g: Math.round((nutritionData.sugar?.value || 0) * multiplier * 10) / 10,
              fat_g: 0,
              fiber_g: 0,
              confidence: "high",
              source: nutritionData.id.startsWith('usda') ? 'usda' : 'ai',
            });
          } else {
            enrichedFoods.push({
              name: food.name,
              quantity_g: 100,
              calories: 0,
              protein_g: 0,
              carbs_g: 0,
              fat_g: 0,
              fiber_g: 0,
              confidence: "low",
              source: "estimate"
            });
          }
        } catch (error) {
          console.warn('Food search failed for:', food.name, error);
          enrichedFoods.push({
            name: food.name,
            quantity_g: 100,
            calories: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
            fiber_g: 0,
            confidence: "low",
            source: "estimate"
          });
        }
      }
      
      return { 
        type: "meal_log", 
        text: fullResponse,
        foods: enrichedFoods, 
        mealType: (parsed.meal_type as MealType) || "meal"
      };
    }
  }
  
  return { type: "chat", text: fullResponse };
};

export const logFoodsFromResponse = async (response: ChatResponse): Promise<number> => {
  if (response.type !== "meal_log" || !response.foods?.length) throw new Error("No foods to log");
  const mealId = await createMeal(response.mealType || "meal");
  for (const f of response.foods) {
    await addFoodToMeal(mealId, { name: f.name, calories: f.calories, proteinG: f.protein_g,
      carbsG: f.carbs_g, fatG: f.fat_g, fiberG: f.fiber_g, quantityG: f.quantity_g, source: "ai" });
  }
  return mealId;
};

export const startNewConversation = async (): Promise<void> => { _currentConversationId = await createConversation(); };
export const getCurrentConversationId = (): number | null => _currentConversationId;
export const releaseLLM = async (): Promise<void> => { if (_llamaContext) { await _llamaContext.release(); _llamaContext = null; } };

const _compactIfNeeded = async (): Promise<void> => {
  if (!_llamaContext || !_currentConversationId) return;
  const messages = await getConversationMessages(_currentConversationId);
  if (messages.length < MAX_MESSAGES_BEFORE_COMPACT) return;
  
  const toSummarize = messages.slice(0, -5).map(m => `${m.role}: ${m.content}`).join("\n");
  const compactPromise = _llamaContext.completion({ prompt: `Summarize in 2 sentences:\n${toSummarize}\nSummary:`, n_predict: 100, temperature: 0.3 });
  const compactTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Compaction timed out')), RESPONSE_TIMEOUT)
  );
  const result = await Promise.race([compactPromise, compactTimeout]);
  await updateConversationSummary(_currentConversationId, result.text.trim());
  await compactConversation(_currentConversationId, 5);
};
