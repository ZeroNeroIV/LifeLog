// ─────────────────────────────────────────────────────────────────────────────
// src/services/llm/modelDownload.ts  –  LLM Model Download Manager
// ─────────────────────────────────────────────────────────────────────────────

import { File, Directory, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { getSetting, updateSetting } from "../../db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DownloadProgress {
  status: 'idle' | 'downloading' | 'completed' | 'error';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

export interface ModelInfo {
  isDownloaded: boolean;
  isBundled?: boolean;
  path?: string;
  name?: string;
  sizeBytes?: number;
}

interface ModelConfig {
  name: string;
  url: string;
  sizeBytes: number;
  filename: string;
}

// ─── Model Configuration ──────────────────────────────────────────────────────

const MODELS: Record<string, ModelConfig> = {
  primary: {
    name: "gemma-4-E2B-q4-small",
    url: "https://huggingface.co/bartowski/google_gemma-4-E2B-it-GGUF/resolve/main/google_gemma-4-E2B-it-Q4_K_S.gguf",
    sizeBytes: 3_380_000_000,
    filename: "gemma-4-E2B-q4-small.gguf",
  },
  fallback: {
    name: "gemma-4-E2B-q4-medium",
    url: "https://huggingface.co/bartowski/google_gemma-4-E2B-it-GGUF/resolve/main/google_gemma-4-E2B-it-Q4_K_M.gguf",
    sizeBytes: 3_460_000_000,
    filename: "gemma-4-E2B-q4-medium.gguf",
  },
};

const BUNDLED_MODELS = [
  { filename: "gemma-4-E2B-q4-small.gguf", type: "primary" as const },
  { filename: "gemma-4-E2B-q4-medium.gguf", type: "fallback" as const },
];

const MODEL_DIR = new Directory(Paths.document, 'models');

// ─── Helper Functions ─────────────────────────────────────────────────────────

const ensureModelDir = async (): Promise<void> => {
  if (!MODEL_DIR.exists) {
    MODEL_DIR.create({ intermediates: true });
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// ─── Public API ───────────────────────────────────────────────────────────────

const checkBundledModel = async (): Promise<{ path: string; type: 'primary' | 'fallback' } | null> => {
  // The model file is bundled in the APK at assets/models/gemma-4-E2B-q4-small.gguf
  // When the app is installed, Android unpacks assets to the app's internal storage
  // We need to find where it ended up
  
  const filename = 'gemma-4-E2B-q4-small.gguf';
  
  // Common locations where Android unpacks APK assets
  // The model is ~1.6GB so we can identify it by size
  const searchLocations = [
    // Expo/React Native asset directory
    { path: `.expo/${filename}`, base: Paths.document },
    { path: `.expo/${filename}`, base: Paths.cache },
    // Direct files directory
    { path: filename, base: Paths.document },
    { path: filename, base: Paths.cache },
    { path: `files/${filename}`, base: Paths.document },
  ];
  
  console.log('[Model] Searching for bundled model...');
  
  for (const loc of searchLocations) {
    try {
      const fullPath = loc.base + '/' + loc.path;
      const file = new File(fullPath);
      console.log('[Model] Checking:', file.uri, 'exists:', file.exists, 'size:', file.exists ? file.size : 0);
      
      if (file.exists && file.size > 1_000_000_000) {
        console.log('[Model] Found bundled model at:', file.uri, 'size:', file.size);
        return { path: file.uri, type: 'primary' };
      }
    } catch (e) {
      console.log('[Model] Error checking:', loc.path, e);
    }
  }
  
  // If we can't find it, return null and user will need to download
  console.log('[Model] Could not find bundled model');
  return null;
};

export const getModelInfo = async (): Promise<ModelInfo> => {
  console.log('[Model] getModelInfo called');
  
  // First check if we have a valid saved path from previous run
  const isDownloaded = (await getSetting("llm_model_downloaded")) === "true";
  const path = await getSetting("llm_model_path");
  
  if (isDownloaded && path) {
    // Check if saved path still works (for downloaded models in documents)
    const file = new File(path);
    console.log('[Model] Checking saved path:', file.uri, 'exists:', file.exists);
    if (file.exists && file.size > 1_000_000_000) {
      return {
        isDownloaded: true,
        path,
        name: path.includes("E2B-q4-small")
          ? MODELS.primary.name
          : MODELS.fallback.name,
        sizeBytes: file.size,
      };
    }
    // Saved path invalid, clear it
    console.log('[Model] Saved path invalid, clearing...');
    await updateSetting("llm_model_downloaded", "false");
    await updateSetting("llm_model_path", "");
  }

  // No valid saved path - try bundled model
  // In a properly built APK, the model exists at assets/models/
  console.log('[Model] Checking for bundled model...');
  const bundledPath = await checkBundledModel();
  
  if (bundledPath) {
    // Save that we found the bundled model
    await updateSetting("llm_model_downloaded", "true");
    await updateSetting("llm_model_path", bundledPath.path);
    return {
      isDownloaded: true,
      isBundled: true,
      path: bundledPath.path,
      name: "gemma-4-E2B-q4-small (bundled)",
      sizeBytes: MODELS.primary.sizeBytes,
    };
  }

  // No bundled model - need to download
  return { isDownloaded: false };
};

export const getModelSizes = (): { primary: number; fallback: number } => ({
  primary: MODELS.primary.sizeBytes,
  fallback: MODELS.fallback.sizeBytes,
});

export const downloadModel = async (
  onProgress: (progress: DownloadProgress) => void,
  modelType: 'primary' | 'fallback' = "primary",
): Promise<string> => {
  const model = MODELS[modelType];
  await ensureModelDir();

  const destFile = new File(MODEL_DIR, model.filename);
  const destPath = destFile.uri;

  if (destFile.exists) {
    const size = destFile.size;
    if (size > model.sizeBytes * 0.95) {
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
      try {
        await destFile.delete();
      } catch (e) {
        // Ignore delete errors
      }
    }
  }

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

    const downloadedFile = new File(result.uri);
    const fileSize = downloadedFile.size;
    if (fileSize < model.sizeBytes * 0.9) {
      throw new Error(
        `Downloaded file is smaller than expected (${formatBytes(fileSize)} vs ${formatBytes(model.sizeBytes)}) - may be corrupted`,
      );
    }

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
    let errorMessage = (error as Error).message;
    if ((error as Error).message?.includes("abort") || (error as Error).message?.includes("network")) {
      errorMessage = `Network error: ${(error as Error).message}. Check your internet connection and try again. Large file downloads (${formatBytes(model.sizeBytes)}) may require a stable connection.`;
    } else if ((error as Error).message?.includes("timeout")) {
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

export const deleteModel = async (): Promise<void> => {
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

export const getAvailableSpace = async (): Promise<number> => {
  const freeSpace = await LegacyFileSystem.getFreeDiskStorageAsync();
  return freeSpace;
};

export const checkSpaceForDownload = async (
  modelType: 'primary' | 'fallback' = "primary",
): Promise<{ hasSpace: boolean; available: number; required: number }> => {
  const available = await getAvailableSpace();
  const required = MODELS[modelType].sizeBytes;
  const requiredWithBuffer = required * 1.1;

  return {
    hasSpace: available >= requiredWithBuffer,
    available,
    required,
  };
};
