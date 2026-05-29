-- ============================================================
-- Community-Driven Yaksha + UGC Schema Migration
-- Run AFTER existing schema.sql tables are in place
-- ============================================================

-- 1. Yaksha decision enum
DO $$ BEGIN
  CREATE TYPE yaksha_decision AS ENUM ('approved', 'spam', 'unclear');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Users table (simple community identity, no auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  reputation INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Community answers submitted by users to existing FAQs
CREATE TABLE IF NOT EXISTS community_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faq_id UUID NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  yaksha_decision yaksha_decision DEFAULT 'unclear',
  yaksha_confidence FLOAT DEFAULT 0.0,
  yaksha_reasoning TEXT,
  context_used TEXT,
  disagree_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Answer history — audit trail of approved answer edits
CREATE TABLE IF NOT EXISTS answer_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_answer_id UUID NOT NULL REFERENCES community_answers(id) ON DELETE CASCADE,
  previous_text TEXT NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- 5. Issues — escalations from disagree clicks + standalone complaints
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_answer_id UUID REFERENCES community_answers(id) ON DELETE SET NULL,
  faq_id UUID REFERENCES faqs(id) ON DELETE SET NULL,
  reporter_username VARCHAR(50),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5b. Add suggested_question column for new-FAQ suggestions (Phase 5)
ALTER TABLE issues ADD COLUMN IF NOT EXISTS suggested_question TEXT;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_answers_faq ON community_answers(faq_id);
CREATE INDEX IF NOT EXISTS idx_community_answers_status ON community_answers(status);
CREATE INDEX IF NOT EXISTS idx_community_answers_decision ON community_answers(yaksha_decision);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_faq ON issues(faq_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
