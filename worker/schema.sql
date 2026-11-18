CREATE TABLE IF NOT EXISTS leaderboard_players (
  player_id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  total_catches INTEGER NOT NULL DEFAULT 0,
  best_weight_kg REAL NOT NULL DEFAULT 0,
  best_species_id TEXT DEFAULT '',
  best_species_name TEXT DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_coins ON leaderboard_players(coins DESC);

CREATE TABLE IF NOT EXISTS leaderboard_catches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  species_id TEXT NOT NULL,
  species_name TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catches_weight ON leaderboard_catches(weight_kg DESC);
CREATE INDEX IF NOT EXISTS idx_catches_species_weight ON leaderboard_catches(species_id, weight_kg DESC);
