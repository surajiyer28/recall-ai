# RecallAI — Technical Reference Document
> AI-Powered Memory Prosthetic for ADHD  
> Version: Combined Reference | For use with prompt builder / vibe coding

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Use Cases & Scenarios](#2-use-cases--scenarios)
3. [System Architecture — 5 Layers](#3-system-architecture--5-layers)
4. [Data Flow — Use Case Walkthrough](#4-data-flow--use-case-walkthrough)
5. [UI Screen Flows](#5-ui-screen-flows)
6. [Processing Pipeline — Detail](#6-processing-pipeline--detail)
7. [Storage Layer — Detail](#7-storage-layer--detail)
8. [Retrieval & Conversation Layer — Detail](#8-retrieval--conversation-layer--detail)
9. [Proactive Notification Agent](#9-proactive-notification-agent)
10. [State Management](#10-state-management)
11. [Local Storage Schema (On-Device SQLite)](#11-local-storage-schema-on-device-sqlite)
12. [API Rate Limiting & Batching Strategy](#12-api-rate-limiting--batching-strategy)
13. [Error States & Fallback Behaviour](#13-error-states--fallback-behaviour)
14. [Privacy & Trust Architecture](#14-privacy--trust-architecture)
15. [Technology Stack](#15-technology-stack)
16. [Demo Ingestion Modes](#16-demo-ingestion-modes)

---

## 1. Product Overview

### Problem
ADHD affects ~366 million adults worldwide. The core deficit is not simple forgetfulness — it is unreliable working memory and impaired prospective memory (remembering to do things in the future). This cascades into missed deadlines, forgotten conversations, lost objects, and chronic shame.

Every existing tool fails the same way: notes apps require you to remember to take notes. Reminders require you to remember to set reminders. They assume the cognitive capacity that ADHD specifically impairs.

### Solution
RecallAI is a zero-input memory prosthetic. It captures passively, organises automatically, and retrieves conversationally. The user never has to do anything for the system to work.

### Core Differentiators
- **Zero executive function required** — no manual saving, tagging, or filing
- **Cross-modal retrieval** — a text query ("where are my keys?") can match directly against an image capture of keys on a counter, with no intermediate text description needed
- **Proactive surfacing** — the system surfaces relevant memories before the user asks, triggered by context changes
- **ADHD-specific intelligence** — proactive layer is tuned for ADHD failure modes: prospective memory, task-switching losses, emotional recall distortion

---

## 2. Use Cases & Scenarios

### Scenario 1 — The Forgotten Conversation
You had a conversation with your advisor on Tuesday about a deadline change. By Thursday, you cannot remember if the deadline moved to the 15th or the 22nd. You open RecallAI and say: "What did Professor Johnson say about the project deadline?"

The system retrieves the transcribed conversation segment, summarises the relevant exchange, and tells you: "On Tuesday at 2:15 PM in Luddy Hall, Professor Johnson moved the TAXSIM deliverable deadline to March 22nd. He also mentioned wanting the architecture document before the 18th."

### Scenario 2 — The Lost Object (Image Upload Path)
You set your keys down somewhere while talking on the phone. Earlier that day you uploaded a photo from your camera roll. RecallAI's pipeline embedded the image directly via Google Multimodal Embedding 2 into the same 1408-dim vector space as all text memories.

When you ask "Where did I put my keys?", the text query vector directly matches the image vector of keys on a counter — no intermediate text description of the image is needed. The system responds: "Based on an image you uploaded at 4:32 PM, your keys appear to be on the kitchen counter near the microwave."

### Scenario 3 — The Fleeting Thought
While walking to class, you have an idea about your project's architecture. You mutter it aloud. RecallAI captures it via the microphone, classifies it as an idea rather than a conversation, tags it with your active projects, and stores it.

Later, the system proactively surfaces: "You had a thought earlier today about using ephemeral memory pools for camera handoff — want me to pull that up?"

### Scenario 4 — The Social Context Gap
Someone at a networking event mentions they work at Fidelity on the Spring Boot team. Two weeks later, you see them at another event but cannot remember their name or what you talked about. You discreetly ask RecallAI: "Who did I talk to at the PM Club mixer about Fidelity?"

It returns: "You spoke with Ravi Mehta for about 8 minutes. He is a senior engineer on Fidelity's Spring Boot migration team. You discussed your Accenture experience and he mentioned his team has open positions."

### Scenario 5 — The Book Recommendation (Cross-Modal Retrieval)
At a coffee shop, a friend recommends a book. RecallAI captures the audio ("You should read Scattered Minds by Gabor Mate"). You also upload a photo of the book cover from your camera roll. Both the transcript text and the raw image are embedded into the same 1408-dim vector space via Google Multimodal Embedding 2.

Days later, when you ask "What was that book someone recommended?", the query vector matches both the transcript embedding and the image embedding independently. The fusion ranker combines both hits, and Claude generates: "Your friend recommended Scattered Minds by Gabor Mate at Soma Coffee last Tuesday. I also have a photo of the book cover."

### Scenario 6 — The Meeting Recap
After a 45-minute team meeting, you ask: "Summarise what we decided in today's meeting." RecallAI returns structured output: decisions made, action items assigned to each person, unresolved questions, and follow-ups mentioned.

### Scenario 7 — The Emotional Context
You had an argument with a friend but your memory of what was actually said is distorted by emotion — emotional dysregulation warping recall is common in ADHD. You can ask RecallAI for an objective transcript of what was said, helping you process the conversation more accurately without the emotional filter.

---

## 3. System Architecture — 5 Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 1 — PASSIVE CAPTURE (on-device)          │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ ┌───────────┐  │
│  │ Audio       │ │ Visual      │ │ Screen /   │ │ Context   │  │
│  │ Capture     │ │ Capture     │ │ Text (OCR) │ │ Metadata  │  │
│  │ Mic + VAD   │ │ Video or    │ │ On-device  │ │ GPS, WiFi │  │
│  │ filter      │ │ image upload│ │ ML Kit OCR │ │ time      │  │
│  └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ └─────┬─────┘  │
│         └───────────────┴──────────────┴──────────────┘         │
│                              │                                   │
│         ┌────────────────────▼──────────────────────┐           │
│         │  Privacy Filter — PII redact, zone check, │           │
│         │  consent rules                            │           │
│         └────────────────────┬──────────────────────┘           │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                  LAYER 2 — PROCESSING PIPELINE                   │
│                                                                  │
│  ┌──────────────────────┐        ┌───────────────────────────┐  │
│  │ Whisper STT          │        │ ML Kit OCR                │  │
│  │ + speaker diarize    │        │ On-device text extraction │  │
│  └──────────┬───────────┘        └─────────────┬─────────────┘  │
│             │  transcript text   raw images     │ screen text    │
│             └──────────────────────┬────────────┘               │
│                                    │                             │
│         ┌──────────────────────────▼──────────────────────┐     │
│         │       Google Multimodal Embedding 2              │     │
│         │  Text + images → unified 1408-dim vector space  │     │
│         └──────────────────────────┬────────────────────── ┘    │
│                        ┌───────────┴────────────┐               │
│                        │                        │               │
│            ┌───────────▼──────────┐  ┌──────────▼────────────┐  │
│            │ NER Entity Extraction│  │ Summarisation Engine  │  │
│            │ people, places,      │  │ Claude API            │  │
│            │ objects, dates       │  │ + metadata enrichment │  │
│            └──────────────────────┘  └───────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     LAYER 3 — STORAGE                            │
│                                                                  │
│  ┌───────────────┐  ┌──────────────────┐  ┌───────────────────┐ │
│  │ Vector Store  │  │ Knowledge Graph  │  │ Temporal Index    │ │
│  │ ChromaDB /    │  │ Neo4j entities   │  │ PostgreSQL +      │ │
│  │ pgvector      │  │ + relationships  │  │ timestamp index   │ │
│  │ 1408-dim vecs │  │                  │  │                   │ │
│  └───────────────┘  └──────────────────┘  └───────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│              LAYER 4 — RETRIEVAL + CONVERSATION                  │
│                                                                  │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐  │
│  │ Query Parser                │  │ Embed Query              │  │
│  │ intent + entities + time    │  │ Google MME2 → 1408-d vec │  │
│  └──────────────┬──────────────┘  └────────────┬─────────────┘  │
│                 └──────────────────┬────────────┘               │
│                                    │                             │
│  ┌─────────────────────────────────▼──────────────────────────┐ │
│  │ Hybrid Search + Fusion Ranker                               │ │
│  │ Vector similarity + Graph traversal + Temporal filter       │ │
│  └─────────────────────────────┬───────────────────────────────┘ │
│                                │                                 │
│  ┌─────────────────────────────▼──────────────────────────────┐ │
│  │ Claude LLM — Answer Generation + Confidence Scoring        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Proactive Memory Agent — event-driven background process  │   │
│  │ Triggers: location change, new capture completed          │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     LAYER 5 — USER INTERFACE                     │
│                                                                  │
│  ┌──────────────┐  ┌───────────┐  ┌───────────────┐  ┌───────┐  │
│  │ Chat         │  │ Voice I/O │  │ Notifications │  │Memory │  │
│  │ Interface    │  │ hands-free│  │ proactive     │  │Timeline│ │
│  └──────────────┘  └───────────┘  └───────────────┘  └───────┘  │
└─────────────────────────────────────────────────────────────────┘

Memory Object Schema (stored across all three data stores):
  vectors  : [text_emb, image_emb]  — 1408-d each
  entities : [people, places, objects, dates]
  metadata : {timestamp, location, duration, speakers, capture_trigger}
  assets   : {transcript, image_refs}   — raw video/audio discarded; standalone images retained
  summary  : Claude-generated natural language summary
```

---

## 4. Data Flow — Use Case Walkthrough

### Scenario: "What was that book someone recommended?"
*(Cross-modal retrieval — text query matches both audio transcript and image capture)*

```
PHASE 1 — Capture at a coffee shop
─────────────────────────────────────────────────────────────

User records conversation + uploads image of book cover
         │
         ├──► Context metadata attached
         │    GPS: Soma Coffee, 10:15 AM
         │
         ├──► Audio recording ends → pipeline triggers
         │    Whisper transcribes:
         │    "You should read Scattered Minds by Gabor Mate"
         │    Speaker: Friend (not you)
         │
         └──► Standalone image uploaded by user
              Photo of book cover ("Scattered Minds") on table


PHASE 2 — Dual-path processing
─────────────────────────────────────────────────────────────

       Image path                        Audio path
  ┌────────────────────┐          ┌───────────────────────────┐
  │ Uploaded image:    │          │ Transcript text:           │
  │ table + book cover │          │ "Scattered Minds by        │
  │ "Scattered Minds"  │          │  Gabor Mate, changed       │
  └─────────┬──────────┘          │  my life"                  │
            │                     └──────────────┬─────────────┘
            └──────────────────┬─────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │ Google Multimodal    │
                    │ Embedding 2          │
                    ├──────────────────────┤
                    │ Image vec [1408-d]   │
                    │ Text vec  [1408-d]   │
                    │ ← same vector space →│
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ Entity linker +      │
                    │ Summariser           │
                    │ Links image + audio  │
                    │ as one memory        │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────────────────────────┐
                    │ Stored memory object                      │
                    │ image vec + text vec                      │
                    │ entities: ["Scattered Minds", "Gabor      │
                    │   Mate", "friend"]                        │
                    │ context: Soma Coffee, 10:22 AM            │
                    └───────────────────────────────────────────┘


                        ··· days pass ···


PHASE 3 — Cross-modal retrieval
─────────────────────────────────────────────────────────────

User: "What was that book someone recommended?"
         │
         ▼
    Query parser
    intent: recall / type: recommendation
         │
         ▼
    Embed query text
    "book recommended" → [1408-d vector]
         │
         ├──► Vector similarity search
         │    Matches text vec + image vec
         │
         └──► Entity + temporal filter
              "book", "recommend" entities
                               │
                    ┌──────────▼───────────┐
                    │ Fusion ranker         │
                    │ Top result:           │
                    │ book memory at Soma   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ Claude answer gen    │
                    │ Context: transcript  │
                    │ + image + location   │
                    │ + entities           │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼────────────────────────────────┐
                    │ Answer displayed to user                   │
                    │ "Your friend recommended Scattered Minds   │
                    │  by Gabor Mate at Soma Coffee last         │
                    │  Tuesday. I also have a photo of the       │
                    │  book cover."                              │
                    └───────────────────────────────────────────┘
                               │
                    Follow-up actions available:
                    "Show me the photo"
                    "Add to reading list"
                    "What else did we talk about that day?"

Note: image vector matched text query directly —
no intermediate text description of the image was needed.
```

---

## 5. UI Screen Flows

### Flow 1 — Onboarding + Capture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  9:41          100% │     │  9:41          100%  │     │  2:18 PM       82%  │
│                     │     │                      │     │                     │
│      ⊙              │     │    Permissions       │     │    Capturing  ●     │
│                     │     │                      │     │    Listening        │
│    RecallAI         │     │  RecallAI needs      │     │                     │
│  Your memory,       │     │  access to capture   │     │ ● Conversation      │
│  always on          │     │  your day. You       │     │   detected — 6 min  │
│                     │     │  control everything. │     │                     │
│  We capture what    │     │                      │     │ ● Audio processed — │
│  you hear and do    │     │  Microphone  Granted │     │   Luddy Hall        │
│  — so you can ask   │     │  Location    Granted │     │                     │
│  about it later.    │     │  Notifs      Pending │     │ ● Extracted:        │
│                     │     │  Screen cap  Optional│     │   "deadline", "22"  │
│  [  Get started  ]  │     │                      │     │                     │
│                     │     │  [    Continue    ]  │     │ ● Location:         │
│  Zero effort.       │     │                      │     │   Luddy 3025        │
│  Total privacy.     │     │                      │     │                     │
│                     │     │                      │     │  12 memories        │
│                     │     │                      │     │  captured today     │
├─────────────────────┤     ├──────────────────────┤     ├─────────────────────┤
│ ← →                 │     │ ← →                  │     │Capture  Ask Timeline│
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
   1a. Welcome                  1b. Permissions               1c. Capture active
```

### Flow 2 — Conversational Recall

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  6:45 PM          62%   │     │  6:46 PM           62%   │
│                         │     │                          │
│     Ask RecallAI        │     │   ← Back to chat         │
│                         │     │     Memory detail        │
│ ┌─────────────────────┐ │     │                          │
│ │ What did my         │ │     │  Meeting with Prof Johnson│
│ │ professor say about │ │     │  Mar 25, 2:15 PM         │
│ │ the deadline?       │ │     │  Luddy Hall 3025         │
│ └─────────────────────┘ │     │  Duration: 14 min        │
│                         │     │  2 speakers              │
│  Today at 2:15 PM —     │     │                          │
│  Luddy Hall             │     │  Key entities            │
│  Professor Johnson      │     │  [Prof Johnson] [TAXSIM] │
│  moved the TAXSIM       │     │  [March 22]              │
│  deadline to March 22.  │     │                          │
│  He also asked for the  │     │  Summary                 │
│  architecture doc by    │     │  Deadline moved to Mar   │
│  the 18th.              │     │  22. Architecture doc    │
│                         │     │  needed by Mar 18.       │
│  Source: conversation,  │     │  Demo with Dr. Johnson   │
│  14 min · high conf.    │     │  next week. Hybrid agent │
│                         │     │  approach approved.      │
│ ┌─────────────────────┐ │     │                          │
│ │ What else did we    │ │     │  Full transcript          │
│ │ discuss?            │ │     │  Prof: "So let's push     │
│ └─────────────────────┘ │     │  the deadline..."        │
│                         │     │  You: "To the 22nd       │
│  He mentioned wanting   │     │  works for me..."        │
│  to schedule a demo     │     │  [View full transcript]  │
│  with Dr. Johnson next  │     │                          │
│  week, and suggested    │     │                          │
│  using the hybrid agent │     │                          │
│  approach you proposed. │     │                          │
│                         │     │                          │
│  Ask about your day...  │ ▲   │                          │
├─────────────────────────┤     ├──────────────────────────┤
│ Capture  Ask  Timeline  │     │ Capture  Ask  Timeline   │
└─────────────────────────┘     └──────────────────────────┘
   2a. Ask anything                 2b. Memory detail (drilldown)
```

### Flow 3 — Timeline + Proactive Memory

```
┌──────────────────────┐  ┌───────────────────────┐  ┌────────────────────────┐
│  8:30 PM       45%   │  │  9:15 AM        92%   │  │  9:20 AM         88%   │
│                      │  │                       │  │                        │
│   Today's timeline   │  │   Good morning        │  │   Privacy settings     │
│                      │  │                       │  │                        │
│  2:15 PM             │  │ ┌───────────────────┐ │  │  Capture active    ●   │
│  Prof meeting —      │  │ │  Context for today│ │  │  Audio recording   ●   │
│  14 min, 4 actions   │  │ │  meeting at 1 PM. │ │  │  Screen capture    ○   │
│                      │  │ │  Last session you │ │  │                        │
│  3:40 PM             │  │ │  discussed spec.  │ │  │  Privacy zones         │
│  Walking thought     │  │ │  design — want a  │ │  │  ● Home bedroom        │
│  Idea: ephemeral     │  │ │  recap?           │ │  │    no capture          │
│  memory pools        │  │ └───────────────────┘ │  │  ● Bathroom            │
│                      │  │                       │  │    no capture          │
│  5:00 PM             │  │  Yesterday's idea     │  │                        │
│  ThirdEye standup    │  │  While walking, you   │  │  Quiet hours           │
│  22 min, 3 decisions │  │  said: "What if       │  │  ● 10:00 PM — 7:00 AM  │
│                      │  │  ThirdEye uses        │  │                        │
│  6:20 PM             │  │  ephemeral memory     │  │  Data retention        │
│  Browsing — saved    │  │  pools for camera     │  │  Casual convos  30 days│
│  RAG optimisation    │  │  handoff?" — tap to   │  │  Important memories    │
│                      │  │  expand.              │  │  indefinite            │
│  18 memories today   │  │                       │  │                        │
│                      │  │  These surfaced       │  │                        │
│                      │  │  because they seem    │  │                        │
│                      │  │  important            │  │                        │
├──────────────────────┤  ├───────────────────────┤  ├────────────────────────┤
│Capture Ask [Timeline]│  │ Capture  Ask  Timeline│  │Capture  Ask  Timeline  │
└──────────────────────┘  └───────────────────────┘  └────────────────────────┘
  3a. Timeline view           3b. Proactive nudge           3c. Privacy controls
```

---

## 6. Processing Pipeline — Detail

### 5.1 Video & Audio Ingestion
- **Real-time audio capture**: device microphone streams through Voice Activity Detection (Silero VAD). Speech detected → recording segment opens. Silence >5s → segment closes. Recording completes → full pipeline triggers immediately.
- **Video upload**: user uploads a video file. Once upload completes, the pipeline extracts: (a) audio track → Whisper STT, (b) frames at 1 per 30s interval → embedding. Raw video is discarded after extraction — only frames and transcript persist.
- **Standalone image upload**: user uploads one or more images directly. Each image is embedded immediately via Google Multimodal Embedding 2 and stored. No frame extraction needed.
- **No live/periodic frame capture**: all visual processing is post-completion. There is no streaming frame dispatch during recording or upload.

### 5.2 Whisper Speech-to-Text
- Short segments (<30s): `whisper.cpp` on-device, `tiny` or `base` model, ~100ms latency, no network required
- Long recordings (meetings, uploads): Whisper API or self-hosted `medium`/`large`
- Speaker diarisation: `pyannote.audio` (cloud-side), produces timestamped speaker-labelled segments — enables "your friend said X" rather than "someone said X"
- Raw audio buffer kept on-device only during transcription, then discarded

### 5.3 ML Kit OCR
- Runs entirely on-device via Google ML Kit text recognition API
- Detects text in image frames: whiteboards, book covers, menus, signs, screens
- Output passed forward as: (a) metadata for NER, (b) input to embedding model

### 5.4 Google Multimodal Embedding 2 (Architectural Centrepiece)
- Maps text and images into a **unified 1408-dimensional vector space**
- Key property: a text concept and an image of that concept produce vectors that are geometrically close — no intermediate text description of images is required
- Each capture window produces:
  - Transcript text → text embedding [1408-d]
  - Each image frame → image embedding [1408-d]
  - OCR-extracted text → text embedding [1408-d]
- All vectors live in the same space and are searchable with the same query
- API: `multimodalembedding@001` (images) and `textembedding-gecko` (text) via Vertex AI

### 5.5 Named Entity Recognition (NER)
- Runs on transcript and OCR text
- Extracts: people names, places, organisations, dates, times, objects, action items
- Entity linker resolves cross-capture references: "Prof Johnson" (audio) = "Professor Johnson" (email)
- Technology: SpaCy with fine-tuned NER model, or `distilbert-NER`
- Entity linking: fuzzy matching + co-occurrence in knowledge graph

### 5.6 Summarisation Engine
- Generates 3–4 sentence natural language summaries per capture window
- Claude API with system prompt prioritising: actionable information, commitments, deadlines
- Summary stored alongside full transcript: summary for quick browsing, transcript for precise recall

### 5.7 Metadata Enrichment
- Attaches context from Layer 1 (GPS, time, WiFi) to processed memory objects
- Reverse geocoding: GPS → readable place name ("Soma Coffee, 123 Main St")
- Calendar correlation: if timestamp overlaps a calendar event, event title + attendees attached to memory

---

## 7. Storage Layer — Detail

Three complementary stores, each optimised for a different retrieval pattern.

### 6.1 Vector Store
- Holds all 1408-d embeddings from Google Multimodal Embedding 2
- Primary retrieval mechanism: semantic matching via cosine similarity
- Query text is embedded into the same space; top-k nearest neighbours returned
- Prototype: **ChromaDB** (lightweight, Python-native, supports metadata filtering)
- Production: **PostgreSQL + pgvector** or Pinecone / Weaviate

### 6.2 Knowledge Graph
- Nodes: people, places, projects, objects
- Edges: "Person A mentioned Object B during Conversation C at Location D"
- Enables entity-based queries vector search alone cannot handle: "Who told me about that book?" — traverses graph from book entity → person entity via conversation edge
- Prototype: PostgreSQL junction tables
- Production: **Neo4j** with Cypher queries

### 6.3 Temporal Index
- Time-series index for efficient time-based queries
- Stores session boundaries (conversation start/end, location changes)
- Enables: "the meeting before lunch", "right after arriving at the office"
- Technology: **PostgreSQL** with indexed timestamp columns + range query support

### 6.4 Memory Object Schema

```
memory_object {
  id          : uuid
  vectors     : {
    text_emb    : float[1408],   // from transcript or OCR
    image_embs  : float[1408][]  // one per image frame
  }
  entities    : [
    { type: "person" | "place" | "object" | "date", value: string, graph_node_id: uuid }
  ]
  metadata    : {
    timestamp_start : ISO8601,
    timestamp_end   : ISO8601,
    gps             : { lat, lng },
    place_name      : string,         // reverse geocoded
    duration_sec    : int,
    speaker_count   : int,
    noise_level     : "quiet" | "moderate" | "loud",
    capture_trigger : "vad" | "manual_upload",
    source_device   : string
  }
  assets      : {
    transcript  : string,             // full text; raw audio discarded
    image_refs  : string[]            // encrypted file paths or S3 keys
                                      // raw video discarded after frame extraction
  }
  summary     : string                // Claude-generated
}
```

---

## 8. Retrieval & Conversation Layer — Detail

### 7.1 Query Parser
- Input: natural language query from user
- Output: structured JSON with `intent`, `entities[]`, `time_ref`, `modality_hint`
- Example:
  ```
  Input:  "What did my professor say about the deadline last Tuesday?"
  Output: {
    intent: "recall",
    entities: ["professor", "deadline"],
    time_ref: "last Tuesday",
    modality_hint: "conversation"
  }
  ```
- Handles temporal references ("yesterday", "last week"), entity references ("my professor"), modality hints ("where did I put" → implies visual)
- Technology: Claude API with structured JSON output prompt

### 7.2 Query Embedding
- Parsed query text → Google Multimodal Embedding 2 → 1408-d query vector
- Lives in the same space as all stored memory vectors
- "Where did I leave my keys?" produces a vector similar to both a transcript mentioning keys AND a photo showing keys on a counter

### 7.3 Hybrid Search + Fusion Ranker
Three parallel searches, merged via Reciprocal Rank Fusion (RRF):

```
Query
  │
  ├──► (1) Vector similarity search
  │        query vec vs. all memory vecs in ChromaDB
  │        → top-k by cosine similarity
  │
  ├──► (2) Graph search
  │        extracted entities looked up in knowledge graph
  │        → all connected memory nodes retrieved
  │
  └──► (3) Temporal filter
           extracted time_ref narrows candidate set
           → memories within relevant time window
           │
           ▼
       Reciprocal Rank Fusion (RRF)
       Results appearing in multiple channels weighted higher
       Each result gets confidence score:
         high   = surfaced by 2–3 channels, strong match
         medium = surfaced by 1 channel, moderate match
         low    = weak single-channel match → Claude flags uncertainty
```

### 7.4 Claude Answer Generation
- Input: top-ranked retrieved memories (transcripts, image refs, entities, metadata)
- System prompt instructs Claude to:
  - Cite specific timestamps and locations
  - Distinguish user's speech from others'
  - Include confidence indicators
  - Offer follow-up actions ("Want me to show the photo?", "Add to calendar?")
  - When confidence is low: say so explicitly, do not hallucinate
- Multi-turn supported: "What else did we discuss?" uses previous turn's retrieved context as starting point for follow-up search

---

## 9. Proactive Notification Agent

### Trigger Mechanism: Event-Driven
The agent fires on context change events, not on a fixed timer.

**Trigger events:**
| Event | Description |
|---|---|
| `location_change` | User arrives at or leaves a place where a memory was captured |
| `new_capture_complete` | A capture window finishes processing — agent checks if it connects to existing open threads or upcoming commitments |
| `calendar_overlap` | Detected at metadata enrichment time — memory timestamp overlaps a calendar event |

**Agent evaluation logic (on each trigger):**
```
1. Are there upcoming commitments the user may have forgotten?
   → Check temporal index for deadlines / action items in next 24h

2. Does this location connect to a stored memory with an unresolved action item?
   → Traverse knowledge graph from current location node

3. Is the user about to meet someone they last spoke to days ago?
   → Check knowledge graph for person nodes connected to upcoming calendar events;
     retrieve last conversation; flag if it contained follow-up items

4. Does the new capture connect to an existing open thread?
   → Vector similarity between new memory and recent unresolved memories
```

**Output:** Claude API generates a concise, context-aware notification string. Intentionally infrequent — batched where multiple triggers fire close together to avoid notification fatigue.

**Example notifications:**
- "Your architecture doc for Prof Johnson is due in 3 days — discussed last Tuesday at 2:15 PM."
- "You're at Soma Coffee — last time you were here you noted an idea about ephemeral memory pools."
- "You mentioned following up with Ravi about the open positions. You're both attending the PM Club event tonight."

---

## 10. State Management

### Capture State Machine

```
           ┌─────────────────────────────────┐
           │           IDLE                  │
           │  microphone off, no upload      │
           └──────────┬──────────────────────┘
                      │ user starts recording / initiates upload
                      ▼
           ┌─────────────────────────────────┐
           │         LISTENING               │◄──────────────────┐
           │  VAD active, no speech detected │  (audio only)     │
           └──────────┬──────────────────────┘                   │
                      │ VAD: speech detected                      │ silence > 5s
                      ▼                                           │
           ┌─────────────────────────────────┐                   │
           │         RECORDING               │───────────────────┘
           │  audio buffer filling           │
           └──────────┬──────────────────────┘
                      │ recording ends / upload completes
                      ▼
           ┌─────────────────────────────────┐
           │         PROCESSING              │
           │  video: extract frames + audio  │
           │  image: embed directly          │
           │  audio: STT → NER → summarise   │
           └──────────┬──────────────────────┘
                      │ processing complete
                      ▼
           ┌─────────────────────────────────┐
           │         MEMORY STORED           │
           │  proactive agent evaluates      │──► notification? → emit
           └──────────┬──────────────────────┘
                      │
                      └──────────────────────► back to IDLE

Special states (override any of the above):
  PRIVACY_ZONE    — all capture silently disabled, no data collected
  QUIET_HOURS     — same as privacy zone; no capture between user-defined hours
  PAUSED          — user manually paused capture from UI
  OFFLINE         — on-device processing only; cloud jobs queued for later
```

### UI State
- `captureStatus`: `active` | `paused` | `privacy_zone` | `quiet_hours` | `offline`
- `queryState`: `idle` | `parsing` | `searching` | `generating` | `complete` | `error`
- `notificationQueue`: ordered list of proactive surfaces pending delivery

---

## 11. Local Storage Schema (On-Device SQLite)

Used as: (a) offline cache before cloud sync, (b) fast lookup for recent memories without cloud round-trip.

```sql
-- Capture sessions
CREATE TABLE capture_sessions (
  id              TEXT PRIMARY KEY,   -- uuid
  started_at      INTEGER NOT NULL,   -- unix timestamp
  ended_at        INTEGER,
  trigger         TEXT NOT NULL,      -- 'vad' | 'manual_upload'
  status          TEXT NOT NULL,      -- 'recording' | 'processing' | 'synced' | 'failed'
  place_name      TEXT,
  gps_lat         REAL,
  gps_lng         REAL,
  speaker_count   INTEGER DEFAULT 1
);

-- Memory objects (lightweight local copy; full vectors stored cloud-side)
CREATE TABLE memories (
  id              TEXT PRIMARY KEY,
  session_id      TEXT REFERENCES capture_sessions(id),
  created_at      INTEGER NOT NULL,
  summary         TEXT,
  transcript      TEXT,
  image_refs      TEXT,               -- JSON array of encrypted file paths
  confidence      REAL,
  synced          INTEGER DEFAULT 0   -- 0 = pending sync, 1 = synced
);

-- Entities (local NER results)
CREATE TABLE entities (
  id              TEXT PRIMARY KEY,
  memory_id       TEXT REFERENCES memories(id),
  type            TEXT NOT NULL,      -- 'person' | 'place' | 'object' | 'date' | 'action_item'
  value           TEXT NOT NULL,
  resolved_id     TEXT                -- links to knowledge graph node id (cloud)
);

-- Pending cloud jobs (for offline batching)
CREATE TABLE processing_queue (
  id              TEXT PRIMARY KEY,
  session_id      TEXT REFERENCES capture_sessions(id),
  job_type        TEXT NOT NULL,      -- 'whisper' | 'embedding' | 'ner' | 'summarise'
  payload_path    TEXT,               -- local file path
  status          TEXT DEFAULT 'pending',  -- 'pending' | 'in_flight' | 'done' | 'failed'
  retry_count     INTEGER DEFAULT 0,
  created_at      INTEGER NOT NULL,
  last_attempted  INTEGER
);

-- Privacy zones
CREATE TABLE privacy_zones (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  gps_lat         REAL NOT NULL,
  gps_lng         REAL NOT NULL,
  radius_metres   REAL DEFAULT 50
);

CREATE INDEX idx_memories_created_at ON memories(created_at);
CREATE INDEX idx_entities_memory_id ON entities(memory_id);
CREATE INDEX idx_entities_type_value ON entities(type, value);
CREATE INDEX idx_queue_status ON processing_queue(status);
```

---

## 12. API Rate Limiting & Batching Strategy

### Problem
Video uploads can produce a large batch of frames and embedding calls in one go. The strategy below ensures these are handled efficiently without overwhelming the Vertex AI API.

### Embedding API (Google Vertex AI — Multimodal Embedding 2)

All embedding calls are dispatched **after** a recording or upload completes — no streaming or live dispatch.

| Scenario | Input | Strategy |
|---|---|---|
| Video upload (60 min) | ~120 frames (1 per 30s) + transcript text | Extract all frames first; batch-embed in groups of 10; single pipeline run |
| Standalone image upload | 1–N images | Embed each image immediately; batch if N > 10 |
| Audio recording | Transcript text only | 1 text embed call after STT completes; no batching needed |
| OCR text from video frame | Text per frame | Coalesced into same batch as image embeds for that frame |

**Batching rules:**
- Max batch size: 10 items per Vertex AI call
- All jobs dispatched after upload/recording completes — no minimum dispatch interval needed
- If device is offline: queue all embedding jobs in `processing_queue` table; flush on reconnect
- Retry with exponential backoff: 1s → 2s → 4s → 8s → give up after 4 attempts, mark job `failed`

### Whisper API

- Short segments (<30s): on-device only, no API call
- Long segments: single API call per closed capture window; no batching needed
- Fallback: if Whisper API unavailable, run on-device `base` model (lower accuracy, no network)

### Claude API (Summarisation + Query Parsing + Answer Generation)

- Summarisation: 1 call per closed capture window; not latency-sensitive; can be deferred
- Query parsing: 1 call per user query; latency-sensitive; no batching
- Answer generation: 1 call per query turn; latency-sensitive; no batching
- Rate limit handling: if 429 received, surface "processing…" state in UI, retry after header-specified delay

---

## 13. Error States & Fallback Behaviour

### Capture Errors

| Error | Behaviour |
|---|---|
| Microphone permission denied | Show permission prompt; audio capture paused; no silent failure |
| Upload fails mid-transfer | Retry up to 3 times; if still failing, notify user; partial uploads discarded |
| VAD model fails to load | Fall back to time-based audio segments (record 60s, pause 10s) |
| Device storage full | Block new uploads; notify user; oldest unsynced captures purged first |
| Unsupported file format | Notify user; accepted formats: mp4, mov, mp3, wav, jpg, png |

### Processing Errors

| Error | Behaviour |
|---|---|
| Whisper API unavailable | Fall back to on-device `base` model; flag memory as "lower accuracy transcript" |
| Embedding API (Vertex AI) down | Queue job in `processing_queue`; retry on reconnect; memory stored without vectors (text-only fallback using keyword index) |
| NER model fails | Skip entity extraction for this window; memory stored without entity links; no crash |
| Claude summarisation fails | Store raw transcript only; summary field left empty; does not block memory storage |

### Retrieval Errors

| Error | Behaviour |
|---|---|
| Vector store query fails | Fall back to keyword search on transcript text |
| Knowledge graph unreachable | Run vector + temporal search only; skip graph traversal |
| Claude answer generation fails | Return raw retrieved memory snippets with timestamps, no generated prose |
| No relevant memories found | Claude responds: "I don't have a memory of that. It may have happened outside a capture window, or before you started using RecallAI." |
| Low confidence retrieval | Claude includes explicit uncertainty: "I found something that might be related, but I'm not certain it's what you're looking for." |

### Network / Offline

| State | Behaviour |
|---|---|
| Full offline | On-device capture continues; all cloud jobs queued; retrieval available for already-synced memories only |
| Intermittent connectivity | Jobs dispatched opportunistically; UI shows "syncing X items" indicator |
| Cloud sync on reconnect | `processing_queue` flushed in order; oldest jobs first; duplicate prevention via job id |

---

## 14. Privacy & Trust Architecture

- **On-device-first**: raw audio and video never leave the device; only transcripts, summaries, and embeddings are transmitted
- **Raw data lifecycle**: audio discarded after transcription; video discarded after frame extraction; extracted frames discarded after embedding; standalone images retained as assets
- **PII redaction**: regex + on-device NER strips credit card numbers, SSNs, passwords from screen captures before any processing
- **Privacy zones**: GPS compared against user-defined no-capture zones; all captures silently discarded if inside zone
- **Quiet hours**: user-defined time windows where capture is fully disabled
- **Consent framework**: multi-party conversations — app can announce itself, or operate in summary-only mode (gist captured, not verbatim speech of others)
- **Data sovereignty**: user can delete any individual memory, set auto-expiry rules, export entire memory store
- **Encryption**: end-to-end encryption for all stored data; zero-knowledge architecture where possible (cloud processing layer sees data only during processing, not at rest)

---

## 15. Technology Stack

| Component | Technology |
|---|---|
| Mobile app | React Native or Flutter (cross-platform) |
| Audio capture | Android AudioRecord API / iOS AVAudioEngine |
| VAD | Silero VAD (~2MB PyTorch model, on-device) |
| Video / image ingestion | File upload via device media picker |
| On-device STT | whisper.cpp (tiny / base model) |
| Cloud STT | Whisper API or self-hosted medium/large |
| Speaker diarisation | pyannote.audio (cloud-side) |
| OCR | Google ML Kit on-device text recognition |
| Embeddings | Google Multimodal Embedding 2 via Vertex AI |
| Vector store (prototype) | ChromaDB |
| Vector store (production) | PostgreSQL + pgvector |
| Knowledge graph (prototype) | PostgreSQL junction tables |
| Knowledge graph (production) | Neo4j |
| Temporal index | PostgreSQL with indexed timestamps |
| On-device cache | SQLite |
| Backend API | FastAPI (Python) |
| LLM | Claude API (query parsing, summarisation, answer generation, proactive agent) |
| Notifications | Firebase Cloud Messaging (FCM) |
| Deployment (prototype) | Local / single cloud instance |
| Deployment (production) | AWS / Azure containers |

---

## 16. Demo Ingestion Modes

The prototype supports two ingestion modes, both feeding the same processing pipeline. All processing is triggered **after** the recording or upload completes.

### Mode A — Manual Upload
- User uploads a video, audio file, or image via the mobile UI
- **Video**: pipeline extracts frames (1 per 30s) + audio track → both processed together → raw video discarded
- **Audio**: sent directly to Whisper STT → transcript → embed + NER + summarise
- **Image**: embedded directly via Google Multimodal Embedding 2 → stored
- Useful for pre-loading demo data (simulated "day in the life" captures)

### Mode B — Real-Time Audio Recording
- User presses record in the app; VAD manages speech segments
- On recording end: full pipeline triggers — STT → embed → NER → summarise → store
- No visual capture in real-time mode; user can separately upload images or video from the same session

### Demo Script (recommended for judges)
1. Pre-load 5–6 simulated captures via manual upload: advisor meeting (audio/video), coffee shop conversation with book recommendation (video with book cover visible), walking thought (audio), keys placed on counter (image), networking event interaction (audio)
2. Demonstrate 4–5 natural language queries:
   - "What did Professor Johnson say about the deadline?" → retrieves audio memory
   - "Where did I put my keys?" → text query matches uploaded image
   - "What was that book someone recommended?" → cross-modal: text query matches both audio transcript and image frame of book cover
   - "Who did I meet at the PM Club mixer?" → knowledge graph traversal
   - "Summarise what we decided in today's meeting" → structured output
3. Trigger a proactive notification surfacing a forgotten deadline
4. Show the memory timeline view

---

*End of RecallAI Technical Reference Document*
