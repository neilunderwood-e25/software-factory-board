CREATE TABLE IF NOT EXISTS factory_ticket (
  id text PRIMARY KEY CHECK (id = 'northstar-glossary-v1'),
  state text NOT NULL DEFAULT 'backlog' CHECK (state IN ('backlog','queued','running','review','failed')),
  version integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  lease uuid,
  expires_at timestamptz,
  result text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'running') = (lease IS NOT NULL)),
  CHECK ((state = 'running') = (expires_at IS NOT NULL))
);
INSERT INTO factory_ticket(id) VALUES ('northstar-glossary-v1') ON CONFLICT DO NOTHING;
