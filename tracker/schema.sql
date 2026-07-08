-- ============================================================
--  DC Tracker — Schema Supabase
--  Cole e execute no Supabase > SQL Editor > New Query
-- ============================================================

-- ── Sessões (uma por visitante / aba) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT        NOT NULL DEFAULT 'direct',   -- google_ads | google_organic | gmb | instagram | facebook | tiktok | direct | referral
  source_label TEXT,                                     -- 'Google Ads', 'Instagram', etc
  medium       TEXT,                                     -- cpc | organic | social | direct
  campaign     TEXT,                                     -- utm_campaign
  keyword      TEXT,                                     -- utm_term (palavra-chave do anúncio!)
  ad_content   TEXT,                                     -- utm_content
  landing_url  TEXT,
  referrer     TEXT,
  device       TEXT,                                     -- mobile | desktop
  site         TEXT,                                     -- qual LP (nome ou domínio)
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Eventos dentro de uma sessão ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        REFERENCES lead_sessions(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL,  -- pageview | whatsapp_click | phone_click | maps_click | form_submit | cta_click | instagram_click
  event_data   JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices para performance do dashboard ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_source    ON lead_sessions(source);
CREATE INDEX IF NOT EXISTS idx_sessions_created   ON lead_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_site      ON lead_sessions(site);
CREATE INDEX IF NOT EXISTS idx_sessions_keyword   ON lead_sessions(keyword) WHERE keyword IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_session     ON lead_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type        ON lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created     ON lead_events(created_at DESC);

-- ── RLS (Row Level Security) ──────────────────────────────────────────────

ALTER TABLE lead_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_events   ENABLE ROW LEVEL SECURITY;

-- ANON pode apenas INSERIR (usado pelo tracker.js nas LPs)
CREATE POLICY "anon_insert_sessions"
  ON lead_sessions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_insert_events"
  ON lead_events FOR INSERT TO anon WITH CHECK (true);

-- SERVICE ROLE pode tudo (usado pelo dashboard no DC Hub)
CREATE POLICY "service_select_sessions"
  ON lead_sessions FOR SELECT TO service_role USING (true);

CREATE POLICY "service_select_events"
  ON lead_events FOR SELECT TO service_role USING (true);

-- ── Views úteis para o dashboard ─────────────────────────────────────────

-- Visão diária resumida
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  DATE(s.created_at AT TIME ZONE 'America/Sao_Paulo') AS dia,
  s.source,
  s.source_label,
  s.site,
  COUNT(DISTINCT s.id)                                                          AS visitas,
  COUNT(DISTINCT CASE WHEN e.event_type IN ('whatsapp_click','phone_click','form_submit') THEN s.id END) AS conversoes
FROM lead_sessions s
LEFT JOIN lead_events e ON e.session_id = s.id
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC;

-- Palavras-chave mais frequentes
CREATE OR REPLACE VIEW top_keywords AS
SELECT
  keyword,
  COUNT(*)                                                                      AS total,
  COUNT(CASE WHEN e.event_type IN ('whatsapp_click','phone_click','form_submit') THEN 1 END) AS conversoes
FROM lead_sessions s
LEFT JOIN lead_events e ON e.session_id = s.id
WHERE keyword IS NOT NULL AND keyword <> ''
GROUP BY keyword
ORDER BY total DESC;
