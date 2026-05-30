CREATE TABLE IF NOT EXISTS faq_history (
    id SERIAL PRIMARY KEY,
    faq_id UUID REFERENCES faqs(id) ON DELETE CASCADE,
    previous_answer TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
    CREATE TYPE yaksha_decision_enum AS ENUM ('approved', 'admin_review', 'spam');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS community_answers (
    id SERIAL PRIMARY KEY,
    faq_id INTEGER REFERENCES faqs(id) ON DELETE CASCADE,
    contributor_name VARCHAR(255),
    answer_text TEXT NOT NULL,
    hash_id VARCHAR(50) UNIQUE NOT NULL,
    yaksha_decision yaksha_decision_enum NOT NULL,
    yaksha_confidence DECIMAL(3,2),
    yaksha_reasoning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    community_answer_id INTEGER REFERENCES community_answers(id) ON DELETE SET NULL,
    faq_id INTEGER REFERENCES faqs(id) ON DELETE CASCADE,
    reporter_name VARCHAR(255),
    reason TEXT,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
