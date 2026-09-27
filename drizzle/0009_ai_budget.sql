CREATE TABLE IF NOT EXISTS ai_daily_budget (
  day TEXT PRIMARY KEY,
  reserved_microusd INTEGER NOT NULL DEFAULT 0
);

