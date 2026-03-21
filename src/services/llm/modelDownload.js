// ─────────────────────────────────────────────────────────────────────────────
// src/services/llm/modelDownload.js  –  LLM Model Download Manager
//
// Handles downloading Gemma models for on-device nutrition inference.
// Models are stored in the app's document directory and persist across updates.
// Also checks for bundled models in app assets.
// ─────────────────────────────────────────────────────────────────────────────

import * as FileSystem from "expo-file-system";
import { getSetting, updateSetting } from "../../db";

// ─── Model Configuration ──────────────────────────────────────────────────────

// Gemma 3n E2B quantized (primary) - optimized for edge/mobile
// Fallback: Gemma 2 2B quantized
const MODELS = {
  primary: {
    name: "gemma-3n-e2b-q4",
    // Using Hugging Face as CDN - replace with actual model URL when available
    url: "https://huggingface.co/anthropics/gemma-3n-e2b-it-Q4_K_M-GGUF/resolve/main/gemma-3n-e2b-it-q4_k_m.gguf",
    sizeBytes: 2_000_000_000, // ~2GB
    filename: "gemma-3n-e2b-q4.gguf",
  },
  fallback: {
    name: "gemma-2-2b-q4",
    url: "https://huggingface.co/google/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-q4_k_m.gguf",
    sizeBytes: 1_500_000_000, // ~1.5GB
    filename: "gemma-2-2b-q4.gguf",
  },
};

// Bundled model asset path (if built with build-with-model.sh)
const BUNDLED_MODEL_ASSET = "models/gemma-2-2b-q4.gguf";

// Directory where models are stored
const MODEL_DIR = `${FileSystem.documentDirectory}models/`;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DownloadProgress
 * @property {'idle' | 'downloading' | 'completed' | 'error'} status
 * @property {number} progress - 0 to 1
 * @property {number} downloadedBytes
 * @property {number} totalBytes
 * @property {string} [error]
 */

/**
 * @typedef {Object} ModelInfo
 * @property {boolean} isDownloaded
 * @property {string} [path]
 * @property {string} [name]
 * @property {number} [sizeBytes]
 */

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Ensure the models directory exists.
 */
const ensureModelDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }
};

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check for bundled model in app assets.
 * @returns {Promise<string | null>} Path to bundled model or null
 */
const checkBundledModel = async () => {
  try {
    // Check if bundled model exists in assets
    const bundledPath = `${FileSystem.bundleDirectory}assets/models/gemma-2-2b-q4.gguf`;
    const info = await FileSystem.getInfoAsync(bundledPath);
    if (info.exists) {
      return bundledPath;
    }
  } catch (e) {
    // No bundled model - that's fine, user will download
  }
  return null;
};

/**
 * Check if a model is already downloaded and available.
 *
 * @returns {Promise<ModelInfo>}
 */
export const getModelInfo = async () => {
  // First check if we have a saved model path
  const isDownloaded = (await getSetting("llm_model_downloaded")) === "true";
  const path = await getSetting("llm_model_path");

  if (isDownloaded && path) {
    // Verify the file still exists
    const fileInfo = await FileSystem.getInfoAsync(path);
    if (fileInfo.exists) {
      return {
        isDownloaded: true,
        path,
        name: path.includes("gemma-3n") ? MODELS.primary.name : MODELS.fallback.name,
        sizeBytes: fileInfo.size,
      };
    }
    // File was deleted - reset settings
    await updateSetting("llm_model_downloaded", "false");
    await updateSetting("llm_model_path", "");
  }

  // Check for bundled model
  const bundledPath = await checkBundledModel();
  if (bundledPath) {
    await updateSetting("llm_model_downloaded", "true");
    await updateSetting("llm_model_path", bundledPath);
    return {
      isDownloaded: true,
      path: bundledPath,
      name: "gemma-2-2b-q4 (bundled)",
      sizeBytes: MODELS.fallback.sizeBytes,
    };
  }

  return { isDownloaded: false };
};

/**
 * Get the expected download size for the primary model.
 *
 * @returns {{ primary: number, fallback: number }}
 */
export const getModelSizes = () => ({
  primary: MODELS.primary.sizeBytes,
  fallback: MODELS.fallback.sizeBytes,
});

/**
 * Download the LLM model with progress callback.
 *
 * @param {(progress: DownloadProgress) => void} onProgress
 * @param {'primary' | 'fallback'} [modelType='primary']
 * @returns {Promise<string>} Path to the downloaded model
 */
export const downloadModel = async (onProgress, modelType = "primary") => {
  const model = MODELS[modelType];
  await ensureModelDir();

  const destPath = `${MODEL_DIR}${model.filename}`;

  // Check if already exists
  const existing = await FileSystem.getInfoAsync(destPath);
  if (existing.exists && existing.size > model.sizeBytes * 0.95) {
    // File exists and is roughly the right size
    await updateSetting("llm_model_downloaded", "true");
    await updateSetting("llm_model_path", destPath);
    onProgress({
      status: "completed",
      progress: 1,
      downloadedBytes: existing.size,
      totalBytes: existing.size,
    });
    return destPath;
  }

  // Start download
  onProgress({
    status: "downloading",
    progress: 0,
    downloadedBytes: 0,
    totalBytes: model.sizeBytes,
  });

  const downloadResumable = FileSystem.createDownloadResumable(
    model.url,
    destPath,
    {},
    (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesWritten /
        downloadProgress.totalBytesExpectedToWrite;
      onProgress({
        status: "downloading",
        progress,
        downloadedBytes: downloadProgress.totalBytesWritten,
        totalBytes: downloadProgress.totalBytesExpectedToWrite,
      });
    }
  );

  try {
    const result = await downloadResumable.downloadAsync();

    if (!result?.uri) {
      throw new Error("Download failed - no URI returned");
    }

    // Verify file size
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (fileInfo.size < model.sizeBytes * 0.9) {
      throw new Error("Downloaded file is smaller than expected - may be corrupted");
    }

    // Save settings
    await updateSetting("llm_model_downloaded", "true");
    await updateSetting("llm_model_path", result.uri);

    onProgress({
      status: "completed",
      progress: 1,
      downloadedBytes: fileInfo.size,
      totalBytes: fileInfo.size,
    });

    return result.uri;
  } catch (error) {
    onProgress({
      status: "error",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: model.sizeBytes,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Delete the downloaded model to free up space.
 *
 * @returns {Promise<void>}
 */
export const deleteModel = async () => {
  const path = await getSetting("llm_model_path");

  if (path) {
    const fileInfo = await FileSystem.getInfoAsync(path);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  }

  await updateSetting("llm_model_downloaded", "false");
  await updateSetting("llm_model_path", "");
};

/**
 * Get available disk space.
 *
 * @returns {Promise<number>} Available bytes
 */
export const getAvailableSpace = async () => {
  const freeSpace = await FileSystem.getFreeDiskStorageAsync();
  return freeSpace;
};

/**
 * Check if there's enough space to download the model.
 *
 * @param {'primary' | 'fallback'} [modelType='primary']
 * @returns {Promise<{ hasSpace: boolean, available: number, required: number }>}
 */
export const checkSpaceForDownload = async (modelType = "primary") => {
  const available = await getAvailableSpace();
  const required = MODELS[modelType].sizeBytes;
  // Require 10% extra buffer
  const requiredWithBuffer = required * 1.1;

  return {
    hasSpace: available >= requiredWithBuffer,
    available,
    required,
  };
};
