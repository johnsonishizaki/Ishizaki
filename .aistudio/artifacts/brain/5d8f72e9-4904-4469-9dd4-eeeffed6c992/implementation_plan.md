# Ishizaki Academic OS — Implementation Plan

Ishizaki is a private, single-user academic operating system engineered for one student's complete high school and college-prep trajectory towards WASSCE and the Digital SAT (targeting 2028). The core ethos is **simple interface, powerful intelligence underneath**—replacing cluttered dashboards with an event-driven learning cycle: understand → learn → practice → diagnose mistakes → repair weaknesses → retain knowledge → prepare for exams.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been confirmed via Phase 1 clarification:
> - **Cloud Persistence & Auth**: Firebase Authentication & Firestore via AI Studio integration as the remote master, backed by client-side IndexedDB for complete offline capability.
> - **Vault & B2 Storage**: Express server-side proxy managing Backblaze B2 S3-compatible API keys (`B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_ENDPOINT`), with transparent IndexedDB local blob caching.
> - **Curriculum Balancing Weight**: 65% allocation to West African Senior High School (WASSCE) curriculum and 35% allocation to Digital SAT preparation, dynamically adjusted by mastery and time-to-exam.
> - **Active Subjects**: Mathematics, Additional Mathematics, Physics, Chemistry, Biology, Computing, English Language, Social Studies, and SAT (Reading & Writing, Math). *Business Management is strictly excluded.*

---

## 1. Overview & Core Concept

Ishizaki rejects the standard multi-user, gamified EdTech paradigm (no public leaderboards, XP badges, or social feeds). It is an intimate, high-leverage cognitive operating system for one student.

- **Central Principle**: The student informs Ishizaki where they currently stand academically across their 9 subjects. Ishizaki remembers that precise coordinate, teaches from there, tracks mastery and errors, repairs conceptual gaps, and schedules what to study next based on actual login events and available session duration.
- **De-bloated 4-View Shell**:
  1. **Home**: Direct answers to *"What should I study right now?"*, last studied topic, critical weakness focus, and active study queue.
  2. **Learn**: Academic curriculum explorer across all 9 subjects, interactive personalized textbook reader, practice drills, mistake beat-down, and Exam Mode sprint.
  3. **Vault**: Personal 10 GB academic file system with in-browser previews (PDF, images, markdown, CSV, documents) and AI document interrogation.
  4. **Ask**: Unified AI tutoring and reasoning interface with zero persona-switching clutter.
  - *Secondary / Hidden*: Settings and `/system` (Internal Diagnostics & Health Verification).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ISHIZAKI ACADEMIC OS                            │
├─────────────┬──────────────────────────────────────────┬───────────────┤
│    HOME     │                  LEARN                   │     VAULT     │
│ Next Study  │ 9 Subjects · Textbooks · Practice · Exam │ 10GB Academic │
│ Action Card │     Mistake Repair ("Beat My Mistakes")  │ File Storage  │
├─────────────┴──────────────────────────────────────────┴───────────────┤
│                                  ASK                                   │
│  Unified AI Learning Engine (Groq -> OpenRouter -> Gemini Fallback)    │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          ACADEMIC BRAIN                                │
│  Curriculum State · Mastery Lattice · Error Bank · Login-Driven Queue  │
└────────────────────────────────────────────────────────────────────────┘
           │                                            │
           ▼                                            ▼
┌───────────────────────┐                    ┌───────────────────────────┐
│   LOCAL STORAGE       │    Sync Engine     │    REMOTE SERVICES        │
│ IndexedDB (Dexie/idb) │ ◄────────────────► │ Firebase Firestore & Auth │
│ PWA Service Worker    │   Offline-First    │ Backblaze B2 (Via Proxy)  │
└───────────────────────┘                    └───────────────────────────┘
```

---

## 2. User Experience & Visual Design

Following the *Universal Frontend Design Constitution* and *Education & Interactive Simulations Guidelines*:

- **Aesthetic Direction**: High-focus, scholarly, utilitarian minimalism. Editorial academic typography paired with precise structural borders. Completely free of "AI slop" (zero pill badges, no neon glow, no fake innovation scores, no floating card sandwiches).
- **Typography**:
  - *Display / Section Titles*: `Plus Jakarta Sans` (SemiBold / Bold, 20px–28px) with strict `text-wrap: balance`.
  - *Body Prose & Textbooks*: `Source Serif 4` or `Lora` (16px, 1.6 line height, 68ch measure) for sustained, fatigue-free reading.
  - *Formulas & Data*: `IBM Plex Mono` / `KaTeX` typography with `font-variant-numeric: tabular-nums`.
- **Color Strategy (60-30-10)**:
  - *60% Dominant Neutral*: Warm off-white canvas (`#FBFBF9` in light mode, `#121316` in dark mode).
  - *30% Structural Surfaces*: Subtle hairline borders (`#E5E5E0` / `#23252A`), crisp white card fields with single-level elevation.
  - *10% Semantic Accents*:
    - Scholarly Deep Indigo (`#2563EB`) for active navigation and primary focus.
    - Mastery Emerald (`#059669`) for verified concept stability (`● SECURE`).
    - Caution Amber (`#D97706`) for topics requiring reinforcement (`▲ REVIEW`).
    - Urgent Crimson (`#DC2626`) for critical conceptual mistakes (`■ GAP`).
- **Interactive Feedback**:
  - Sub-200ms transitions on all button/tab interactions.
  - In-app install banner (PWA) with iOS Safari manual installation modal.
  - Quiet offline status indicator badge (`Offline Mode · Cached data active`).

---

## 3. Product Decisions & Trade-Offs

1. **Local-First Architecture (IndexedDB as Primary, Firestore as Sync Replica)**
   - *Rationale*: Academic studying must never freeze or display blank loading states due to spotty connectivity or transit offline periods. The app reads and writes synchronously to local IndexedDB. A background synchronization worker syncs delta changes with Firestore whenever network is available.
2. **Adaptive Timetable vs. Clock Timetable**
   - *Rationale*: Fixed schedules (e.g., "4:00 PM Chemistry") fail the moment a student is late or has school obligations. Ishizaki generates study queues dynamically when the student logs in, computing the highest-ROI session matching their exact available duration (e.g., 5 min, 20 min, 45 min, 60 min).
3. **Multi-Tier AI Provider Cascade (Groq -> OpenRouter -> Gemini)**
   - *Rationale*: Low latency is paramount for conversational tutoring and practice evaluation. Groq (Llama-3.3-70B / Mixtral) provides near-instant tokens. If rate-limited or unavailable, the request cascades transparently to OpenRouter, then Google Gemini 2.5/3.x, and falls back to offline cached revision if fully disconnected.
4. **Curriculum Balance with 65/35 Weighting**
   - *Rationale*: Honors the user's specific target ratio: 65% focus on Ghanaian SHS 1–3 WASSCE requirements across 8 core/elective subjects, and 35% dedicated to Digital SAT preparation, cross-linking overlapping mathematical and linguistic concepts.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vite + React 19)                      │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Home View   │  │  Learn View  │  │  Vault View  │  │  Ask View   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │                 │        │
│  ┌──────┴─────────────────┴─────────────────┴─────────────────┴──────┐ │
│  │                  State Management & Domain Stores                 │ │
│  │ (AuthStore, CurriculumStore, MasteryStore, VaultStore, SyncStore) │ │
│  └──────────────────────────────┬────────────────────────────────────┘ │
│                                 │                                      │
│  ┌──────────────────────────────┴────────────────────────────────────┐ │
│  │            Local IndexedDB Engine (Dexie / IDB Schema)            │ │
│  │ (curriculum, mastery, textbooks, mistakes, files_meta, sync_log)  │ │
│  └──────────────────────────────┬────────────────────────────────────┘ │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │ HTTP / WebSocket / Sync
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BACKEND SERVER (Express / Node.js)                   │
│                                                                        │
│  ┌─────────────────────────┐  ┌────────────────────────┐               │
│  │  /api/ai/chat & tutor   │  │  /api/ai/structured    │               │
│  └────────────┬────────────┘  └───────────┬────────────┘               │
│               │                           │                            │
│  ┌────────────┴───────────────────────────┴────────────┐               │
│  │   AI Router & Cascade (Groq -> OpenRouter -> Gemini)│               │
│  └─────────────────────────────────────────────────────┘               │
│                                                                        │
│  ┌─────────────────────────┐  ┌────────────────────────┐               │
│  │  /api/vault/upload      │  │  /api/vault/file/:id   │               │
│  └────────────┬────────────┘  └───────────┬────────────┘               │
│               │                           │                            │
│  ┌────────────┴───────────────────────────┴────────────┐               │
│  │       Backblaze B2 S3 SDK Proxy & Document Parser   │               │
│  └─────────────────────────────────────────────────────┘               │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
          ┌───────────────────────┴──────────────────────┐
          ▼                                              ▼
┌───────────────────────────┐              ┌───────────────────────────┐
│     Cloud Firestore       │              │     Backblaze B2 Cloud    │
│ (Master Remote Database)  │              │ (10 GB Object Store)      │
└───────────────────────────┘              └───────────────────────────┘
```

---

## 5. Comprehensive Section Details

### A. Product Architecture
- The system operates on an event-driven loop: Session Launch $\to$ Academic State Evaluation $\to$ Adaptive Task Recommendation $\to$ Student Action $\to$ Mistake/Mastery Capture $\to$ State Mutation $\to$ Local Persistence $\to$ Background Cloud Sync.
- Single-user tenancy: Protected by private credential authentication with zero open public signup.

### B. Frontend Architecture
- Built on React 19, TypeScript, Tailwind CSS v4, Lucide icons, and Motion for compositor-only transitions.
- Modular view system avoiding routing bloat: Top-level segmented navigation bar displaying `Home`, `Learn`, `Vault`, and `Ask`, with a discreet settings trigger for diagnostic verification (`/system`).

### C. Backend Architecture
- Express 4 full-stack server running concurrently on port 3000 (`server.ts`).
- Secure Server Proxy:
  - `/api/ai/complete`: Validates requests, enforces JSON schemas, routes requests through the Groq $\to$ OpenRouter $\to$ Gemini pipeline, and prevents client-side API key leakage.
  - `/api/vault/*`: Handles multipart file uploads, streams binary objects to Backblaze B2 via AWS S3-compatible SDK, generates short-lived presigned URLs, and extracts text/OCR for semantic search.
  - `/api/health`: Comprehensive ping service verifying connectivity to Firestore, B2, Groq, OpenRouter, and Gemini.

### D. Database & Data Models

#### 1. Entities & Firestore Collections (`/users/{userId}/...`)
- `profile`: `{ userId, email, educationLevel: 'SHS1'|'SHS2'|'SHS3', examTargetYear: 2028, wassceWeight: 0.65, satWeight: 0.35, preferences: { sessionLength: 20, explanationDepth: 'standard' }, createdAt, updatedAt }`
- `curriculum_nodes`: `{ nodeId, subject: 'Mathematics'|'Additional Mathematics'|'Physics'|'Chemistry'|'Biology'|'Computing'|'English Language'|'Social Studies'|'SAT', track: 'WASSCE'|'SAT', year: 1|2|3, strand, subStrand, topic, focalAreas: string[], prerequisites: string[], examRelevance: string[], provenance: { source, verifiedDate, version } }`
- `mastery_records`: `{ recordId, nodeId, subject, score: 0-100, status: 'NOT_STARTED'|'IN_PROGRESS'|'REVIEW_NEEDED'|'SECURE', confidenceLevel: 1-5, lastReviewedAt, nextReviewDue, attemptCount, correctCount }`
- `mistake_bank`: `{ mistakeId, questionId, subject, topic, nodeId, studentPrompt, incorrectAnswer, correctAnswer, errorCategory: 'conceptual'|'method'|'calculation'|'careless'|'misread', explanation, recurrenceCount, resolved: boolean, timestamp }`
- `textbooks`: `{ textbookId, subject, topic, nodeId, title, chapters: [{ chapterId, title, contentMarkdown, diagrams: [{ type, data }], examples: [{ problem, solution, notes }], practiceQuestions: [{ question, answer, rubric }] }], customNotes: string, generatedAt, updatedAt }`
- `study_sessions`: `{ sessionId, subject, topic, durationMinutes, plannedLength, actionsCompleted: string[], scoreDelta, weaknessesIdentified: string[], timestamp }`
- `vault_files`: `{ fileId, fileName, mimeType, sizeBytes, b2Key, publicUrl, folder: string, tags: string[], extractedText: string, aiIndexed: boolean, offlineCached: boolean, createdAt, updatedAt }`

#### 2. Local IndexedDB Schema (Dexie.js / Native IDB)
- Tables:
  - `curriculum`: `++id, nodeId, subject, track, topic`
  - `mastery`: `++id, nodeId, subject, status, nextReviewDue`
  - `mistakes`: `++id, mistakeId, subject, nodeId, errorCategory, resolved`
  - `textbooks`: `++id, textbookId, subject, topic, updatedAt`
  - `vault_meta`: `++id, fileId, fileName, mimeType, offlineCached`
  - `vault_blobs`: `fileId, blobData, cachedAt` (Stores actual binary content for files marked "Available Offline")
  - `sync_queue`: `++id, collection, documentId, operation ('CREATE'|'UPDATE'|'DELETE'), payload, timestamp, status ('PENDING'|'IN_FLIGHT'|'FAILED')`

### E. AI Architecture & Provider Cascade
1. **Model Router Strategy**:
   - *Lightweight Tasks* (Flashcards, classification, error tagging, summaries, quick quizzes): Routed to **Groq `llama-3.1-8b-instant`** or **Groq `mixtral-8x7b-32768`**.
   - *Heavy Tasks* (Complex mathematical proofs, physics mechanics, organic chemistry reaction mechanisms, SAT passage analysis, multi-chapter textbook synthesis): Routed to **Groq `llama-3.3-70b-versatile`** / **OpenRouter `deepseek/deepseek-r1`**.
2. **Fallback Cascade**:
   - `Attempt 1`: Groq API (target latency $<1.2\text{s}$). If rate limit (429), server error (5xx), or timeout ($>8\text{s}$) $\to$
   - `Attempt 2`: OpenRouter API with equivalent model router $\to$
   - `Attempt 3`: Google Gemini 2.5 Flash / Pro (native via `@google/genai`) $\to$
   - `Attempt 4`: Offline Fallback (serves pre-generated textbooks, saved practice drills, and queues user responses for sync).
3. **Structured Output Enforcement**:
   - All critical AI responses (quizzes, error classifications, mastery updates, study session recommendations) must provide a JSON schema. The server validates responses with Zod before returning to the frontend.

### F. Vault Storage Model (Backblaze B2)
- Target: 10 GB capacity ceiling with zero frontend credential exposure.
- File key structure in B2 bucket: `users/{userId}/{subject}/{fileId}_{sanitizedFileName}`.
- Metadata recorded in Firestore & IndexedDB.
- Offline Strategy: Files have an explicit toggle: `Make Available Offline`. When enabled, the binary blob is downloaded into IndexedDB `vault_blobs`. When disabled, the file is streamed dynamically from B2 on demand.

### G. Adaptive Timetable Algorithm
Instead of fixed clock triggers, the scheduler computes a personalized queue upon login:
$$\text{Weight}(S) = w_{\text{exam}}(S) \times \left(1 + \frac{\text{DaysSinceLastStudy}(S)}{7}\right) \times \left(1 + \frac{\text{UnresolvedMistakes}(S)}{5}\right) \times (1 - \text{MasteryRatio}(S))$$
- $w_{\text{exam}}(S) = 0.65$ for WASSCE subjects, $0.35$ for SAT topics.
- When the student enters session duration (e.g. 20 min):
  - If $\text{Duration} \le 10$ min: Rapid Mistake Blitz or 5-question targeted recall drill.
  - If $10 < \text{Duration} \le 30$ min: Targeted Concept Drill + 1 foundation breakdown.
  - If $\text{Duration} > 30$ min: Deep textbook chapter study or Exam Mode sprint.

### H. Exam Mode (Rapid Revision & Gap Detection)
- Cycle: Broad Curriculum Sweep $\to$ Diagnostic Quick-Check (2 questions per focal area) $\to$ Status Tagging:
  - `● SECURE`: Score $\ge 90\%$, moves immediately to next topic.
  - `▲ REVIEW`: Score $60\%\text{--}89\%$, generates a 2-minute high-density summary card.
  - `■ MAJOR GAP`: Score $<60\%$, automatically creates a priority repair task in the study queue.
- Generates an instant Exam Coverage Matrix across all 9 subjects.

### I. Offline-First & Sync Engine
- Local state changes receive a monotonically increasing `localVersion` and a `syncStatus: PENDING_UPLOAD`.
- A dedicated `SyncEngine` listens for browser `online` events and triggers batch updates to Firestore using batch writes.
- Conflicts are resolved using **Last-Write-Wins (LWW) with Field-Level Merging**: if the cloud updated a mastery score while the local client resolved a mistake, both field changes persist safely.

### J. Diagnostics & System Verification (`/system`)
A hidden, password-protected diagnostic panel executing real assertions (no mocked booleans):
1. **Database & Cache**: Tests IndexedDB read/write speed, storage quota, and Firestore live heartbeat.
2. **AI Provider Cascade**:
   - Sends real probe to Groq $\to$ records latency and token count.
   - Intentionally simulates Groq failure $\to$ tests OpenRouter switch.
   - Simulates OpenRouter failure $\to$ tests Gemini switch.
   - Tests structured JSON output validation.
3. **Vault & B2**: Tests presigned URL generation, file upload, blob read, and IndexedDB blob caching.
4. **Offline Resilience**: Simulates navigator disconnect, verifies that textbooks, mastery records, and mistake bank remain completely navigable without network requests.

---

## 6. Implementation Phases & Dependencies

```
Phase 1: Foundation (App Shell, Auth, IndexedDB, Firestore Sync, PWA)
   │
   ▼
Phase 2: Academic Brain & Curriculum Seed (9 Subjects, WASSCE & SAT, Starting Position)
   │
   ▼
Phase 3: AI Engine & Provider Cascade (Groq -> OpenRouter -> Gemini Server Proxy)
   │
   ▼
Phase 4: Learning Engine & Textbooks (Textbook Generator, Practice Drills, Mistake Bank)
   │
   ▼
Phase 5: Adaptive Timetable & Study Queue (Login-driven event queue, 65/35 balance)
   │
   ▼
Phase 6: Exam Mode Engine (Rapid coverage map, gap diagnostic, sprint drills)
   │
   ▼
Phase 7: Vault & Backblaze B2 (File storage, PDF/doc previews, AI document search)
   │
   ▼
Phase 8: System Diagnostics & Hardening (/system test suite, offline stress testing)
```

---

## 7. Acceptance Criteria & Objective Tests

- **Phase 1**: Application boots to a clean login screen; authenticates student; caches app shell; reloads successfully with DevTools network set to "Offline".
- **Phase 2**: Displays all 8 WASSCE subjects + SAT track (no Business Management); allows student to set and edit their initial academic coordinates; persists coordinates to IndexedDB and Firestore.
- **Phase 3**: Probe to `/api/ai/complete` returns valid structured JSON from Groq; when Groq key is invalidated, automatically falls back to OpenRouter, then Gemini; logs provider, latency, and status in diagnostics.
- **Phase 4**: Generates and stores a complete customized textbook chapter; student can highlight and request "teach from zero"; practice question results properly feed the Mistake Bank with categorization (`conceptual`, `calculation`, etc.).
- **Phase 5**: Submitting "20 minutes available" on login produces a tailored 20-minute learning unit prioritizing the highest-weighted neglected subject and urgent mistakes; preserves 65/35 WASSCE/SAT ratio.
- **Phase 6**: Exam Mode traverses a selected subject, grades rapid responses, accurately flags `SECURE` vs `REVIEW` vs `MAJOR GAP`, and creates a visual coverage matrix.
- **Phase 7**: A 5MB PDF document uploads to B2 via server proxy, renders inside the Vault in-browser viewer, is marked "Available Offline" (caching blob locally), and answers user questions via AI extraction.
- **Phase 8**: All tests on the `/system` diagnostic page report `PASS` with verifiable telemetry.

---

## 8. Risks and Tradeoffs

| Risk | Mitigation |
| :--- | :--- |
| **B2 API Keys / CORS** | Route all uploads and downloads through the server-side Express proxy; never expose B2 application keys to the browser. |
| **Browser Storage Eviction** | Request persistent storage via `navigator.storage.persist()`; monitor IndexedDB usage against available browser quota. |
| **AI Rate Limits during Study Sprints** | Aggressive caching of generated textbooks and revision notes so repeated reading never incurs AI token overhead; automatic multi-tier fallback cascade. |
| **Curriculum Scope Creep** | Rigorously isolate subjects to the 9 authorized disciplines; exclude extraneous elective tracks. |
