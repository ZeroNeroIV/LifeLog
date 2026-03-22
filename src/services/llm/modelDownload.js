// ─────────────────────────────────────────────────────────────────────────────
// src/services/llm/modelDownload.js  –  LLM Model Download Manager
//
// Handles downloading Gemma models for on-device nutrition inference.
// Models are stored in the app's document directory and persist across updates.
// Also checks for bundled models in app assets.
// ─────────────────────────────────────────────────────────────────────────────

import { File, Directory, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { getSetting, updateSetting } from "../../db";

// ─── Model Configuration ──────────────────────────────────────────────────────

// Gemma 3n E2B quantized (primary) - optimized for edge/mobile
// Fallback: Gemma 2 2B quantized (smaller Q4_K_S for faster download)
const MODELS = {
  primary: {
    name: "gemma-2-2b-q4-medium",
    // Using Hugging Face as CDN - Gemma 2 2B Q4_K_M (balanced quality/size)
    url: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
    sizeBytes: 1_500_000_000, // ~1.5GB
    filename: "gemma-2-2b-q4-medium.gguf",
  },
  fallback: {
    name: "gemma-2-2b-q4-small",
    // Smaller Q4_K_S quantization for faster download and less storage
    url: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_S.gguf",
    sizeBytes: 1_300_000_000, // ~1.3GB
    filename: "gemma-2-2b-q4-small.gguf",
  },
};

// Bundled model asset path (if built with build-with-model.sh)
const BUNDLED_MODEL_ASSET = "models/gemma-2-2b-q4-medium.gguf";

// Directory where models are stored
const MODEL_DIR = new Directory(Paths.document, 'models');

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
  if (!MODEL_DIR.exists) {
    MODEL_DIR.create({ intermediates: true });
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
    const bundledFile = new File(Paths.bundle, 'assets', 'models', 'gemma-2-2b-q4-medium.gguf');
    if (bundledFile.exists) {
      return bundledFile.uri;
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
    const file = new File(path);
    if (file.exists) {
      const size = file.size;
      return {
        isDownloaded: true,
        path,
        name: path.includes("gemma-3n")
          ? MODELS.primary.name
          : MODELS.fallback.name,
        sizeBytes: size,
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

  const destFile = new File(MODEL_DIR, model.filename);
  const destPath = destFile.uri;

  // Check if already exists and is complete
  if (destFile.exists) {
    const size = destFile.size;
    if (size > model.sizeBytes * 0.95) {
      // File exists and is roughly the right size
      await updateSetting("llm_model_downloaded", "true");
      await updateSetting("llm_model_path", destPath);
      onProgress({
        status: "completed",
        progress: 1,
        downloadedBytes: size,
        totalBytes: size,
      });
      return destPath;
    } else {
      // Partial or corrupted file - delete it before redownloading
      try {
        await destFile.delete();
      } catch (e) {
        // Ignore delete errors, just try to download
      }
    }
  }

  // Start download - using legacy API for downloadResumable
  onProgress({
    status: "downloading",
    progress: 0,
    downloadedBytes: 0,
    totalBytes: model.sizeBytes,
  });

  const downloadResumable = LegacyFileSystem.createDownloadResumable(
    model.url,
    destPath,
    {
      headers: {
        'User-Agent': 'LifeLog/1.0',
      },
      // Increase timeout for large file downloads
      sessionType: LegacyFileSystem.FileSystemSessionType.BACKGROUND,
    },
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
    },
  );

  try {
    const result = await downloadResumable.downloadAsync();

    if (!result?.uri) {
      throw new Error("Download failed - no URI returned");
    }

    // Verify file size using new API
    const downloadedFile = new File(result.uri);
    const fileSize = downloadedFile.size;
    if (fileSize < model.sizeBytes * 0.9) {
      throw new Error(
        `Downloaded file is smaller than expected (${formatBytes(fileSize)} vs ${formatBytes(model.sizeBytes)}) - may be corrupted`,
      );
    }

    // Save settings
    await updateSetting("llm_model_downloaded", "true");
    await updateSetting("llm_model_path", result.uri);

    onProgress({
      status: "completed",
      progress: 1,
      downloadedBytes: fileSize,
      totalBytes: fileSize,
    });

    return result.uri;
  } catch (error) {
    // Provide more context for network errors
    let errorMessage = error.message;
    if (error.message?.includes("abort") || error.message?.includes("network")) {
      errorMessage = `Network error: ${error.message}. Check your internet connection and try again. Large file downloads (${formatBytes(model.sizeBytes)}) may require a stable connection.`;
    } else if (error.message?.includes("timeout")) {
      errorMessage = `Download timeout: The model file is large (${formatBytes(model.sizeBytes)}). Please ensure you have a stable internet connection and try again.`;
    }
    
    onProgress({
      status: "error",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: model.sizeBytes,
      error: errorMessage,
    });
    throw new Error(errorMessage);
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
    const file = new File(path);
    if (file.exists) {
      await file.delete();
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
  const freeSpace = await LegacyFileSystem.getFreeDiskStorageAsync();
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
