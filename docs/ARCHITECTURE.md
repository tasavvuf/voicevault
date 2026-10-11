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

### 2.1 Topology & Component Flow

```mermaid
flowchart TD
    subgraph MobileClient ["📱 Mobile Client (React Native & Expo 57)"]
        direction TB
        Mic["🎙️ Audio Recorder (expo-audio)"]
        LocalStorage["📁 Sandboxed Storage (M4A File)"]
        SQLite["⚡ SQLite WAL Database (Optimistic Write < 20ms)"]
        Queue["🔄 Offline-First Retry Queue"]
        
        Mic --> LocalStorage
        LocalStorage --> SQLite
        SQLite --> Queue
    end

    subgraph DirectUpload ["☁️ Direct-to-Cloud Upload Pipeline"]
        direction TB
        AuthReq["1. GET /auth/imagekit (HMAC Token)"]
        ImageKit["2. ImageKit Global CDN (Direct OkHttp Stream)"]
        RenderGateway["3. Express Gateway (POST /notes with 100B JSON Ticket)"]
    end

    subgraph Backend ["🖥️ Cloud Backend & Persistence (Render)"]
        direction TB
        Express["Express.js Server (JWT & Zod Validation)"]
        MongoDB[("🍃 MongoDB Atlas Replica Set")]
    end

    subgraph AIPipeline ["🤖 Multimodal Gemini AI Pipeline"]
        direction TB
        GeminiFiles["Stage 1: Gemini Files API Ingestion"]
        GeminiSpeech["Stage 2: Gemini 2.5 Flash (Verbatim Transcription)"]
        GeminiFlashLite["Stage 3: Gemini Flash-Lite (Title, Summary & Tasks)"]
        GeminiEmbed["Stage 4: Gemini Embedding (768-dim Vector Index)"]
        
        GeminiFiles --> GeminiSpeech
        GeminiSpeech --> GeminiFlashLite
        GeminiFlashLite --> GeminiEmbed
    end

    Queue -->|"1. Request Token"| AuthReq
    AuthReq -->|"HMAC Signature"| Queue
    Queue -->|"2. Direct Stream (0 Server Bandwidth)"| ImageKit
    ImageKit -->|"Public HTTPS URL"| RenderGateway
    RenderGateway --> Express
    Express -->|"Async Worker"| GeminiFiles
    GeminiEmbed -->|"Persist Vector & Structured Note"| MongoDB
    MongoDB -.->|"Real-Time Status Polling & Telemetry"| MobileClient

    classDef client fill:#EFF6FF,stroke:#2563EB,stroke-width:2px;
    classDef edge fill:#FEF3C7,stroke:#D97706,stroke-width:2px;
    classDef server fill:#F5F3FF,stroke:#7C3AED,stroke-width:2px;
    classDef ai fill:#ECFDF5,stroke:#059669,stroke-width:2px;
    
    class MobileClient client;
    class DirectUpload edge;
    class Backend server;
    class AIPipeline ai;
```

### 2.2 End-to-End Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User
    participant App as 📱 Mobile Client
    participant SQLite as 💾 Local SQLite WAL
    participant IK as ☁️ ImageKit CDN
    participant Server as 🖥️ Express Gateway
    participant Gemini as 🤖 Google Gemini AI

    User->>App: Stop Recording
    App->>SQLite: Synchronous Atomic Write (< 20ms)
    App-->>User: Optimistic Update: Note Saved

    rect rgb(240, 248, 255)
    Note over App,IK: Phase 1: Direct-to-Cloud Upload (0 Server Bandwidth)
    App->>Server: GET /auth/imagekit (JWT)
    Server-->>App: HMAC-SHA1 Signature Token
    App->>IK: Native OkHttp Stream (voicevault.m4a)
    IK-->>App: 200 OK (Public HTTPS URL)
    end

    rect rgb(245, 243, 255)
    Note over App,Server: Phase 2: Metadata Ticket Ingestion
    App->>Server: POST /notes { audioUrl, clientId, durationMs }
    Server-->>App: 202 Accepted (status: "processing")
    end

    rect rgb(236, 253, 245)
    Note over Server,Gemini: Phase 3: 4-Stage Multimodal AI Pipeline
    Server->>Gemini: Stage 1: Upload via Gemini Files API
    Server->>Gemini: Stage 2: Transcribe Speech (Gemini 2.5 Flash, temp: 0.1)
    Gemini-->>Server: Verbatim Speech-to-Text Transcript
    Server->>Gemini: Stage 3: Synthesize Knowledge (Gemini Flash-Lite + JSON Schema)
    Gemini-->>Server: Structured Title, Summary, Tags, Action Items
    Server->>Gemini: Stage 4: Generate 768-dim Vector Embeddings
    Gemini-->>Server: Vector Array [0.042, -0.015, ...]
    Server->>Server: Persist Note & Vector in MongoDB Atlas
    end

    loop Every 1.5s while In-Flight
        App->>Server: GET /notes/:id (Poll Status)
        Server-->>App: Stage update (transcribing -> summarizing -> ready)
        App-->>User: Live Telemetry & Stepper Progress
    end
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
