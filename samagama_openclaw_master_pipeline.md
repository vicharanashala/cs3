# SAMAGAMA FAQ PLATFORM — MASTER EXECUTION PIPELINE
# Target: MiniMax V2 (Strict Mode) via OpenClaw
# Instructions: Execute Call 0 first. Wait for confirmation. Then Call 1. Wait for all files. Then Call 2.
# Do NOT merge calls. Each call is a separate OpenClaw execution.

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## CALL 0 — INITIALIZATION SEED
## Purpose: Prime MiniMax output mode before heavy generation.
## Paste this alone first. Wait for acknowledgement before Call 1.
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
You are an execution engine generating a multi-file production codebase.

Rules:
- Every response must start directly with // FILE: and end at the last line of the last file.
- Do not summarize, explain, or add any text outside of code blocks.
- Do not add inline comments unless they are functional (no decorative comments).
- Do not add markdown formatting, headers, or separators between files.
- Each file must be complete — no placeholders, no "// TODO", no "// add logic here".
- Acknowledge these rules with exactly one line: "Execution engine ready."
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## CALL 1 — DATA ARCHITECTURE & EXPRESS BACKEND
## Purpose: Generate complete backend — DB schema, API routes, middleware, services.
## Paste after Call 0 is acknowledged. Wait for ALL files before running Call 2.
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
# SYSTEM: PRINCIPAL SYSTEMS ARCHITECT
Target: MiniMax V2 (Strict Mode).
Project: Samagama FAQ Platform — Backend Infrastructure.
Stack: Node.js (Express), NeonDB (PostgreSQL + pgvector extension).
Output Rule: Precede every file with its exact path like: // FILE: path/to/file.ext
Output ZERO conversational filler. Every file must be complete and production-ready.

---

# 1. DATABASE SCHEMA
// FILE: server/db/schema.sql

Generate SQL that does the following in this exact order:

Step 1 — Enable extensions:
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS vector;

Step 2 — Create ENUM type for query status:
  CREATE TYPE query_status AS ENUM ('open', 'review', 'closed');

Step 3 — Create tables:

Table: faqs
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4()
  question       TEXT NOT NULL
  answer         TEXT NOT NULL
  short_answer   VARCHAR(300)
  embedding      vector(1536)
  category       VARCHAR(100)
  risk_level     VARCHAR(50)
  is_onboarding_faq  BOOLEAN DEFAULT false
  status         VARCHAR(20) DEFAULT 'published'
  created_at     TIMESTAMP DEFAULT NOW()
  updated_at     TIMESTAMP DEFAULT NOW()

Table: faq_history
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4()
  faq_id           UUID REFERENCES faqs(id) ON DELETE CASCADE
  previous_answer  TEXT NOT NULL
  changed_at       TIMESTAMP DEFAULT NOW()

Table: queries
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4()
  email        VARCHAR(255)
  subject      TEXT NOT NULL
  description  TEXT NOT NULL
  status       query_status DEFAULT 'open'
  created_at   TIMESTAMP DEFAULT NOW()
  updated_at   TIMESTAMP DEFAULT NOW()

Table: search_logs
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4()
  query_text       TEXT NOT NULL
  matched_faq_id   UUID REFERENCES faqs(id) ON DELETE SET NULL
  confidence_score FLOAT
  source           VARCHAR(20) DEFAULT 'text'
  timestamp        TIMESTAMP DEFAULT NOW()

Step 4 — Create indexes for performance:
  CREATE INDEX ON faqs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  CREATE INDEX ON search_logs (matched_faq_id);
  CREATE INDEX ON search_logs (timestamp);
  CREATE INDEX ON faqs (is_onboarding_faq) WHERE is_onboarding_faq = true;

---

# 2. ENVIRONMENT CONTRACT
// FILE: server/.env.example

DATABASE_URL=
OPENAI_API_KEY=
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ADMIN_KEY=

---

# 3. PACKAGE DEFINITION
// FILE: server/package.json

Generate a valid package.json with:
  name: "samagama-backend"
  version: "1.0.0"
  type: "module"
  main: "index.js"
  scripts: { "start": "node index.js", "dev": "node --watch index.js" }
  dependencies:
    express: ^4.18.2
    pg: ^8.11.3
    pgvector: ^0.1.8
    lru-cache: ^10.2.0
    openai: ^4.28.0
    dotenv: ^16.4.1
    cors: ^2.8.5

---

# 4. ERROR HANDLER MIDDLEWARE
// FILE: server/middleware/errorHandler.js

Generate an Express error handler middleware that:
- Accepts (err, req, res, next) signature.
- Always returns JSON in this exact shape: { success: false, error: string, code: number }
- Maps known error types: 401 for AuthError, 404 for NotFoundError, 400 for ValidationError.
- Defaults to 500 for all unknown errors.
- In NODE_ENV=development, includes err.stack in the response.
- In NODE_ENV=production, strips stack traces entirely.

---

# 5. ADMIN AUTH MIDDLEWARE
// FILE: server/middleware/adminAuth.js

Generate Express middleware that:
- Reads req.headers['x-admin-key'].
- If it matches process.env.ADMIN_KEY exactly: calls next().
- If missing or mismatched: throws AuthError with message "Unauthorized" and HTTP 401.
- Import and throw using the custom error classes from errorHandler.js.

---

# 6. DATABASE CONNECTION
// FILE: server/db/neon.js

Generate a NeonDB/PostgreSQL connection module that:
- Uses the `pg` package Pool with DATABASE_URL from env.
- Exports a query function: async query(text, params).
- Logs query errors to console.error in development only.
- Exports the pool for transaction support.

---

# 7. LRU CACHE MODULE
// FILE: server/services/cache.service.js

Generate a cache module using lru-cache (v10+) that:
- Creates one LRUCache instance: max=1, ttl=300000 (5 minutes).
- Exports: get(key), set(key, value), del(key), flush().
- Cache key for all FAQs = "all_faqs".

---

# 8. EMBEDDING SERVICE
// FILE: server/services/embedding.service.js

Generate a service module that:
- Initializes OpenAI client with process.env.OPENAI_API_KEY.
- Exports async function generateEmbedding(text):
    - Calls openai.embeddings.create with model "text-embedding-3-small".
    - Returns the embedding array (vector of 1536 floats).
    - Throws a descriptive error if the API call fails.

---

# 9. FAQ ROUTES
// FILE: server/routes/faq.routes.js

Generate an Express router with these exact endpoints:

GET /api/faq
  - Check cache.get("all_faqs") first. If hit, return cached data.
  - If miss: SELECT id, question, short_answer, category, risk_level, is_onboarding_faq, updated_at FROM faqs WHERE status = 'published' ORDER BY created_at DESC
  - Store result in cache. Return { success: true, data: rows }.

GET /api/faq/onboarding
  - SELECT id, question, short_answer, category FROM faqs WHERE is_onboarding_faq = true AND status = 'published' LIMIT 5
  - Return { success: true, data: rows }.

GET /api/faq/:id
  - SELECT all fields except embedding FROM faqs WHERE id = $1
  - Return { success: true, data: row }.

GET /api/faq/:id/history
  - SELECT previous_answer, changed_at FROM faq_history WHERE faq_id = $1 ORDER BY changed_at DESC
  - Return { success: true, data: rows }.

POST /api/faq
  - Body: { question, answer, short_answer, category, risk_level, is_onboarding_faq }
  - Generate embedding from question + answer using embedding.service.js.
  - INSERT into faqs. Invalidate cache with cache.del("all_faqs").
  - Return { success: true, data: newRow }.

PUT /api/faq/:id
  - Body: { question, answer, short_answer, category, risk_level, is_onboarding_faq }
  - BEFORE updating: INSERT current answer into faq_history table.
  - UPDATE faqs SET all fields, updated_at = NOW() WHERE id = $1.
  - Regenerate and update embedding.
  - Invalidate cache with cache.del("all_faqs").
  - Return { success: true, data: updatedRow }.

POST /api/faq/:id/vote
  - Body: { helpful: boolean, reason?: "Outdated" | "Confusing" | "Broken" }
  - Log to search_logs with confidence_score = helpful ? 1.0 : 0.0.
  - Return { success: true }.

---

# 10. AI ROUTES
// FILE: server/routes/ai.routes.js

Generate an Express router with:

POST /api/ai/ask
  - Body: { query: string }
  - Step 1: Generate query embedding using embedding.service.js.
  - Step 2: Execute this exact SQL with temporal decay applied:
      SELECT 
        id, question, answer, short_answer, category, updated_at,
        (1 - (embedding <=> $1::vector)) * 
        (1 - (0.01 * GREATEST(0, DATE_PART('day', NOW() - updated_at) - 60))) 
        AS confidence_score
      FROM faqs
      WHERE status = 'published'
      ORDER BY confidence_score DESC
      LIMIT 1
  - Step 3: Apply score thresholds:
      >= 0.96: Return { success: true, answer: row.answer, source: "db", confidence: score }
      0.70 - 0.95: Call OpenAI chat completion with model "gpt-3.5-turbo", max_tokens: 30.
                   System prompt: "You are a concise FAQ assistant. Answer in one sentence."
                   User prompt: Inject the user query and matched FAQ context.
                   Return { success: true, answer: llmResponse, source: "llm", confidence: score }
      < 0.70: Insert into search_logs with matched_faq_id = NULL.
              Return { success: true, answer: null, source: "escalation", confidence: score }
  - Always insert to search_logs regardless of score tier.

---

# 11. QUERY ROUTES
// FILE: server/routes/query.routes.js

Generate an Express router with:

POST /api/query
  - Body: { email, subject, description }
  - INSERT into queries. Return { success: true, data: newRow }.

GET /api/query/:id
  - SELECT * FROM queries WHERE id = $1
  - Return { success: true, data: row }.

PATCH /api/query/:id
  - Body: { status: "open" | "review" | "closed" }
  - UPDATE queries SET status = $1, updated_at = NOW() WHERE id = $2.
  - If new status is "closed": Call OpenAI with this exact prompt:
      System: "You are a technical FAQ generator. Return only valid JSON."
      User: "Convert this support complaint into a clean FAQ entry.
             Subject: {subject}
             Description: {description}
             Return JSON: { question: string, answer: string }"
    Parse the JSON response. INSERT into faqs with status = 'pending_review',
    is_onboarding_faq = false. Generate and store embedding.
  - Return { success: true, data: updatedRow }.

---

# 12. ADMIN ROUTES
// FILE: server/routes/admin.routes.js

Apply adminAuth middleware to ALL routes in this file.

GET /api/admin/gaps
  Execute exactly:
  SELECT query_text, COUNT(*) as frequency
  FROM search_logs
  WHERE matched_faq_id IS NULL
  GROUP BY query_text
  ORDER BY frequency DESC
  LIMIT 20;
  Return { success: true, data: rows }.

GET /api/admin/heatmap
  Execute exactly:
  SELECT 
    f.category,
    ROUND(AVG(s.confidence_score)::numeric, 3) as avg_confidence,
    COUNT(*) as volume
  FROM search_logs s
  JOIN faqs f ON s.matched_faq_id = f.id
  GROUP BY f.category
  ORDER BY avg_confidence ASC;
  Return { success: true, data: rows }.

GET /api/admin/rage-sessions
  Execute exactly:
  SELECT 
    query_text,
    COUNT(*) as attempts,
    MIN(timestamp) as start_time
  FROM search_logs
  WHERE confidence_score < 0.70
  AND timestamp > NOW() - INTERVAL '2 minutes'
  GROUP BY query_text
  HAVING COUNT(*) >= 4
  ORDER BY attempts DESC;
  Return { success: true, data: rows }.

---

# 13. MAIN SERVER ENTRY
// FILE: server/index.js

Generate the Express server entry file that:
- Loads dotenv.
- Initializes Express app with express.json() and express.urlencoded().
- Configures CORS:
    In development (NODE_ENV=development): origin = "http://localhost:5173"
    In production: origin = process.env.FRONTEND_URL
    credentials: true
    methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Mounts routes:
    /api/faq     → faq.routes.js
    /api/ai      → ai.routes.js
    /api/query   → query.routes.js
    /api/admin   → admin.routes.js
- Mounts errorHandler middleware last.
- Health check: GET /health returns { status: "ok", timestamp: new Date() }
- Starts server on process.env.PORT || 3001.

---

# REQUIRED FILES TO GENERATE — IN THIS EXACT ORDER:
// FILE: server/package.json
// FILE: server/.env.example
// FILE: server/db/schema.sql
// FILE: server/db/neon.js
// FILE: server/middleware/errorHandler.js
// FILE: server/middleware/adminAuth.js
// FILE: server/services/cache.service.js
// FILE: server/services/embedding.service.js
// FILE: server/routes/faq.routes.js
// FILE: server/routes/ai.routes.js
// FILE: server/routes/query.routes.js
// FILE: server/routes/admin.routes.js
// FILE: server/index.js
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## CALL 2 — REACT FRONTEND & BEHAVIORAL UX MATRIX
## Purpose: Generate complete frontend — all pages, components, state, config.
## Paste ONLY after Call 1 has finished generating all 13 files.
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
# SYSTEM: UX ARCHITECT & BEHAVIORAL ENGINEER
Target: MiniMax V2 (Strict Mode).
Project: Samagama FAQ Platform — Frontend.
Stack: Vite + React + Tailwind CSS + Framer Motion + Axios.
Design Language: "White Minimalist SaaS".
  Background: #FDFDFD
  Font: Geist or Inter (fallback: system-ui)
  Borders: 1px solid #E5E7EB (soft gray)
  Accent: #111827 (near black)
  Zero neon. Zero heavy gradients. All shadows must be subtle (shadow-sm only).
  Icons: lucide-react only. No other icon library.
Output Rule: Precede every file with its exact path like: // FILE: path/to/file.ext
Output ZERO conversational filler. Every file must be complete and production-ready.

---

# 1. PACKAGE DEFINITION
// FILE: package.json

Generate a valid package.json with:
  name: "samagama-frontend"
  version: "1.0.0"
  type: "module"
  scripts: { "dev": "vite", "build": "vite build", "preview": "vite preview" }
  dependencies:
    react: ^18.2.0
    react-dom: ^18.2.0
    react-router-dom: ^6.22.0
    react-markdown: ^9.0.1
    rehype-sanitize: ^6.0.0
    framer-motion: ^11.0.8
    tailwindcss: ^3.4.1
    axios: ^1.6.7
    lucide-react: ^0.330.0
    autoprefixer: ^10.4.17
    postcss: ^8.4.35

---

# 2. VITE CONFIG
// FILE: vite.config.js

Generate vite config that:
- Uses @vitejs/plugin-react.
- Proxies all /api requests to http://localhost:3001.
  Proxy config: { target: "http://localhost:3001", changeOrigin: true }

---

# 3. TAILWIND CONFIG
// FILE: tailwind.config.js

Generate tailwind config that:
- Scans: ["./index.html", "./src/**/*.{js,jsx}"]
- Extends theme with:
    fontFamily: { sans: ["Geist", "Inter", "system-ui", "sans-serif"] }
    colors: { brand: { DEFAULT: "#111827", muted: "#6B7280", light: "#F9FAFB" } }

---

# 4. GLOBAL APP CONTEXT
// FILE: src/store/AppContext.jsx

Generate a React Context module that:
- Creates AppContext with createContext.
- AppProvider component wraps children with this exact state shape:
    {
      lastFailedQuery: string (default: ""),
      confidenceHistory: float[] (default: []),
      activeView: "faq" | "yaksha" | "escalation" | "admin" (default: "faq"),
      isLoading: boolean (default: false)
    }
- Exports useApp() custom hook that calls useContext(AppContext).
- Exports AppProvider as default.
- State updaters: setLastFailedQuery, pushConfidence(score), setActiveView, setIsLoading.
- isLoading: must be set to true before any axios call and false in the finally block.
  When isLoading is true: disable all form inputs and buttons across the app.

---

# 5. AXIOS API SERVICE
// FILE: src/services/api.js

Generate an axios instance module that:
- Base URL: /api (proxied by Vite to localhost:3001).
- Default headers: Content-Type: application/json.
- Request interceptor: reads localStorage.getItem("adminKey") and appends
  as x-admin-key header if present.
- Response interceptor: on 401, clears localStorage adminKey and redirects to /admin.
- Exports these named async functions (all wrapped in try/catch):
    getFAQs()                        → GET /faq
    getOnboardingFAQs()              → GET /faq/onboarding
    getFAQById(id)                   → GET /faq/:id
    getFAQHistory(id)                → GET /faq/:id/history
    createFAQ(data)                  → POST /faq
    updateFAQ(id, data)              → PUT /faq/:id
    voteFAQ(id, data)                → POST /faq/:id/vote
    askAI(query)                     → POST /ai/ask
    submitQuery(data)                → POST /query
    getQueryById(id)                 → GET /query/:id
    updateQueryStatus(id, status)    → PATCH /query/:id
    getAdminGaps()                   → GET /admin/gaps
    getAdminHeatmap()                → GET /admin/heatmap
    getAdminRageSessions()           → GET /admin/rage-sessions

---

# 6. MAIN APP ROUTER
// FILE: src/App.jsx

Generate the root App component that:
- Wraps entire app in AppProvider from AppContext.
- Uses react-router-dom BrowserRouter with these routes:
    /          → FAQPortal
    /yaksha    → YakshaAI
    /escalate  → EscalationForm
    /admin     → AdminDashboard
- Wraps <Routes> in Framer Motion <AnimatePresence mode="wait">.
- Each page transition: initial={{ opacity: 0, y: 8 }}, animate={{ opacity: 1, y: 0 }},
  exit={{ opacity: 0, y: -8 }}, transition={{ duration: 0.2 }}.
- Renders a top Navbar with links to all 4 pages using lucide-react icons:
    / → BookOpen icon → "FAQ"
    /yaksha → Bot icon → "Yaksha AI"
    /escalate → MessageSquare icon → "Raise Query"
    /admin → LayoutDashboard icon → "Admin"
  Active link gets font-weight: 600 and border-bottom: 2px solid #111827.

---

# 7. PAGE 1 — FAQ PORTAL
// FILE: src/pages/FAQPortal.jsx

Generate a complete React page component with these sections:

Section A — Onboarding Checklist (renders only on first mount):
  - Call getOnboardingFAQs() on mount.
  - Render a highlighted section with heading "Start Here" and a BookOpen icon.
  - Display up to 5 FAQ items as clickable cards with the question text.
  - Use framer-motion AnimatePresence with layout={true} on the list.
  - Store dismissed state in localStorage key "onboarding_dismissed".
    If key exists, do not render this section.
  - Show a dismiss button (X icon) that sets localStorage key and hides the section.

Section B — Hero Search Bar:
  - Single text input, full width, with Search icon inside (lucide-react).
  - Debounced at 300ms using useCallback + setTimeout.
  - On each debounced keystroke: call askAI(query) from api.js.
  - Render up to 5 suggestion results as a dropdown below the input.
  - Each suggestion shows: question text, category badge, confidence score as percentage.
  - Clicking a suggestion opens the full answer in an expandable panel below.

Section C — FAQ Bento Grid:
  - Call getFAQs() on mount.
  - Layout: CSS grid, 2 columns on desktop, 1 column on mobile.
  - Left column: FAQ question cards sorted by category.
  - Right column: Category filter chips (unique categories extracted from FAQ data).
    Clicking a chip filters the left column.
  - Each FAQ card renders:
    1. Question text (font-weight: 500)
    2. Category badge (gray pill)
    3. Risk badge: if risk_level is not null, render colored badge:
       low = green, medium = amber, high = red.
    4. Stale badge: if updated_at is more than 90 days ago, render
       orange badge with TriangleAlert icon and text "Stale Info".
    5. Version history button: Clock icon. On click, call getFAQHistory(id).
       Render a modal with two side-by-side diff panels:
         Left panel: previous_answer, background #FFF5F5, label "Previous"
         Right panel: current answer, background #F5FFF7, label "Current"
         Show changed_at timestamp above each panel.
    6. Feedback row at bottom of each card:
       ThumbsUp button and ThumbsDown button.
       On ThumbsUp: call voteFAQ(id, { helpful: true }). Show green checkmark.
       On ThumbsDown: expand an inline panel with 3 choice buttons:
         "Outdated" | "Confusing" | "Broken"
         On choice click: call voteFAQ(id, { helpful: false, reason: choice }). Collapse panel.

---

# 8. PAGE 2 — YAKSHA AI
// FILE: src/pages/YakshaAI.jsx

Generate a complete React page component with:

Layout: Two-column on desktop. Left = chat interface. Right = confidence sparkline panel.

Chat Interface:
  - Message history list. Each message: { role: "user" | "assistant", content: string, confidence?: float }
  - User messages: right-aligned, dark background.
  - Assistant messages: left-aligned, white card with subtle border.
  - Assistant messages render content using react-markdown with rehype-sanitize plugin.
  - Code blocks inside markdown must have a Copy button (Clipboard icon) in top-right corner.
    On click: navigator.clipboard.writeText(codeContent). Button changes to Check icon for 2s.

Ghost Preview (skeleton loader):
  - While isLoading is true: render 3 horizontal skeleton bars with these widths: 100%, 80%, 60%.
  - Apply CSS: background: #E5E7EB, border-radius: 4px, height: 16px.
  - Apply blur filter: filter: blur(3px). Do NOT use a spinner.

Confidence Sparkline Panel (right column):
  - Heading "Confidence" with TrendingUp icon.
  - Render inline SVG polyline from confidenceHistory array in AppContext.
  - SVG dimensions: width=120px, height=32px, viewBox="0 0 120 32".
  - Map each score to: x = (index / max(1, history.length - 1)) * 110 + 5, y = 32 - (score * 28) + 2
  - Polyline: stroke="#111827", stroke-width="1.5", fill="none".
  - Below sparkline: show latest confidence score as percentage text.

Proactive Escape Hatch:
  - Track: lastQueryTime (timestamp of last submission) and queryCount (resets every 8 seconds).
  - Condition 1: If latest confidence score < 0.50 after any response.
  - Condition 2: If 3 or more queries submitted within 8 seconds.
  - When either condition is true: render a CTA banner at the top of chat:
    Yellow background (#FEF9C3), AlertTriangle icon, text "Looks like you need more help."
    Button: "Raise a Ticket →" that navigates to /escalate using react-router-dom useNavigate.
    Before navigating: call setLastFailedQuery with the last user query text from AppContext.

Input row:
  - Textarea (single line), placeholder "Ask Yaksha anything...".
  - Send button with Send icon. Disabled when isLoading is true.
  - On submit: push user message to history. Call askAI(query). Push assistant response.
    Call pushConfidence(response.confidence) from AppContext.
    If source === "escalation": automatically trigger Escape Hatch CTA.

---

# 9. PAGE 3 — ESCALATION FORM
// FILE: src/pages/EscalationForm.jsx

Generate a complete React form page component with:

Form fields:
  - Email input (type="email", required)
  - Subject input (type="text", required)
  - Description textarea (required, minimum 20 characters)

Pass-Through:
  - On mount: read lastFailedQuery from AppContext.
  - If not empty: pre-fill Description field with lastFailedQuery value.
  - Show a blue info banner: "Pre-filled from your last AI session" with Info icon.

Live Duplicate Detection on Subject field:
  - Debounce at 400ms.
  - On each keystroke: call askAI(subjectValue).
  - If response.confidence > 0.60 and source !== "escalation":
    Slide down a panel with yellow background (#FEF9C3), Lightbulb icon:
    "Similar issue already solved → [question text]"
    Include a "View Answer →" button that navigates to /yaksha with the question pre-filled.
  - If confidence <= 0.60 or no match: hide the panel.
  - Panel animation: framer-motion height animation from 0 to auto.

Quality Meter component:
  - Import and render QualityMeter component passing { description, subject } as props.
  - Position below the Description textarea.

Submit button:
  - Disabled when isLoading is true or score < 2.
  - On submit: call submitQuery({ email, subject, description }).
  - On success: show green success banner with CheckCircle icon:
    "Your query has been submitted. Track it with ID: [id]"
  - Clear form fields after success.

---

# 10. QUALITY METER COMPONENT
// FILE: src/components/QualityMeter.jsx

Generate a React component that accepts props: { description, subject }.

Score logic (compute on every render, no useEffect needed):
  let score = 0;
  if (description.split(' ').length > 20) score += 1;
  if (description.includes('?')) score += 1;
  if (/expected|actual|should|but/i.test(description)) score += 1;
  if (description.length > 100) score += 1;
  if (subject.split(' ').length >= 3) score += 1;

Render:
  - Label: "Description quality" with small score text: "{score}/5".
  - 5 dot indicators in a row.
    Filled dot (dark): for index < score.
    Empty dot (gray border): for index >= score.
  - Below dots: contextual hint text based on score:
      0-1: "Add more detail to help the team understand your issue."
      2-3: "Good start. Adding expected vs actual behaviour helps."
      4-5: "Great description. Your query will be resolved faster."
  - Color of hint text: red for 0-1, amber for 2-3, green for 4-5.

---

# 11. PAGE 4 — ADMIN DASHBOARD
// FILE: src/pages/AdminDashboard.jsx

Generate a complete React page component with:

Auth Gate:
  - On mount: read localStorage.getItem("adminKey").
  - If null or empty: render a centered password prompt card:
    Input (type="password"), placeholder "Enter admin key".
    Submit button. On submit: localStorage.setItem("adminKey", value). Re-render.
  - If key exists: render the full dashboard.

Dashboard layout: 3 sections stacked vertically.

Section 1 — Confidence Heatmap:
  - Fetch getAdminHeatmap() on mount.
  - Render a grid table with columns: Category | Avg Confidence | Volume.
  - Color-code the Avg Confidence cell:
      >= 0.85: green background (#F0FFF4), green text.
      0.70 - 0.84: amber background (#FFFBEB), amber text.
      < 0.70: red background (#FFF5F5), red text.
  - Sort rows by avg_confidence ascending (weakest categories first).

Section 2 — Knowledge Gaps:
  - Fetch getAdminGaps() on mount.
  - Render a table with columns: Query | Frequency | Action.
  - "Draft FAQ" button in Action column (PenLine icon).
  - On click: open a modal with these fields:
      question: pre-filled with query_text (editable input)
      answer: empty textarea (required)
      category: dropdown populated from unique categories in heatmap data
      risk_level: dropdown with options: low, medium, high
      is_onboarding_faq: toggle switch (default: false, label "Onboarding FAQ?")
    Submit button calls createFAQ(data) from api.js.
    On success: close modal, show green toast "FAQ created successfully".
    Use framer-motion AnimatePresence for modal enter/exit.

Section 3 — Rage Sessions Alert:
  - Fetch getAdminRageSessions() on mount.
  - If data is empty: render nothing.
  - If data has items: render a red-bordered alert card with Flame icon:
    Heading: "Stuck Users Detected"
    Each item as a row: "[query_text] — [attempts] failed attempts in the last 2 minutes"
  - Auto-refresh this section every 60 seconds using setInterval in useEffect.
  - Cleanup interval on component unmount.

---

# REQUIRED FILES TO GENERATE — IN THIS EXACT ORDER:
// FILE: package.json
// FILE: vite.config.js
// FILE: tailwind.config.js
// FILE: src/store/AppContext.jsx
// FILE: src/services/api.js
// FILE: src/App.jsx
// FILE: src/pages/FAQPortal.jsx
// FILE: src/pages/YakshaAI.jsx
// FILE: src/pages/EscalationForm.jsx
// FILE: src/components/QualityMeter.jsx
// FILE: src/pages/AdminDashboard.jsx
```

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## EXECUTION ORDER REMINDER
## 1. Paste CALL 0. Wait for "Execution engine ready."
## 2. Paste CALL 1. Wait for ALL 13 files to finish generating.
## 3. Paste CALL 2. Wait for ALL 11 files to finish generating.
## Do NOT interrupt mid-generation or merge calls.
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
