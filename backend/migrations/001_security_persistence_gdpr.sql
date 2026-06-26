-- Migration: Security Hardening & Server-Side Persistence
-- UP Migration block

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table 1: Security Logs
CREATE TABLE security_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL,
    candidate_id INTEGER,
    recruiter_id INTEGER,
    event_type VARCHAR(50) NOT NULL,
    patterns_matched JSONB,
    raw_excerpt TEXT,
    model_output_flagged TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_log_company ON security_log(company_id);
CREATE INDEX idx_security_log_unresolved ON security_log(resolved) WHERE resolved = FALSE;

-- Table 2: Chat Sessions
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL,
    recruiter_id INTEGER NOT NULL,
    title VARCHAR(255),
    context_summary TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_sessions_recruiter ON chat_sessions(recruiter_id, last_active_at DESC);

-- Table 3: Chat Messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB,
    token_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON chat_messages(session_id, created_at);

-- Table 4: Data Retention Policies
CREATE TABLE data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL UNIQUE,
    chat_history_days INTEGER DEFAULT 365,
    correspondence_log_days INTEGER DEFAULT 730,
    candidate_data_days INTEGER DEFAULT 1095,
    auto_delete_enabled BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 5: GDPR Erasure Logs
CREATE TABLE gdpr_erasure_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id INTEGER NOT NULL,
    requested_by INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add ForeignKey constraints after tables are created
ALTER TABLE security_log ADD CONSTRAINT fk_seclog_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE security_log ADD CONSTRAINT fk_seclog_candidate FOREIGN KEY (candidate_id) REFERENCES resumes(id) ON DELETE SET NULL;
ALTER TABLE security_log ADD CONSTRAINT fk_seclog_recruiter FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE chat_sessions ADD CONSTRAINT fk_session_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE chat_sessions ADD CONSTRAINT fk_session_recruiter FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE data_retention_policies ADD CONSTRAINT fk_retention_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE gdpr_erasure_log ADD CONSTRAINT fk_gdpr_recruiter FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE gdpr_erasure_log ADD CONSTRAINT fk_gdpr_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- DOWN Migration block
-- To revert, execute standard drop tables:
-- DROP TABLE IF EXISTS gdpr_erasure_log CASCADE;
-- DROP TABLE IF EXISTS data_retention_policies CASCADE;
-- DROP TABLE IF EXISTS chat_messages CASCADE;
-- DROP TABLE IF EXISTS chat_sessions CASCADE;
-- DROP TABLE IF EXISTS security_log CASCADE;
