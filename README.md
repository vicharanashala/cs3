# Samagama FAQ Platform (VINS Knowledge Vault)

A full-stack FAQ knowledge base platform powered by semantic vector search, LLM refinement, and real-time analytics. Built for the VINS (ViNe Software) community to self-serve answers and escalate unresolved issues to support engineers.

---

## 🏗️ Architecture Overview

```
Browser (React SPA)
       ↕
Express API Server (Port 3001)
       ↕
NeonDB (PostgreSQL + pgvector)
       ↕
OpenAI API (Embeddings + Chat)
```

**Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion + React Router + Axios
**Backend:** Express.js (ES Modules) + pg (NeonDB) + pgvector + OpenAI SDK
**Database:** NeonDB (PostgreSQL with `vector` extension, 1536-dim embeddings)
**AI:** OpenAI `text-embedding-3-small` for embeddings, `gpt-3.5-turbo` for LLM refinement

---

## 📁 Project Structure

```
samagama faq project/
├── src/
│   ├── main.jsx              # React entry point
│   ├── App.jsx               # Root component with router + context provider
│   ├── index.css             # Tailwind base styles
│   ├── store/
│   │   └── AppContext.jsx    # Global state (loading, confidence history, failed query)
│   ├── services/
│   │   └── api.js            # Axios client with auth interceptors
│   ├── pages/
│   │   ├── FAQPortal.jsx     # Main FAQ browse/search page
│   │   ├── YakshaAI.jsx      # AI chat with vector search
│   │   ├── EscalationForm.jsx # Support ticket submission
│   │   └── AdminDashboard.jsx # Admin metrics & knowledge gap management
│   └── components/
│       └── QualityMeter.jsx  # Ticket description quality scorer
├── server/
│   ├── index.js              # Express server entry point
│   ├── db/
│   │   ├── schema.sql        # Full DB schema with tables, enums, indexes
│   │   └── neon.js           # NeonDB connection pool + query helper
│   ├── middleware/
│   │   ├── errorHandler.js   # Global error handler with typed errors
│   │   └── adminAuth.js      # Admin key verification middleware
│   ├── routes/
│   │   ├── faq.routes.js     # FAQ CRUD + voting endpoints
│   │   ├── ai.routes.js      # Semantic search + LLM refinement
│   │   ├── query.routes.js   # Support ticket management
│   │   └── admin.routes.js   # Analytics, gaps, rage session detection
│   └── services/
│       ├── cache.service.js  # LRU cache (5-min TTL, max 1 entry)
│       └── embedding.service.js # OpenAI embedding generation
├── samagama_openclaw_master_pipeline.md # Full feature specification
└── README.md
```

---

## 🔌 API Endpoints

### FAQ Routes (`/api/faq`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/faq` | List all published FAQs (cached, 5-min TTL) |
| `GET` | `/api/faq/onboarding` | Get top 5 onboarding FAQs |
| `GET` | `/api/faq/:id` | Get single FAQ (full answer) |
| `GET` | `/api/faq/:id/history` | Get version history for an FAQ |
| `POST` | `/api/faq` | Create new FAQ (generates embedding) |
| `PUT` | `/api/faq/:id` | Update FAQ (logs history, regenerates embedding) |
| `POST` | `/api/faq/:id/vote` | Submit helpful/not helpful feedback |

### AI Routes (`/api/ai`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/ask` | Semantic search + LLM refinement + escalation routing |

### Query Routes (`/api/query`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/query` | Submit a support ticket |
| `GET` | `/api/query/:id` | Get ticket by ID |
| `PATCH` | `/api/query/:id` | Update ticket status (auto-generates FAQ on close) |

### Admin Routes (`/api/admin`) — require `x-admin-key` header
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/heatmap` | Avg confidence score per FAQ category |
| `GET` | `/api/admin/gaps` | Top 20 failed search queries (no match) |
| `GET` | `/api/admin/rage-sessions` | Queries with ≥4 failed attempts in 2 min |
| `GET` | `/api/admin/popular` | Most searched FAQs by volume |

---

## 🤖 AI Search Logic (Yaksha Intelligence)

The `/api/ai/ask` endpoint implements a **3-tier confidence pipeline**:

```
User Query
    │
    ▼
Generate embedding (text-embedding-3-small)
    │
    ▼
Vector search with temporal decay
(cosine similarity × freshness weight)
    │
    ├─► Score ≥ 0.96 → Return direct DB answer
    │   (source: "db")
    │
    ├─► Score 0.70–0.95 → LLM refinement via GPT-3.5-turbo
    │   (source: "llm")
    │
    └─► Score < 0.70 → Escalate to support ticket
        (source: "escalation")
```

**Temporal Decay Formula:**
```
confidence = (1 - cosine_distance) × (1 - 0.01 × max(0, days_since_update - 60))
```
FAQs older than 60 days get progressively penalized to surface fresher content.

---

## 📄 Pages & Features

### 1. FAQ Portal (`/`)
- **Onboarding Checklist** — 5 curated FAQs shown to first-time visitors (stored in `localStorage` to dismiss)
- **Hero Search Bar** — real-time suggestions as user types, shows confidence %
- **No-Results Prompt** — when search yields nothing, suggests asking Yaksha AI
- **FAQ Bento Grid** — category sidebar filters + expandable cards with:
  - Risk level badge (low/medium/high)
  - Stale info indicator (>90 days old)
  - Thumbs up/down feedback
  - Version history modal (previous vs current answer diff)
- **Frequently Asked Tiers** — ranked by search volume: Most Searched, Frequently Asked, Other Popular

### 2. Yaksha AI (`/yaksha`)
- **Chat interface** with markdown rendering (ReactMarkdown + rehype-sanitize)
- **Confidence sparkline** — real-time SVG graph of recent query confidence scores
- **Escape hatch banner** — triggers when:
  - Confidence score drops below 50%
  - 3+ queries in under 8 seconds (rage detection)
  - Backend returns `source: "escalation"`
- **Related FAQs** — top 3 semantic matches shown as clickable cards below each AI response
- **Pre-fill support** — accepts `?query=` state from FAQPortal

### 3. Escalation Form (`/escalate`)
- **Auto pre-fill** — description field populated from last failed Yaksha session
- **Duplicate detection** — live check against knowledge base as user types subject
- **Quality Meter** — scores description quality out of 5 (words > 20, has `?`, expected/actual/should/but keywords, length > 100, subject words ≥ 3)
- **Submit gates** — requires score ≥ 2 before enabling submission
- **Success state** — displays ticket tracking ID

### 4. Admin Dashboard (`/admin`)
- **Auth gate** — password prompt; key stored in `localStorage`, verified on each request
- **Confidence Heatmap** — table of categories sorted by weakest first, color-coded (green ≥85%, amber 70–84%, red <70%)
- **Knowledge Gaps** — failed queries table with "Draft FAQ" action button → opens modal with pre-filled question + category/risk/onboarding toggles
- **Rage Sessions Alert** — red banner with flame icon, auto-refreshes every 60 seconds
- **Toast notifications** — slide-in success/error toasts

---

## 🗄️ Database Schema

**Tables:**
- `faqs` — main FAQ store (question, answer, short_answer, embedding vector(1536), category, risk_level, is_onboarding_faq, status, timestamps)
- `faq_history` — audit trail of answer changes
- `queries` — support tickets (email, subject, description, status enum: open/review/closed)
- `search_logs` — every search event logged (query_text, matched_faq_id, confidence_score, source)

**Indexes:**
- IVFFlat index on `faqs.embedding` for fast cosine similarity search
- Indexes on `search_logs.matched_faq_id` and `search_logs.timestamp`
- Partial index on `faqs.is_onboarding_faq` for filtered onboarding queries

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ..
npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
# Edit .env with your values:
#   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
#   OPENAI_API_KEY=sk-...
#   ADMIN_KEY=your-secret-key
#   NODE_ENV=development
```

### 3. Set up database

Run `server/db/schema.sql` against your NeonDB database to create all tables, enums, and indexes.

### 4. Start development servers

```bash
# Terminal 1 — Backend
cd server
npm run dev   # runs node --watch index.js on port 3001

# Terminal 2 — Frontend
npm run dev   # Vite on port 5173
```

---

## 🔐 Security

- Admin routes protected by `x-admin-key` header verification middleware
- API key stored server-side only (never exposed to client)
- CORS restricted to `localhost:5173` in development, `FRONTEND_URL` in production
- All user input validated and sanitized before DB insertion
- Markdown in Yaksha AI responses sanitized via `rehype-sanitize`

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + Vite |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Routing | React Router v6 |
| HTTP Client | Axios (with interceptors) |
| Backend | Express.js (ES Modules) |
| Database | NeonDB PostgreSQL + pgvector |
| AI | OpenAI SDK (embeddings + chat) |
| Caching | lru-cache v10 |
| Icons | Lucide React |
| Markdown | ReactMarkdown + rehype-sanitize |