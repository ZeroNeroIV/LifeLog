<div align="center">
  <h1>🧬 Life-Log</h1>
  <p><strong>An ultra-fast, offline-first performance tracker built for deep focus, diet mapping, and emotional benchmarking.</strong></p>
</div>

Life-Log is a highly opinionated, zero-telemetry React Native application designed for total lifestyle oversight. It completely eliminates cloud latency by caching your entire multi-vector database securely on your device, leveraging pure SQLite architectures and deep Android OS integrations to map everything from your hourly Pomodoro focus sessions down to specific micro-nutritional ingestion variables seamlessly.

## ✨ Core Architecture & Features

- **⚡ Offline-First SQLite Engine**: Every metric (Water, Caffeine, Sugar, Vitamin C, Focus Time, Mood) maps instantly into a unified `logs` table driven by `expo-sqlite`, ensuring O(1) multi-metric insertions with exactly zero load screens. 
- **🍅 Lock-Screen Contoured Pomodoro**: A fully customizable focus interval timer that directly hijacks the Native Android Notification buffer. It pushes silent lock-screen widgets that dynamically track time and offer Native `Pause`/`Stop` payload intercepts securely from outside the app container.
- **🥑 Cascading Nutrition APIs**: Type any drink or food into the Live Search API and Life-Log instantly scrapes the **USDA FoodData Central** governmental database, seamlessly falling back onto Open Food Facts to automatically decouple your drinks into raw Vitamin C, Sugar, and Water vectors.
- **🌸 Time-Locked Mood Tracking**: A beautifully sculpted 5-scalar vibration tracker that physically paralyzes its own UI for exactly 1 hour post-submission, handing a perfect 60-minute time-bomb trigger directly to the Android OS to securely notify you when your next emotional log is available.
- **📊 Adaptive Performance Charts**: An instantly reactive Dashboard natively hooking into React Navigation Tab `useFocusEffect` lifecycles to physically re-query your schema on-the-fly and repaint beautiful SVG `react-native-gifted-charts` for every single daily metric simultaneously when the page regains focus.
- **🌙 Dynamic View Contexts**: Seamlessly toggles pure Dark / Light modes at the root level using a custom `ThemeProvider` injecting semantic alignment tokens dynamically across all components.

## 🚀 Installation & Build

Life-Log relies on cutting-edge Expo SDK 55 deep OS bridging mechanisms, meaning you **cannot** run this via the standard `Expo Go` simulator. You must compile the Native dependencies physically onto a device.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/life-log.git
   cd life-log
   ```

2. **Install dependencies:**
   *(Bun is highly recommended for massive speed gains)*
   ```bash
   bun install
   ```

3. **Compile the Native Application (Android):**
   ```bash
   bunx expo run:android
   ```
   *(Ensure your physical Android device is connected via USB debugging or your local simulator is actively booted).*

## 🛠️ Stack

- **Framework**: React Native / Expo (SDK 55)
- **Database**: `expo-sqlite`
- **Navigation**: Expo Router v3 (Tabs based)
- **Deep OS Links**: `expo-notifications`, `expo-haptics`, `expo-audio`
- **Visualization**: `react-native-gifted-charts`
- **Iconography**: `lucide-react-native`

## 🛡️ Privacy by Design

Life-Log features exactly **zero centralized telemetry**. Your mood scalars, your focus intervals, and your dietary consumption graphs never leave your device. Every single metric is locked physically into the internal hardware storage mapped to the device's specific local-time UNIX epoch constraints. 

---
*Built with aggressive local-first principles by ZeroNeroIV (Aka Alameen Sabbah).*
