# RecallAI

AI-powered memory prosthetic designed for people with ADHD. Captures memories passively, organizes them with AI, and retrieves them conversationally.

## Features

- **Passive Capture** - Audio, image, and video capture with voice activity detection
- **AI Processing** - Automatic transcription (Whisper), summarization, entity extraction (spaCy), and embedding generation
- **Conversational Retrieval** - Ask natural language questions about your memories
- **Timeline View** - Browse memories by date with filtering
- **Proactive Notifications** - Context-aware memory surfacing
- **Privacy Controls** - Privacy zones, quiet hours, data retention policies, and full data export/delete

## Architecture

```
mobile/          React Native (Expo) mobile & web app
recallai/        FastAPI backend
  app/
    api/         REST endpoints (capture, chat, timeline, memories, privacy, notifications)
    models/      SQLAlchemy models (memories, entities, knowledge graph)
    services/    AI pipeline (retrieval, NER, summarization, vector search)
    workers/     Background processing pipeline
```

**Infrastructure**: PostgreSQL (pgvector) + ChromaDB + FastAPI

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- API keys: OpenAI (Whisper + embeddings), Anthropic (answer generation)

### Backend

```bash
# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start all services (PostgreSQL, ChromaDB, API)
docker compose up -d

# Seed demo data (optional)
curl -X POST http://localhost:8080/api/v1/demo/seed
```

The API will be available at `http://localhost:8080`. Docs at `http://localhost:8080/docs`.

### Mobile / Web App

```bash
cd mobile
npm install

# Run on web
npx expo start --web

# Run on iOS/Android (requires Expo Go or dev build)
npx expo start
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/v1/capture/upload/audio` | Upload audio for processing |
| `POST /api/v1/capture/upload/image` | Upload images for processing |
| `POST /api/v1/capture/upload/video` | Upload video for processing |
| `POST /api/v1/capture/record/start` | Start a live recording session |
| `POST /api/v1/capture/record/stop/{id}` | Stop recording and process |
| `POST /api/v1/chat` | Ask a question about your memories |
| `GET /api/v1/timeline` | Browse memories by date |
| `GET /api/v1/memories/{id}` | Get memory details |
| `GET /api/v1/notifications` | List proactive notifications |
| `DELETE /api/v1/privacy/all-data` | Delete all user data |

## Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (Whisper transcription + embeddings) |
| `ANTHROPIC_API_KEY` | Anthropic API key (answer generation) |
| `GOOGLE_CLOUD_API_KEY` | Google Cloud API key (optional) |
| `POSTGRES_*` | PostgreSQL connection settings |
| `CHROMA_HOST` / `CHROMA_PORT` | ChromaDB connection |

## License

MIT
