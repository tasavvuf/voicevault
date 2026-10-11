# VoiceVault 🎙️⚡

> **Enterprise-Grade, Offline-First AI Voice Intelligence System**  
> *Capture spoken thoughts offline, stream audio directly to cloud storage, synthesize actionable insights with Google Gemini, and retrieve notes via 768-dimensional semantic vector search.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB.svg?style=flat-square&logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020.svg?style=flat-square&logo=expo)](https://expo.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Flash%20%7C%20Embeddings-8E75C2.svg?style=flat-square&logo=google)](https://ai.google.dev/)
[![ImageKit](https://img.shields.io/badge/ImageKit-Media%20CDN-FF6B6B.svg?style=flat-square)](https://imagekit.io/)

---

## 🌟 Overview

**VoiceVault** is built from the ground up to solve the real-world shortcomings of mobile voice memos and AI transcription apps. Rather than depending on continuous high-speed internet or naive backend proxies, VoiceVault couples an **offline-first local database** with a **resilient background queue**, **direct-to-cloud signed media uploads**, and an **observable 4-stage multimodal AI pipeline**.

Whether you record in a subway tunnel or on airplane mode, your audio is safely committed to disk in milliseconds and seamlessly synchronized when network connectivity returns.

![VoiceVault Demo](docs/voicevault-demo.gif)

---

## 🏗️ High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   MOBILE CLIENT                                  │
│                                                                                  │
│   [ Native Audio Recorder ] ──▶ Local Sandboxed Storage (M4A)                    │
│                                           │                                      │
│                                           ▼                                      │
│                            [ Local SQLite WAL Database ]                         │
│                            (Optimistic write: < 20ms)                            │
│                                           │                                      │
│                                           ▼                                      │
│                            [ Durable Offline Retry Queue ]                       │
└───────────────────────────────────────────┬──────────────────────────────────────┘
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               │ [Primary: Direct-to-Cloud Upload]                       │ [Fallback Stream]
               ▼                                                         ▼
┌─────────────────────────────┐                         ┌───────────────────────────────────┐
│ ImageKit Edge Storage       │                         │ Express Cloud Backend (Render)    │
│ (HMAC-SHA1 Signed Token)    │                         │                                   │
│ Direct Client OkHttp Stream │                         │ - JWT Authentication              │
└──────────────┬──────────────┘                         │ - Rate Limiting & Zod Validation  │
               │ (Public HTTPS URL)                     │ - Background AI Orchestrator      │
               ▼                                        └─────────────────┬─────────────────┘
┌─────────────────────────────┐                                           │
│ Express Metadata Gateway    │ ◀─────────────────────────────────────────┘
│ (POST /notes - 100B JSON)   │
└──────────────┬──────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             MULTIMODAL AI PIPELINE                               │
│                                                                                  │
│   [ Stage 1: Audio Ingestion ] ──▶ Gemini Files API                              │
│   [ Stage 2: Transcription ]   ──▶ Gemini 2.5 Flash (Verbatim Speech-to-Text)    │
│   [ Stage 3: Knowledge Synth ] ──▶ Gemini Flash-Lite (Title, Summary, Tasks)     │
│   [ Stage 4: Vector Indexing ] ──▶ Gemini Embedding (768-dim Vector Embeddings)  │
│                                                                                  │
│                                           │                                      │
│                                           ▼                                      │
│                             [ MongoDB Replica Set ]                              │
│                             (Indexed Vector & Document Store)                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Engineering Highlights

### 1. Offline-First Resilience & Optimistic UI
* **Zero UI Latency:** Tapping "Stop" commits the audio file and metadata synchronously to local SQLite in under **20ms** before any network operations run.
* **Self-Healing Native SQLite:** Solved native C++ shared object invalidation across Fast Refresh cycles with an atomic connection validation health check.
* **Autonomous Retry Queue:** NetInfo-driven network listener retries interrupted uploads with exponential backoff and jitter.

### 2. Direct-to-Cloud Signed Uploads (Zero-Bandwidth Backend)
* **The Problem:** Streaming 5–10 MB multipart audio payloads through small 512 MB Node.js containers leads to CPU throttling, memory spikes, and socket timeouts.
* **The Solution:** The mobile client fetches a cryptographic HMAC-SHA1 signature token from `/auth/imagekit`, streams audio directly to ImageKit CDN via native OkHttp drivers, and notifies the backend with a 100-byte JSON payload. Server memory and bandwidth overhead are reduced by **> 95%**.

### 3. Observable 4-Stage Multimodal AI Pipeline
Replaced black-box spinning loaders with a transparent, observable telemetry dashboard:
* **Stage 1 (Ingestion):** Direct CDN streaming and audio allocation.
* **Stage 2 (Transcription):** `Gemini 2.5 Flash` with deterministic system instructions (`temp: 0.1`) that transcribe spoken audio word-for-word without conversational replies.
* **Stage 3 (Knowledge Synthesis):** `Gemini Flash-Lite` extracting clean titles, executive summaries, topical tags, and interactive action items via strict JSON Schema.
* **Stage 4 (Semantic Vector Index):** `Gemini Embedding` generating 768-dimensional semantic search vectors for instant cosine-similarity matching.

### 4. Real-Time Network & API Telemetry
* Subscribed live event emitter instrumenting all outbound network activity.
* Shows active HTTP endpoints (`POST /notes`, `upload.imagekit.io`), response status codes, live duration timers, and cold-start warnings in the UI.

---

## 📂 Repository Structure

```
voicevault/
├── src/                               # React Native (Expo) Client
│   ├── api/client.ts                  # Authenticated API client & network telemetry emitter
│   ├── app/                           # Expo Router filesystem-based pages
│   │   ├── (tabs)/index.tsx           # Home dashboard with live queue banner & telemetry
│   │   ├── (tabs)/search.tsx          # Real-time semantic vector search screen
│   │   ├── note/[id].tsx              # Note detail, audio playback & 4-stage pipeline stepper
│   │   └── record.tsx                 # Voice recorder with animated waveform indicators
│   ├── audio/recorder.ts              # Audio recording constraints & duration formatters
│   ├── components/                    # Reusable design tokens, cards, and icon components
│   ├── db/schema.ts                   # SQLite schema, atomic connection singleton & migrations
│   ├── db/notesRepo.ts                # Local repository layer (queries, updates, transactions)
│   ├── queue/uploadQueue.ts           # Resilient background upload and sync daemon
│   └── store/auth.ts                  # SecureStore-persisted Zustand authentication state
├── server/                            # Node.js Express Backend
│   ├── src/config.js                  # Environment configuration & startup assertions
│   ├── src/models/                    # Mongoose models (User, Note with vector indexes)
│   ├── src/routes/                    # Express REST endpoints (auth, notes, search, imagekit)
│   └── src/services/                  # Gemini AI pipeline (transcribe, summarize, embed)
└── docs/                              # Architecture specs, diagrams, and assets
    └── ARCHITECTURE.md                # In-depth system design & incident post-mortems
```

---

## 🛠️ API Specification

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register new user account and return JWT |
| `POST` | `/auth/login` | Public | Authenticate user credentials and return JWT |
| `GET` | `/auth/imagekit` | Bearer | Generate HMAC-SHA1 upload signature token for Direct-to-Cloud upload |
| `POST` | `/notes` | Bearer | Ingest note (`audioUrl` or multipart `audio`); returns HTTP 202 `processing` |
| `GET` | `/notes` | Bearer | Cursor-paginated notes list for logged-in user |
| `GET` | `/notes/:id` | Bearer | Retrieve note details, AI stage, summary, and action items |
| `PATCH` | `/notes/:id/action-items` | Bearer | Toggle checklist state of action items |
| `POST` | `/search` | Bearer | Execute 768-dim semantic vector search across notes |
| `DELETE`| `/notes/:id` | Bearer | Delete note and associated assets |

---

## ⚡ Getting Started

### 1. Prerequisites
* **Node.js:** v18.0.0 or later
* **Package Manager:** npm or yarn
* **MongoDB:** Local instance or MongoDB Atlas connection URI
* **Google Gemini API Key:** From [Google AI Studio](https://aistudio.google.com/)

### 2. Backend Setup
```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Configure your `server/.env`:
```env
PORT=4000
MONGODB_URI=your_mongodb_atlas_uri
JWT_SECRET=your_long_random_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
GEMINI_TRANSCRIPTION_MODEL=gemini-flash-latest
GEMINI_CHAT_MODEL=gemini-flash-lite-latest
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
```

### 3. Mobile App Setup
```bash
# Return to root directory
cd ..
npm install

# Start the Expo development server
EXPO_PUBLIC_API_URL=http://YOUR-LOCAL-IP:4000 npx expo start
```

*For Android emulator, use `http://10.0.2.2:4000`. For physical devices, use your local Wi-Fi IP address or production cloud URL.*

---

## 📱 Building the Android APK (EAS)

To produce an installable standalone APK for testing:

```bash
# Configure EAS CLI
npx eas-cli@latest build:configure

# Generate standalone Android APK
npx eas-cli@latest build --platform android --profile preview
```

---

## 📖 Deep-Dive Documentation

For complete technical specifications, incident post-mortems, and system design rationales, review:
* [Architecture Specifications & Incident Post-Mortems](docs/ARCHITECTURE.md)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
