#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/build-with-model.sh - Build APK with bundled LLM model
#
# This script downloads the Gemma model and bundles it into the Android APK
# so users don't need to download it separately on first launch.
#
# Usage: ./scripts/build-with-model.sh [--release|--debug]
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Configuration
MODEL_URL="https://huggingface.co/google/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-q4_k_m.gguf"
MODEL_FILENAME="gemma-2-2b-q4.gguf"
MODEL_DIR="android/app/src/main/assets/models"
BUILD_TYPE="${1:-release}"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  LifeLog - Bundled Model APK Builder                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Create model directory
echo "📁 Creating model directory..."
mkdir -p "$MODEL_DIR"

# Download model if not exists
MODEL_PATH="$MODEL_DIR/$MODEL_FILENAME"
if [ -f "$MODEL_PATH" ]; then
    echo "✅ Model already exists at $MODEL_PATH"
    MODEL_SIZE=$(du -h "$MODEL_PATH" | cut -f1)
    echo "   Size: $MODEL_SIZE"
else
    echo "📥 Downloading Gemma model (~1.5GB)..."
    echo "   This may take a while depending on your connection..."
    echo ""
    
    # Download with progress
    curl -L --progress-bar -o "$MODEL_PATH" "$MODEL_URL"
    
    if [ $? -eq 0 ]; then
        MODEL_SIZE=$(du -h "$MODEL_PATH" | cut -f1)
        echo "✅ Model downloaded successfully ($MODEL_SIZE)"
    else
        echo "❌ Failed to download model"
        exit 1
    fi
fi

# Run expo prebuild if android folder doesn't exist or is stale
if [ ! -d "android" ] || [ ! -f "android/app/build.gradle" ]; then
    echo ""
    echo "🔧 Running expo prebuild..."
    npx expo prebuild --platform android --clean
fi

# Build APK
echo ""
echo "🏗️  Building $BUILD_TYPE APK..."
cd android

if [ "$BUILD_TYPE" = "release" ]; then
    ./gradlew assembleRelease
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
else
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
fi

cd ..

# Check if build succeeded
if [ -f "android/$APK_PATH" ]; then
    APK_SIZE=$(du -h "android/$APK_PATH" | cut -f1)
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  ✅ BUILD SUCCESSFUL                                          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📦 APK Location: android/$APK_PATH"
    echo "📏 APK Size: $APK_SIZE"
    echo ""
    echo "⚠️  Note: This APK includes the bundled model (~1.5GB)."
    echo "   Users won't need to download the model on first launch."
    echo ""
    
    # Copy to more accessible location
    mkdir -p dist
    cp "android/$APK_PATH" "dist/lifelog-with-model-$BUILD_TYPE.apk"
    echo "📋 Copied to: dist/lifelog-with-model-$BUILD_TYPE.apk"
else
    echo ""
    echo "❌ Build failed - APK not found"
    exit 1
fi
