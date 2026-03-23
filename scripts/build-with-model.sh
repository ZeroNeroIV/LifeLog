#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/build-with-model.sh - Build APK with bundled LLM models
#
# Downloads both primary and fallback Gemma models and bundles them into
# the Android APK so users don't need to download on first launch.
#
# Usage: ./scripts/build-with-model.sh [--release|--debug] [--primary-only]
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Configuration
PRIMARY_URL="https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_S.gguf"
PRIMARY_FILENAME="gemma-2-2b-q4-small.gguf"
FALLBACK_URL="https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf"
FALLBACK_FILENAME="gemma-2-2b-q4-medium.gguf"
MODEL_DIR="android/app/src/main/assets/models"
BUILD_TYPE="release"
PRIMARY_ONLY=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --release) BUILD_TYPE="release" ;;
    --debug) BUILD_TYPE="debug" ;;
    --primary-only) PRIMARY_ONLY=true ;;
  esac
done

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

# Download function with size check
download_model() {
    local url="$1"
    local path="$2"
    local name="$3"
    local expected_size="$4"

    if [ -f "$path" ]; then
        local actual_size=$(stat -f%z "$path" 2>/dev/null || stat -c%s "$path" 2>/dev/null)
        if [ "$actual_size" -gt "$((expected_size * 90 / 100))" ]; then
            echo "✅ $name already exists ($(du -h "$path" | cut -f1))"
            return 0
        else
            echo "⚠️  $name exists but is incomplete, re-downloading..."
            rm "$path"
        fi
    fi

    echo "📥 Downloading $name (~$(echo "scale=1; $expected_size/1073741824" | bc)GB)..."
    echo "   This may take a while depending on your connection..."
    echo ""

    curl -L --progress-bar -o "$path" "$url"

    if [ $? -eq 0 ]; then
        local size=$(du -h "$path" | cut -f1)
        echo "✅ $name downloaded successfully ($size)"
        return 0
    else
        echo "❌ Failed to download $name"
        rm -f "$path"
        return 1
    fi
}

# Download primary model
download_model "$PRIMARY_URL" "$MODEL_DIR/$PRIMARY_FILENAME" "Primary model (Q4_K_S)" 1300000000 || exit 1

# Download fallback model (unless --primary-only)
if [ "$PRIMARY_ONLY" = false ]; then
    download_model "$FALLBACK_URL" "$MODEL_DIR/$FALLBACK_FILENAME" "Fallback model (Q4_K_M)" 1500000000 || exit 1
fi

echo ""

# Run expo prebuild if android folder doesn't exist or is stale
if [ ! -d "android" ] || [ ! -f "android/app/build.gradle" ]; then
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
    if [ "$PRIMARY_ONLY" = false ]; then
        echo "📦 Bundled models: Primary (Q4_K_S) + Fallback (Q4_K_M)"
    else
        echo "📦 Bundled model: Primary (Q4_K_S) only"
    fi
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
