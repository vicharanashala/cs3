# Samagama FAQ Platform — Quality Assurance & Bug Report

As a world-class QA and Systems Architect, I have performed a deep-dive code review and execution audit of the Samagama FAQ repository. Below is a comprehensive breakdown of critical bugs, structural flaws, pipeline gaps, and UX friction points found across the application.

---

## 1. Critical Workflow & Pipeline Gaps

### 🚨 Orphaned "Pending Review" FAQs (No Admin Moderation Workflow)
- **File affected:** [query.routes.js](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/server/routes/query.routes.js#L110-L113)
- **Description:** When an admin resolves and closes a support ticket (`PATCH /api/query/:id`), the backend automatically uses GPT-3.5 to draft a corresponding FAQ entry and inserts it into the database with `status = 'pending_review'`. 
- **The Bug:** There is **no API endpoint** to approve, publish, edit, or delete pending FAQs, and the admin dashboard completely lacks a panel to review them. These drafted entries remain orphaned in the database forever and can never be published to the frontend.

---

## 2. Database & Search Pipeline Bugs

### 🚨 Vector Search Null-Sorting Masking Best Matches
- **File affected:** [ai.routes.js](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/server/routes/ai.routes.js#L25-L35)
- **Description:** In the `/api/ai/ask` route, the query computes the semantic confidence score using pgvector:
  ```sql
  SELECT id, question, answer, short_answer, category, updated_at,
         (1 - (embedding <=> $1::vector)) * (1 - (0.01 * ...)) AS confidence_score
  FROM faqs WHERE status = 'published' ORDER BY confidence_score DESC LIMIT 1;
  ```
- **The Bug:** If any published FAQ does not have a generated embedding (due to incomplete seeding or external imports), the term `embedding <=> $1::vector` returns `NULL`. In PostgreSQL, an `ORDER BY DESC` query sorts `NULL` values **first** by default. This causes the query to return the NULL-embedding FAQ, yielding a score of `NaN` (coerced to `0.0`), completely masking actual high-confidence matches in the database.

### 🚨 Database Design Flaw: Inaccurate Vector Indexing (`ivfflat`)
- **File affected:** [schema.sql](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/server/db/schema.sql#L50)
- **Description:** The database schema creates an `ivfflat` index on an empty table:
  ```sql
  CREATE INDEX ON faqs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ```
- **The Bug:** `ivfflat` indexes require the database to be populated before creation because they perform K-means clustering to define center lists. Creating it on an empty table yields poor search recall. Additionally, pgvector requires at least 1,000+ rows for `ivfflat` to be effective. For small knowledge bases, `HNSW` should be used instead since it does not require training and works perfectly on empty tables.

---

## 3. High-Risk Transaction & Performance Anti-Patterns

### 🚨 External API Calls Executed Inside Active Database Transactions
- **Files affected:** [query.routes.js](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/server/routes/query.routes.js#L88-L113) & [faq.routes.js](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/server/routes/faq.routes.js#L153-L174)
- **Description:** During ticket closure (`PATCH /api/query/:id`) and FAQ updates (`PUT /api/faq/:id`), the routes acquire a database client from the pool, start a transaction (`BEGIN`), and then make external HTTP calls to OpenAI (`openai.chat.completions.create` and `generateEmbedding`).
- **The Bug:** If OpenAI experiences latency, rate limiting, or connection timeouts, the database connection is held open in an active transaction block. Under moderate user load, this will exhaust the Express/Pg connection pool, causing the entire backend server to freeze and crash.

---

## 4. Logical Bugs in Admin Analytics

### 🚨 Analytics Heatmap Skewed by User Feedback Votes
- **File affected:** [admin.routes.js](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/server/routes/admin.routes.js#L31-L39)
- **Description:** The confidence heatmap endpoint joins `search_logs` with `faqs` to calculate average query confidence per category:
  ```sql
  SELECT f.category, ROUND(AVG(s.confidence_score)::numeric, 3) as avg_confidence, COUNT(*) as volume
  FROM search_logs s JOIN faqs f ON s.matched_faq_id = f.id ...
  ```
- **The Bug:** When users click Thumbs Up/Down on the frontend, it inserts a feedback log into `search_logs` with a score of `1.0` or `0.0`. Because the heatmap query doesn't filter out `source = 'vote'`, these vote records are treated as user searches, heavily skewing the average confidence of the search engine.

### 🚨 Vote Logs Triggering False "Rage Sessions"
- **File affected:** [admin.routes.js](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/server/routes/admin.routes.js#L51-L61)
- **Description:** The Rage Session detector identifies queries with low confidence:
  ```sql
  SELECT query_text, COUNT(*) as attempts ... WHERE confidence_score < 0.70 ... GROUP BY query_text HAVING COUNT(*) >= 4
  ```
- **The Bug:** Since downvotes log a confidence of `0.0` and write feedback reasons (e.g., `Downvote: Confusing`) to `query_text`, if 4 users downvote FAQs with the same reason within 2 minutes, the admin dashboard will incorrectly report `"Downvote: Confusing"` as a user rage search session.

---

## 5. UI & UX Friction Points

### ⚠️ Excessive Gatekeeping in Support Ticket Submission
- **Files affected:** [QualityMeter.jsx](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/src/components/QualityMeter.jsx) & [EscalationForm.jsx](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/src/pages/EscalationForm.jsx#L97)
- **Description:** The Escalation Form disables the submit button if the quality meter score is less than 2.
- **The Friction:** The scoring system relies on rigid heuristic checks (e.g. description must contain words like "expected", "actual", "should", "but", or contain a question mark). If a user writes a concise, grammatically correct issue (e.g. *"The server throws a 500 error on /api/faq when I submit.*"), they are locked out of submitting a ticket with no clear instructions on how to bypass the barrier.

### ⚠️ Broken Onboarding FAQ Answers
- **File affected:** [faq.routes.js](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/server/routes/faq.routes.js#L34-L41) & [FAQPortal.jsx](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/src/pages/FAQPortal.jsx#L318)
- **Description:** The onboarding API endpoint `GET /api/faq/onboarding` omits the `answer` column:
  ```sql
  SELECT id, question, short_answer, category FROM faqs WHERE is_onboarding_faq = true AND status = 'published' LIMIT 5;
  ```
- **The Bug:** When a user clicks an onboarding FAQ card in the checklist, the UI attempts to show the full answer but displays `undefined` (falling back to `short_answer`), preventing users from reading onboarding details in the portal.

### ⚠️ Sticky Escape Hatch State Leak
- **File affected:** [YakshaAI.jsx](file:///c:/Users/udayk/OneDrive/Desktop/FAQ/cs3/src/pages/YakshaAI.jsx#L119-L122)
- **Description:** Once the "Raise a Ticket" escape hatch banner is triggered in the chat, it is never hidden or reset, even if the user subsequently executes high-confidence queries. Additionally, subsequent queries overwrite `failedQueryText`, causing the ticket pre-fill description to load the user's latest successful query instead of the failed one.
