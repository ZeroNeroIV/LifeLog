// ─────────────────────────────────────────────────────────────────────────────
// src/services/llm/NutritionLLMService.js  –  On-device LLM for Nutrition Parsing
// ─────────────────────────────────────────────────────────────────────────────

import { initLlama } from "llama.rn";
import { getModelInfo } from "./modelDownload";
import {
  createMeal, addFoodToMeal, createConversation, addMessage,
  getConversationMessages, getLatestConversation, updateConversationSummary,
  compactConversation,
} from "../../db";

const MAX_TOKENS = 512;
const TEMPERATURE = 0.3;
const CONTEXT_SIZE = 2048;
const MAX_MESSAGES_BEFORE_COMPACT = 20;

const SYSTEM_PROMPT = `You are a nutrition assistant. Parse food descriptions into JSON:
\`\`\`json
{"type":"meal_log","foods":[{"name":"...","quantity_g":100,"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"confidence":"high"}],"meal_type":"meal","clarification_needed":null}
\`\`\`
If unclear, set clarification_needed to a question. For chat, respond normally without JSON.
Guidelines: Egg=70cal/6p/0.5c/5f, Bread=80cal/3p/15c/1f, Rice(100g)=130cal/2.5p/28c, Chicken(100g)=165cal/31p/0c/3.6f`;

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
    return { type: parsed.clarification_needed ? "clarification" : "meal_log", text: fullResponse,
      foods: parsed.foods || [], mealType: parsed.meal_type || "meal", clarification: parsed.clarification_needed };
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
