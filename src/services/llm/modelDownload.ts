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
    name: "gemma-2-2b-q4-small",
    url: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_S.gguf",
    sizeBytes: 1_300_000_000,
    filename: "gemma-2-2b-q4-small.gguf",
  },
  fallback: {
    name: "gemma-2-2b-q4-medium",
    url: "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
    sizeBytes: 1_500_000_000,
    filename: "gemma-2-2b-q4-medium.gguf",
  },
};

const BUNDLED_MODELS = [
  { filename: "gemma-2-2b-q4-small.gguf", type: "primary" as const },
  { filename: "gemma-2-2b-q4-medium.gguf", type: "fallback" as const },
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
  for (const { filename, type } of BUNDLED_MODELS) {
    try {
      const bundledFile = new File(Paths.bundle, 'assets', 'models', filename);
      if (bundledFile.exists) {
        console.log('[Model] Found bundled model:', filename);
        return { path: bundledFile.uri, type };
      }
    } catch (e) {
      // Continue checking next model
    }
  }
  return null;
};

export const getModelInfo = async (): Promise<ModelInfo> => {
  const isDownloaded = (await getSetting("llm_model_downloaded")) === "true";
  const path = await getSetting("llm_model_path");

  if (isDownloaded && path) {
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
    await updateSetting("llm_model_downloaded", "false");
    await updateSetting("llm_model_path", "");
  }

  const bundledPath = await checkBundledModel();
  if (bundledPath) {
    await updateSetting("llm_model_downloaded", "true");
    await updateSetting("llm_model_path", bundledPath.path);
    return {
      isDownloaded: true,
      path: bundledPath.path,
      name: "gemma-2-2b-q4 (bundled)",
      sizeBytes: MODELS.fallback.sizeBytes,
    };
  }

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
