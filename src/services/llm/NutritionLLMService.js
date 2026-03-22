// ─────────────────────────────────────────────────────────────────────────────
// src/services/llm/NutritionLLMService.js  –  On-device LLM for Nutrition Parsing
// ─────────────────────────────────────────────────────────────────────────────

import { initLlama } from "llama.rn";
import { getModelInfo } from "./modelDownload";
import { searchFood } from "../nutritionApi";
import {
  createMeal, addFoodToMeal, createConversation, addMessage,
  getConversationMessages, getLatestConversation, updateConversationSummary,
  compactConversation,
} from "../../db";

const MAX_TOKENS = 512;
const TEMPERATURE = 0.3;
const CONTEXT_SIZE = 2048;
const MAX_MESSAGES_BEFORE_COMPACT = 20;

const SYSTEM_PROMPT = `You are a nutrition assistant. Parse user food descriptions and extract individual food items.

When the user describes a meal:
1. Extract each food item with estimated quantity
2. Ask clarifying questions if portions are unclear
3. Respond in this JSON format:

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

If you need clarification about portions or specific items, set "clarification_needed" to your question and set foods to empty array.

For general chat (not food logging), respond conversationally without JSON.

Examples:
User: "I had 2 eggs and toast for breakfast"
Response: {"type":"meal_log","foods":[{"name":"eggs","quantity":"2 large","search_term":"egg large"},{"name":"toast","quantity":"2 slices","search_term":"whole wheat bread"}],"meal_type":"breakfast","clarification_needed":null}

User: "I ate some chicken"
Response: {"type":"meal_log","foods":[],"meal_type":"meal","clarification_needed":"How much chicken did you eat? (e.g., one breast, 100g, 4 ounces)"}`;

let _llamaContext = null;
let _currentConversationId = null;

const extractJSON = (text) => {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*"type"\s*:\s*"meal_log"[\s\S]*\}/);
  try { return JSON.parse(match?.[1]?.trim() || match?.[0]); } catch { return null; }
};

export const initializeLLM = async () => {
  if (_llamaContext) return;
  const modelInfo = await getModelInfo();
  if (!modelInfo.isDownloaded) throw new Error("Model not downloaded");
  
  _llamaContext = await initLlama({
    model: modelInfo.path, n_ctx: CONTEXT_SIZE, n_threads: 4, use_mlock: true, use_mmap: true,
  });
  
  const existing = await getLatestConversation();
  _currentConversationId = existing?.id || await createConversation();
};

export const isLLMReady = () => _llamaContext !== null;

export const processMessage = async (userMessage, onToken = null) => {
  if (!_llamaContext) throw new Error("LLM not initialized");
  
  await addMessage(_currentConversationId, "user", userMessage);
  const messages = await getConversationMessages(_currentConversationId);
  const conv = await getLatestConversation();
  
  let context = SYSTEM_PROMPT + "\n\n";
  if (conv?.summary) context += `Summary: ${conv.summary}\n\n`;
  messages.forEach(m => context += `${m.role === "user" ? "User" : "Assistant"}: ${m.content}\n\n`);
  
  let fullResponse = "";
  const result = await _llamaContext.completion(
    { prompt: context + "Assistant:", n_predict: MAX_TOKENS, temperature: TEMPERATURE, stop: ["User:"] },
    (token) => { fullResponse += token.token; onToken?.(token.token); }
  );
  fullResponse = result.text.trim();
  
  await addMessage(_currentConversationId, "assistant", fullResponse);
  if (messages.length >= MAX_MESSAGES_BEFORE_COMPACT) await _compactIfNeeded();
  
  const parsed = extractJSON(fullResponse);
  if (parsed?.type === "meal_log") {
    // If clarification is needed, return early
    if (parsed.clarification_needed) {
      return { 
        type: "clarification", 
        text: fullResponse,
        clarification: parsed.clarification_needed 
      };
    }
    
    // If we have foods to search for, look them up in the nutrition database
    if (parsed.foods?.length) {
      const enrichedFoods = [];
      
      for (const food of parsed.foods) {
        try {
          // Search using the search_term or food name
          const searchResults = await searchFood(food.search_term || food.name);
          
          if (searchResults && searchResults.length > 0) {
            // Use the first (best) result
            const nutritionData = searchResults[0];
            
            // Convert quantity string to grams (rough estimation)
            let quantityG = 100; // default
            if (food.quantity) {
              const qtyMatch = food.quantity.match(/(\d+(?:\.\d+)?)/);
              if (qtyMatch) {
                const qty = parseFloat(qtyMatch[1]);
                // Rough conversions (can be improved)
                if (food.quantity.includes('slice')) quantityG = qty * 30;
                else if (food.quantity.includes('cup')) quantityG = qty * 240;
                else if (food.quantity.includes('tbsp')) quantityG = qty * 15;
                else if (food.quantity.includes('tsp')) quantityG = qty * 5;
                else if (food.quantity.includes('g')) quantityG = qty;
                else if (food.quantity.includes('oz')) quantityG = qty * 28.35;
                else if (food.quantity.toLowerCase().includes('large')) quantityG = qty * 50;
                else if (food.quantity.toLowerCase().includes('medium')) quantityG = qty * 40;
                else if (food.quantity.toLowerCase().includes('small')) quantityG = qty * 30;
                else quantityG = qty * 100; // assume per item = 100g
              }
            }
            
            // Calculate nutrition per quantity
            const multiplier = quantityG / 100;
            enrichedFoods.push({
              name: nutritionData.name,
              quantity_g: quantityG,
              calories: Math.round((nutritionData.calories || 0) * multiplier),
              protein_g: Math.round((nutritionData.protein?.value || 0) * multiplier * 10) / 10,
              carbs_g: Math.round((nutritionData.carbs?.value || 0) * multiplier * 10) / 10,
              fat_g: Math.round((nutritionData.fat?.value || 0) * multiplier * 10) / 10,
              fiber_g: Math.round((nutritionData.fiber?.value || 0) * multiplier * 10) / 10,
              confidence: "high",
              source: nutritionData.source
            });
          } else {
            // No results found, use LLM estimates
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
          // Add with zero values on error
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
        mealType: parsed.meal_type || "meal"
      };
    }
  }
  
  return { type: "chat", text: fullResponse };
};

export const logFoodsFromResponse = async (response) => {
  if (response.type !== "meal_log" || !response.foods?.length) throw new Error("No foods to log");
  const mealId = await createMeal(response.mealType || "meal");
  for (const f of response.foods) {
    await addFoodToMeal(mealId, { name: f.name, calories: f.calories, proteinG: f.protein_g,
      carbsG: f.carbs_g, fatG: f.fat_g, fiberG: f.fiber_g, quantityG: f.quantity_g, source: "ai" });
  }
  return mealId;
};

export const startNewConversation = async () => { _currentConversationId = await createConversation(); };
export const getCurrentConversationId = () => _currentConversationId;
export const releaseLLM = async () => { if (_llamaContext) { await _llamaContext.release(); _llamaContext = null; } };

const _compactIfNeeded = async () => {
  if (!_llamaContext || !_currentConversationId) return;
  const messages = await getConversationMessages(_currentConversationId);
  if (messages.length < MAX_MESSAGES_BEFORE_COMPACT) return;
  
  const toSummarize = messages.slice(0, -5).map(m => `${m.role}: ${m.content}`).join("\n");
  const result = await _llamaContext.completion({ prompt: `Summarize in 2 sentences:\n${toSummarize}\nSummary:`, n_predict: 100, temperature: 0.3 });
  await updateConversationSummary(_currentConversationId, result.text.trim());
  await compactConversation(_currentConversationId, 5);
};
