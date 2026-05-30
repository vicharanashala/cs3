# Samagama FAQ Platform — Work Log

> For any session or collaborator picking up this project.

**Last updated:** 2026-05-29 16:19 GMT+5:30

---

## What is this project?

VINS/Samagama FAQ platform — a community-driven FAQ portal with an AI assistant (Yaksha).
- **Frontend:** React + Vite (port 5173) — `src/pages/FAQPortal.jsx`, `src/pages/YakshaAI.jsx`
- **Backend:** Express + NeonDB (port 3001) — `server/`
- **Repo:** `https://github.com/vicharanashala/cs3`
- **Branch:** `feat/yaksha-fix` (pending PR merge)

---

## How to run

```powershell
# Backend (port 3001)
cd "D:\c-files\my-project\samagama faq project\server"
node --env-file=.env index.js

# Frontend (port 5173)
cd "D:\c-files\my-project\samagama faq project"
npm run dev
```

---

## Architecture

### Search pipeline (critical)
- **No external embedding APIs** — purely PostgreSQL full-text search
- Uses `ts_rank` + `plainto_tsquery` + `ILIKE` substring fallback
- Always returns **exactly 3 FAQs** (pads with top-ranked if fewer found)
- `pg_trgm` NOT available on NeonDB — `similarity()` does not exist

### AI (Yaksha)
- **OpenAI `gpt-4o-mini`** for answer refinement (switched from Groq)
- Called only when search confidence ≥ 0.7
- Below that: direct `short_answer` from best match
- **Always returns an answer** — never null
- **Yaksha Gatekeeper** (NEW): evaluates community answers via `server/services/yaksha.service.js`

### Key files
| File | Purpose |
|------|---------|
| `server/services/embedding.service.js` | `searchWithFullText()` — PostgreSQL full-text + padding |
| `server/services/yaksha.service.js` | **NEW** — `evaluateAnswer()` — Yaksha AI gatekeeper for community answers |
| `server/routes/ai.routes.js` | `/api/ai/ask` — search → LLM → response |
| `server/routes/community.routes.js` | **NEW** — Community answer submission, disagree, issues |
| `server/routes/admin.routes.js` | FAQ CRUD + `/api/admin/popular` + **NEW** moderation queue |
| `server/db/neon.js` | NeonDB connection (lazy `getPool()`) |
| `server/db/community_schema.sql` | **NEW** — Community tables migration SQL |

---

## Current PR: `feat/yaksha-fix`

**Problem:** Off-topic queries ("python programming") returned `related_faqs: []` → Yaksha showed nothing.

**Fixes committed:**
1. `embedding.service.js` — pure PG full-text search, always returns 3 FAQs
2. `ai.routes.js` — always returns an answer, OpenAI only for score ≥ 0.7

**PR:** https://github.com/vicharanashala/cs3/pull/new/feat/yaksha-fix

---

## COMMUNITY-DRIVEN YAKSHA + UGC — IMPLEMENTATION LOG

### ✅ COMPLETED (2026-05-29 session)

#### Phase 1: Database Migration — DONE ✅
- Created `server/db/community_schema.sql` with 4 new tables
- Created `server/scripts/seed_community.js` migration script
- **Ran migration against NeonDB — all 4 tables confirmed:**
  - `users` — anonymous visitor identity (visitor_id, display_name, reputation)
  - `community_answers` — submitted answers with yaksha_decision enum, confidence, reasoning
  - `answer_history` — audit trail of approved answer edits
  - `issues` — escalations from disagree clicks + standalone complaints
- Added `yaksha_decision` enum type: `approved | spam | unclear`

#### Phase 2: Backend — DONE ✅

**Yaksha Evaluation Service** (`server/services/yaksha.service.js`):
- `evaluateAnswer(submittedText, officialAnswer, officialQuestion, approvedHistory)`
- Calls OpenAI `gpt-4o-mini` with structured prompt
- Compares: official answer + approved history + spam patterns
- Returns `{ decision: 'approved'|'spam'|'unclear', confidence: 0.0-1.0, reasoning: string }`
- Graceful fallback to 'unclear' if API fails

**Community Routes** (`server/routes/community.routes.js`):
- `POST /api/community/answers` — submit answer (anonymous, no registration)
  - Auto-creates visitor from visitor_id (localStorage UUID)
  - Yaksha evaluates with full context
  - Stores with decision + status
- `GET /api/community/faq/:id/answers` — get approved community answers
- `POST /api/community/answers/:id/disagree` — 1-click disagree → creates issue
- `POST /api/community/issues` — standalone issue/complaint
- `GET /api/community/issues` — list open issues (searchable)

**Admin Queue Endpoints** (added to `server/routes/admin.routes.js`):
- `GET /api/admin/queue?tab=spam|unclear` — moderation queue
- `PUT /api/admin/answers/:id` — approve/reject community answer
- `GET /api/admin/issues` — view all escalated issues
- `PUT /api/admin/issues/:id` — resolve/dismiss issue

**Server Mount** (`server/index.js`):
- Added `import communityRoutes` and `app.use('/api/community', communityRoutes)`

#### Phase 3: Frontend API Service — DONE ✅
- Added to `src/services/api.js`:
  - `submitCommunityAnswer()`, `getCommunityAnswers()`, `disagreeCommunityAnswer()`, `createIssue()`
  - `getAdminQueue()`, `adminReviewAnswer()`, `getAdminIssues()`, `adminResolveIssue()`

---

### 🔲 REMAINING (next session)

#### Phase 4: YakshaAI.jsx — Agree/Disagree UI
**Status:** ✅ DONE (2026-05-29 16:06)
- `ThumbsUp` / `ThumbsDown` buttons appear below every assistant message (after greeting, index > 0, only when related FAQs exist)
- Agree → green "Thanks for the feedback!" confirmation (no API call)
- Disagree → expands inline form with:
  - FAQ question shown for context
  - Textarea (min 10 chars, live counter)
  - Cancel / Submit Answer buttons
  - Submit Answer → calls `submitCommunityAnswer({faq_id, answer_text, visitor_id, ...})`
  - Visitor ID: stable UUID from `localStorage['samagama_visitor_id']` (auto-generated on first use)
- After submission: shows Yaksha evaluation result (decision badge + confidence % + reasoning)
- `index > 0` guard: greeting message (index=0) does NOT show feedback buttons
- Error state shown if API call fails

#### Phase 5: FAQPortal.jsx — Crowdsourcing Banner
**Status:** ✅ DONE (2026-05-29 16:09)
- **Backend:** `community_schema.sql` — `ALTER TABLE issues ADD COLUMN suggested_question TEXT`
- **Backend:** `community.routes.js` — `POST /issues` now accepts `suggested_question`; GET exposes it
- **Frontend API:** `createIssue()` updated to accept `suggested_question`
- **Hero button:** "💡 Suggest a New FAQ" button below subtitle, opens modal
- **No-results banner:** replaces "Ask Yaksha →" with "Suggest FAQ" + "Ask Yaksha →" buttons
- **SuggestNewFAQ modal:** 3-field form (question*, answer(optional), reason*) → submits to `createIssue({ suggested_question, reason })`
- Modal has success state, clear/close, backdrop click-to-dismiss, enter-key submit
- Uses same `samagama_visitor_id` localStorage key as YakshaAI.jsx

#### Phase 6: AdminDashboard.jsx — Moderation Queue
**Status:** ✅ DONE (2026-05-29 16:13)
- **New state:** `communityTab` ('unclear'|'spam'|'issues'), `queueItems`, `issueItems`, `queueLoadingId`
- **Fetchers:** `fetchQueue(tab)` + `fetchIssues()` — fire on tab change (auto-load on auth)
- **Actions:** `handleReviewAnswer(id, action)` → `adminReviewAnswer()` + remove from list; `handleResolveIssue(id, status)` → `adminResolveIssue()` + remove from list
- **Unclear/Spam tab:** cards show `yaksha_decision` badge + confidence + FAQ context + answer text + Yaksha reasoning + Approve/Reject buttons
- **Issues tab:** cards show suggested_question (if any) + reason + reporter + date + Resolve/Dismiss/Draft FAQ buttons
- "Draft FAQ" button pre-fills the existing draft modal with `suggested_question`
- Empty states with icon for all 3 tabs

---

### v1 Design Decisions (Simplified)
- **No user registration** — anonymous visitor_id from localStorage, no auth flow
- **Disagree = "Submit better answer"** — shown only when user disagrees with Yaksha
- **1 disagree = admin escalation** — single click creates issue
- **Yaksha is gatekeeper, not moderator** — decides approve/spam/unclear
- **Spam never shows to users** — goes straight to admin queue
- **Archive keeps only good** — spam deleted, not hidden
- **English only for Phase 1**
- **Admin converts approved answers → official FAQ** (not auto-generated)

---

## Pending work (non-community, in priority order)

### 1. Branding refinements (Change #5)
**Status:** Not started

VINS/Samagama-specific branding tweaks — as directed by sv.

### 2. Hero section tweaks (Change #6)
**Status:** Not started

As directed by sv.

---

## Lessons learned

- **pg_trgm not on NeonDB** — `similarity()` not available, must use `ts_rank` only
- **ESM + dotenv** — must use `node --env-file=.env` not `dotenv/config()`
- **Pool vs Client** — NeonDB free tier: single `pg.Client` for bulk ops, not Pool
- **File writes via agent** — write tool may not flush before process restart; verify with `Get-Content`
- **PowerShell command style** — use `-ErrorAction SilentlyContinue`, not `2>/dev/null`
- **Restart server** — port 3001 held by old process; kill with `Stop-Process -Id $_.OwningProcess`
- **OpenAI / Groq API Compatibility** — API key, base URL, and model are fully configurable via `.env` to avoid quota lock-ins (`OPENAI_BASE_URL`, `OPENAI_MODEL`).
- **`__none__` UUID placeholder crash** — Fixed a bug where a fake UUID `00000000-0000-0000-0000-000000000000` is needed instead of `'__none__'` for IN clauses fallback queries.
- **Yaksha AI Error Fallbacks** — LLM calls must have try-catch blocks that degrade gracefully to database direct-answers if API quotas are exceeded.

---

## Database schema

```sql
-- EXISTING
faqs: id, question, answer, short_answer, embedding, category, risk_level,
      is_onboarding_faq, status, created_at, updated_at

faq_history: id, faq_id, previous_answer, changed_at

queries: id, email, subject, description, status(enum), created_at, updated_at

search_logs: id, query_text, matched_faq_id, confidence_score, source, timestamp

-- NEW (community-driven UGC, migrated 2026-05-29)
users: id, username(unique), display_name, reputation, created_at

community_answers: id, faq_id, user_id, answer_text,
  yaksha_decision(enum: approved|spam|unclear), yaksha_confidence, yaksha_reasoning,
  context_used, disagree_count, status, created_at, updated_at

answer_history: id, community_answer_id, previous_text, changed_at

issues: id, community_answer_id, faq_id, reporter_username, reason, status, created_at
```

131 FAQs published. NeonDB connection string in `server/.env`.

---

## Contacts

- **sv** — owner, works late (midnight+ both nights), prefers incremental confirms

---

## YAKSHA V3 & AUTOMATED PIPELINE — IMPLEMENTATION LOG

### ✅ COMPLETED (2026-05-29 session)

#### 1. Yaksha Chatbot & Hybrid Search
- **Context Limits Solved:** Instead of passing all 131+ FAQs, we implemented Hybrid Search. PG Full-Text Search pulls the top 10 FAQs, and the LLM receives only those 10 as context for generating the final answer.
- **Query Rewriting:** Yaksha uses chat history to rewrite user queries (fixing pronouns like "it" or misspellings) *before* hitting PostgreSQL, ensuring perfect search terms.
- **Graceful Fallbacks:** If the AI API fails (e.g. Quota Exceeded), the backend catches the error and returns the exact database short_answer instead of crashing.

#### 2. Strict Auto-Write Evaluation & Dislike Flow
- **Direct-Write Logic:** `community.routes.js` will automatically `UPDATE` the `faqs` table if Yaksha evaluates a submission as 'strictly better' and factually aligned. The old answer is stored in `faq_history`.
- **Zero-Tolerance Gatekeeper:** `yaksha.service.js` strictly rejects duplicates or factual contradictions.
- **Unanswered FAQs:** Answers submitted to blank admin-created FAQs bypass AI and route to the Admin Queue directly.
- **UI Shift:** Removed Dislike reasons and manual 'Raise Query' buttons. Dislike instantly opens a 'Suggest Better Answer' form. Escalation is only possible if Yaksha provides a Markdown link in chat.
- **Provider Agnostic:** `OPENAI_BASE_URL` and `OPENAI_MODEL` supported in `.env` for easy Groq/TogetherAI pivoting.

---

## NEXT MAJOR FEATURE DESIGN: Future Enhancements (V4)

### Potential Ideas
1. **Semantic Embeddings Migration:** Replace PostgreSQL FTS with actual vector embeddings (e.g. pgvector or Pinecone) if the FAQ corpus grows beyond 500+ items and keyword search precision drops.
2. **True User Accounts:** Implement JWT/OAuth authentication for users so they can track their approved submissions and gain a visible "Reputation Score" leaderboard.
3. **Multi-Language Support:** Configure Yaksha to detect regional languages (Hindi, Kannada, etc.) and auto-translate FAQ answers on the fly.
4. **Rich Analytics Dashboard:** Build an Admin charts page showing search trends, confidence score averages over time, and most downvoted categories.
5. **UI Aesthetics Overhaul:** Migrate to a dark-mode "Apple Future" / Glassmorphism aesthetic as requested in previous UI experimentations.