<div align="center">
  <img src="https://raw.githubusercontent.com/ZeroNeroIV/LifeLog/main/assets/LogoIcon.png" width="120" alt="Life-Log Logo" />
  <h1>Life-Log</h1>
  <p><strong>Your personal offline-first lifestyle tracker</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Expo-SDK%2055-000020?style=flat&logo=expo" alt="Expo SDK" />
    <img src="https://img.shields.io/badge/React%20Native-0.83.2-61DAFB?style=flat&logo=react" alt="React Native" />
    <img src="https://img.shields.io/badge/Offline-SQLite-green?style=flat" alt="SQLite" />
    <img src="https://img.shields.io/badge/LLM-Llama.rn-orange?style=flat" alt="Local LLM" />
  </p>
</div>

Life-Log is a privacy-first, completely offline React Native application for tracking every aspect of your daily life — from deep focus sessions to nutritional intake, mood patterns, and hydration. No cloud, no telemetry, no dependencies on external services.

## ✨ Features

### 🏠 Home Dashboard
- **Daily motivation** with curated quotes (or fallback when offline)
- **Quick stats overview** — today's focus time, nutrition progress, mood, caffeine
- **Streak tracking** for consistent nutrition logging

### 📊 Performance Analytics
- Beautiful **interactive charts** for all your metrics:
  - Hydration trends (water intake)
  - Caffeine intake monitoring
  - Vitamin C levels
  - Sugar tracking
  - Emotional state over time

### 🍎 Nutrition Tracking
- **AI-powered nutrition chat** using a local LLM (llama.rn)
- **Food search** via USDA FoodData Central and Open Food Facts APIs
- **Quick-add buttons** for common foods and drinks
- **Meal history** with detailed macro breakdowns
- **Manual food entry** with custom portion sizes
- **Calorie & macro goals** (protein, carbs, fat, fiber)

### 🍅 Focus Timer
- **Pomodoro timer** with customizable work/break intervals
- **Multiple profiles** for different focus styles
- **Local notifications** to keep you on track

### ⚙️ Settings & Customization
- **Profile management** (name, username, email)
- **Dark/Light theme** toggle
- **Custom nutrition goals**
- **Water quick-add presets**
- **Data management** — clear metrics, meals, or all data

### 🌐 Privacy First
- **100% offline** — all data stays on your device
- **Zero telemetry** — no analytics, no tracking
- **SQLite database** — fast, reliable local storage

## 🚀 Getting Started

### Prerequisites
- **Node.js** (LTS recommended)
- **Bun** (optional, for faster installs)
- **Android SDK** (for building Android APK)
- A physical Android device or emulator

### Installation

```bash
# Clone the repository
git clone https://github.com/ZeroNeroIV/LifeLog.git
cd LifeLog

# Install dependencies
bun install    # recommended
# or
npm install

# Run on Android (requires device/emulator connected)
bunx expo run:android
```

### Building APK

```bash
# Generate native Android project
bunx expo prebuild --platform android

# Build debug APK
cd android && ./gradlew assembleDebug
```

The APK will be at `android/app/build/outputs/apk/debug/`.

## 📱 App Screens

| Tab | Description |
|-----|-------------|
| **Home** | Dashboard with daily summary, mood, caffeine, nutrition at-a-glance |
| **Performance** | Historical charts for all tracked metrics |
| **Nutrition** | Food logging, AI chat, meal history |
| **Focus** | Pomodoro timer for deep work sessions |
| **Settings** | Profile, theme, goals, data management |

## 🛠️ Tech Stack

- **Framework**: React Native with Expo SDK 55
- **Language**: TypeScript
- **Navigation**: Expo Router v3 (file-based routing)
- **Database**: expo-sqlite (local SQLite)
- **AI**: llama.rn (offline local LLM)
- **Charts**: react-native-gifted-charts
- **Icons**: lucide-react-native
- **Notifications**: expo-notifications
- **Haptics**: expo-haptics

## 📁 Project Structure

```
LifeLog/
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root layout with tabs
│   ├── index.tsx          # Home dashboard
│   ├── performance.tsx    # Analytics charts
│   ├── log.tsx           # Nutrition tracking
│   ├── focus.tsx         # Pomodoro timer
│   └── settings.tsx      # App settings
├── src/
│   ├── components/       # Reusable UI components
│   ├── services/         # LLM, food API, offline DB
│   ├── db.ts             # SQLite database layer
│   ├── notifications.ts  # Push notification handlers
│   ├── theme.tsx         # Theme provider
│   └── utils/            # Validation utilities
├── assets/               # Images, icons, splash
├── data/                 # USDA & Open Food Facts data
└── android/              # Native Android project
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue.

## 📄 License

MIT License — see LICENSE file for details.

---

*Built with 💜 by [ZeroNeroIV](https://github.com/ZeroNeroIV)*