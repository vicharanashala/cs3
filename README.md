# Samagama — The Intelligent FAQ & Community Platform

![Samagama Banner](https://via.placeholder.com/1200x400/111827/FFFFFF?text=SAMAGAMA+-+AI+Powered+Knowledge+Base)

**Samagama** is a next-generation, AI-driven Knowledge Base and Community Support platform built for the VINS/Samagama ecosystem. It goes beyond static FAQ pages by implementing a self-healing ecosystem where AI, Community Contributors, and Administrators collaborate to resolve user queries instantly.

---

## 🌟 Core Features

### 1. Yaksha AI — The Intelligent Gatekeeper & Assistant
* **Conversational Support**: A friendly AI assistant that answers questions using Retrieval-Augmented Generation (RAG).
* **3-Tier Confidence Pipeline**: 
  * *Tier 1 (High Confidence)*: Returns the official database answer instantly.
  * *Tier 2 (Medium Confidence)*: Uses LLM reasoning to synthesize multiple related FAQs into a cohesive answer.
  * *Tier 3 (Low Confidence)*: Gracefully escalates the user to raise a support ticket.
* **Automated Moderation**: Yaksha acts as a gatekeeper for community contributions, analyzing answers for substantive value, rejecting spam, and flagging borderline cases for admin review.

### 2. Community Hub
* **Crowdsourced Knowledge**: Users can view unresolved support queries and submit proposed answers.
* **Continuous Improvement**: The community can suggest better answers to existing FAQs.
* **Hash Tracking**: Contributors receive a unique tracking hash to follow their suggestion's journey through the moderation pipeline.

### 3. Admin Intelligence Dashboard
* **Knowledge Gaps**: Automatically identifies and groups frequent user searches that yield no FAQ results, allowing admins to draft new FAQs with one click.
* **Rage Session Detection**: Detects frustrated users repeatedly searching variations of the same failing query, alerting admins to immediate UX or documentation gaps.
* **Confidence Heatmap**: Visualizes the AI's success rate across different categories.
* **Centralized Moderation**: Approve, reject, or edit community submissions and directly reply to user support tickets.

### 4. "Apple Future" UI/UX
* **Seamless Dark/Light Mode**: First-class theming support with targeted CSS transitions.
* **Fluid Animations**: Powered by Framer Motion for buttery-smooth page transitions, modal popups, and expanding bento grids.
* **Markdown Rendering**: Beautifully formatted code snippets and rich text via `ReactMarkdown`.

---

## 🛠 Tech Stack

* **Frontend**: React.js (Vite), Tailwind CSS, Framer Motion, React Router, Lucide React.
* **Backend**: Node.js, Express.js.
* **Database**: PostgreSQL (Neon Serverless) with **`pgvector`** for semantic search and embeddings.
* **AI/LLM**: OpenAI / Groq APIs for generation and evaluation.

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* PostgreSQL database with `pgvector` extension enabled (Neon.tech recommended)
* OpenAI / Groq API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vicharanashala/cs3.git
   cd cs3
   ```

2. **Install Frontend Dependencies:**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies:**
   ```bash
   cd server
   npm install
   ```

4. **Environment Variables:**
   Create a `.env` file in the `/server` directory:
   ```env
   PORT=8080
   DATABASE_URL=postgres://user:pass@host/dbname
   OPENAI_API_KEY=your_api_key
   OPENAI_BASE_URL=https://api.groq.com/openai/v1 # Or leave blank for default OpenAI
   OPENAI_MODEL=llama-3.1-8b-instant
   ADMIN_KEY=your_secure_admin_password
   ```

5. **Initialize Database:**
   Ensure your PostgreSQL instance is running and execute the `server/db/schema.sql` file to create the necessary tables, types, and vector indices.

### Running the Application

**Start the Backend:**
```bash
cd server
npm run dev
```

**Start the Frontend:**
```bash
# In the root directory
npm run dev
```

The application will be available at `http://localhost:5173` (Frontend) and `http://localhost:8080` (Backend).

---

## 📂 Project Architecture

```
samagama-faq/
├── server/
│   ├── db/            # Neon DB connection & schema (pgvector)
│   ├── routes/        # Express routes (ai, admin, faq, community)
│   ├── services/      # Yaksha evaluation, Embeddings, Caching
│   └── index.js       # Express server entry point
├── src/
│   ├── components/    # Reusable UI (QualityMeter, etc.)
│   ├── pages/         # FAQPortal, YakshaAI, AdminDashboard, CommunityHub
│   ├── services/      # Axios API client
│   ├── store/         # React Context (State & Theme management)
│   └── App.jsx        # Routing and Layout
└── tailwind.config.js # Theming and Design System
```

---

## 🤝 Contributing
As a community-driven platform, we welcome contributions! Whether it's adding new FAQs via the Community Hub, reporting bugs, or submitting pull requests for UI enhancements, your input builds a better Samagama.

## 📄 License
Internal Proprietary Software - VINS / Samagama Ecosystem.