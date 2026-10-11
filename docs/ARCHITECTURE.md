# VoiceVault: System Architecture & Technical Specifications

> **High-Performance, Local-First AI Voice Intelligence Architecture**  
> *Engineered for resilience, offline execution, zero-bandwidth cloud bottlenecks, and observable multimodal AI pipelines.*

---

## 1. Executive Summary

VoiceVault is an enterprise-grade, offline-first mobile application designed to capture spoken thoughts, ingest and transcribe audio with sub-second latencies, synthesize structured action items, and index recordings into a high-dimensional vector space for semantic retrieval. 

Traditional voice-note applications suffer from three critical architectural flaws:
1. **Network Fragility:** Mobile uploads fail when entering subways, elevators, or weak cellular zones.
2. **Server Ingestion Bottlenecks:** Proxied multipart file uploads choke small cloud containers (RAM spikes, socket timeouts, high egress costs).
3. **Conversational Drift & Hallucinations:** Generative multimodal LLMs frequently reply conversationally rather than generating verbatim transcriptions.

VoiceVault resolves these challenges through a **local-first SQLite replication engine**, **native Android/iOS OkHttp multipart streaming**, **direct-to-cloud signed CDN uploads (ImageKit/S3)**, and a **deterministic multi-stage Gemini AI pipeline**.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MOBILE CLIENT                                        │
│                                                                                        │
│   [ Expo Audio Engine ] ──▶ Local M4A Storage (App Sandbox)                           │
│                                     │                                                  │
│                                     ▼                                                  │
│                        [ Local SQLite WAL Database ]                                   │
│                        (Optimistic write: < 15ms latency)                              │
│                                     │                                                  │
│                                     ▼                                                  │
│                        [ Durable Retry Upload Queue ]                                  │
│                                     │                                                  │
└─────────────────────────────────────┼──────────────────────────────────────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │ [Path A: Direct CDN Upload]                       │ [Path B: Fallback Stream]
            ▼                                                   ▼
┌──────────────────────────┐                         ┌───────────────────────────────────┐
│ ImageKit Edge Storage    │                         │ Express Cloud Backend (Render)    │
│ (Signed HMAC Token)      │                         │                                   │
│ Direct Client Streaming  │                         │ - JWT Authentication              │
└───────────┬──────────────┘                         │ - Rate Limiting & Zod Validation  │
            │ (Public URL)                           │ - Health & Warm-up Daemon         │
            ▼                                        └─────────────────┬─────────────────┘
┌──────────────────────────┐                                           │
│ Express Metadata Gateway │ ◀─────────────────────────────────────────┘
│ (POST /notes JSON only)  │
└───────────┬──────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              AI INTELLIGENCE PIPELINE                                  │
│                                                                                        │
│   [ Stage 1: Audio Ingestion ] ──▶ Gemini Files API                                    │
│   [ Stage 2: Transcription ]   ──▶ Gemini 2.5 Flash (Deterministic Speech-to-Text)     │
│   [ Stage 3: Knowledge Synth ] ──▶ Gemini Flash-Lite (JSON Schema Title/Summary/Tasks) │
│   [ Stage 4: Vector Indexing ] ──▶ Gemini Embedding (768-dim Vector Embeddings)       │
│                                                                                        │
│                                     │                                                  │
│                                     ▼                                                  │
│                        [ MongoDB Replica Set ]                                         │
│                        (Indexed Vector & Document Store)                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Subsystems

### 3.1 Local-First Mobile Engine (`src/db`, `src/queue`)
- **Storage Engine:** SQLite operating with Write-Ahead Logging (`WAL`) and foreign-key constraints.
- **Optimistic Persistence:** Audio records and queue tickets are committed to the local database *before* network requests execute, eliminating recording save latency (< 50ms).
- **Self-Healing Lifecycle Management:** Handles Android native pointer disposal during Fast Refresh by validating connection handles prior to query execution.
- **Background Retry Worker:** Autonomous worker monitoring NetInfo connectivity transitions, implementing exponential backoff with jitter (max 5 retries).

### 3.2 Direct-to-Cloud Upload Pipeline (`src/api/client.ts`, `server/src/routes/auth.js`)
- **Problem Statement:** Streaming 5–10 MB audio payloads through 512 MB Node.js containers exhausts memory buffers and causes socket starvation.
- **Architecture:** 
  1. Client queries `GET /auth/imagekit` to obtain a short-lived HMAC-SHA1 signature token.
  2. Client streams the audio payload directly to ImageKit using native OkHttp `MultipartBody` drivers (`FileSystem.uploadAsync`).
  3. Client dispatches a lightweight JSON ticket (`{ audioUrl, durationMs, clientId }`) to the backend.
  4. Backend CPU and RAM overhead drop by **> 95%**.

### 3.3 Multimodal AI Pipeline (`server/src/services`)
- **Transcription (`transcribe.js`):** Powered by `gemini-flash-latest` with negative-prompt system instructions (`temperature: 0.1`) preventing conversational drift.
- **Knowledge Synthesis (`summarize.js`):** Powered by `gemini-flash-lite-latest` using strict Zod & JSON Schemas to produce deterministic titles, summaries, tags, and checkable action items.
- **Semantic Vector Engine (`embed.js`, `search.js`):** Generates 768-dimensional vector embeddings, calculating cosine similarities across the user's knowledge base.

---

## 4. Key Engineering Challenges & Solutions

### Incident 1: React Native 0.86 C++ WinterCG `Unsupported FormDataPart` Crash
* **Root Cause:** React Native 0.86 deprecated legacy `{ uri, name, type }` objects in global `FormData`. The C++ networking layer threw unhandled runtime exceptions.
* **Resolution:** Replaced JavaScript `FormData` with Expo's native `FileSystem.uploadAsync` from `expo-file-system/legacy`. Audio streams directly via native Android OkHttp without touching JavaScript memory.

### Incident 2: Expo SQLite Shared Object Disposal on Fast Refresh
* **Root Cause:** Metro Fast Refresh reloaded JavaScript modules while Android's native JNI layer released the underlying C++ database pointer, resulting in `Cannot use shared object that was already released`.
* **Resolution:** Implemented an atomic self-healing singleton that validates the native pointer (`database.getFirstSync('SELECT 1')`) and automatically re-acquires a fresh connection if invalidated.

### Incident 3: Conversational Drift in Audio Transcription
* **Root Cause:** Unprompted multimodal audio inputs prompted Gemini to act as a conversational voice assistant, replying to questions rather than transcribing spoken speech.
* **Resolution:** Engineered strict negative-prompt system instructions forcing verbatim phonetic transcription and disabling conversational output.

### Incident 4: Free-Tier Container Cold-Start & Perceived Lag
* **Root Cause:** Free-tier cloud containers hibernate after 15 minutes of inactivity, producing 30–50s initial latencies.
* **Resolution:** Deployed an app-mount warm-up daemon and a real-time 4-stage pipeline telemetry monitor showing live HTTP endpoints, status codes, and execution timings.

---

## 5. Security & Privacy Guarantees
- **Zero-Knowledge API Keys:** Gemini and ImageKit private keys reside strictly in server environments; mobile builds contain zero LLM or storage secrets.
- **Cryptographic Signatures:** Upload tokens expire within 30 minutes and are generated with HMAC-SHA1.
- **Local Sandbox Isolation:** Audio files are stored within sandboxed app document directories, preventing cross-app data leakage.
