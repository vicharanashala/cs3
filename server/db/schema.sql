-- Step 1 — Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2 — Create ENUM type for query status
CREATE TYPE query_status AS ENUM ('open', 'review', 'closed');

-- Step 3 — Create tables
CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  short_answer VARCHAR(300),
  embedding vector(1536),
  category VARCHAR(100),
  risk_level VARCHAR(50),
  is_onboarding_faq BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'published',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faq_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faq_id UUID REFERENCES faqs(id) ON DELETE CASCADE,
  previous_answer TEXT NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status query_status DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_text TEXT NOT NULL,
  matched_faq_id UUID REFERENCES faqs(id) ON DELETE SET NULL,
  confidence_score FLOAT,
  source VARCHAR(20) DEFAULT 'text',
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Step 4 — Create indexes for performance
CREATE INDEX IF NOT EXISTS faqs_embedding_idx ON faqs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS search_logs_matched_faq_id_idx ON search_logs (matched_faq_id);
CREATE INDEX IF NOT EXISTS search_logs_timestamp_idx ON search_logs (timestamp);
CREATE INDEX IF NOT EXISTS faqs_is_onboarding_faq_idx ON faqs (is_onboarding_faq) WHERE is_onboarding_faq = true;
