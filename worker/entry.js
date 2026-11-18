const SPECIES_LIMITS = {
  largemouth_bass: { name: "鱸魚", maxKg: 3.5 },
  rainbow_trout: { name: "虹鱒", maxKg: 6.0 },
  common_carp: { name: "鯉魚", maxKg: 8.5 },
  golden_arowana: { name: "傳奇金龍魚", maxKg: 9.5 },
  northern_pike: { name: "狗魚", maxKg: 16.0 },
  wels_catfish: { name: "巨型湖鯰", maxKg: 34.0 },
  electric_eel: { name: "巨型電鰻", maxKg: 24.0 },
  great_white_shark: { name: "狂暴大白鯊", maxKg: 380.0 },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// In-isolate fallback store when D1 binding is not yet attached
const FALLBACK_PLAYERS = new Map([
  ["seed-1", { player_id: "seed-1", player_name: "翡翠老船長", coins: 6850, level: 6, total_catches: 24, best_weight_kg: 184.5, best_species_name: "狂暴大白鯊", updated_at: 1 }],
  ["seed-2", { player_id: "seed-2", player_name: "高壓獵人阿強", coins: 4220, level: 4, total_catches: 16, best_weight_kg: 16.4, best_species_name: "巨型電鰻", updated_at: 2 }],
  ["seed-3", { player_id: "seed-3", player_name: "路亞小柔", coins: 2850, level: 3, total_catches: 11, best_weight_kg: 22.8, best_species_name: "巨型湖鯰", updated_at: 3 }],
]);
const FALLBACK_CATCHES = [
  { player_id: "seed-1", player_name: "翡翠老船長", species_id: "great_white_shark", species_name: "狂暴大白鯊", weight_kg: 184.5, created_at: 1 },
  { player_id: "seed-2", player_name: "高壓獵人阿強", species_id: "electric_eel", species_name: "巨型電鰻", weight_kg: 16.4, created_at: 2 },
  { player_id: "seed-3", player_name: "路亞小柔", species_id: "wels_catfish", species_name: "巨型湖鯰", weight_kg: 22.8, created_at: 3 },
];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

function cleanName(raw) {
  const s = String(raw || "").replace(/[<>&"'`]/g, "").trim().slice(0, 18);
  return s || "翡翠釣客";
}

async function handleLeaderboardGet(url, env) {
  const type = url.searchParams.get("type") === "wealth" ? "wealth" : "trophy";
  const species = url.searchParams.get("species") || "all";

  if (!env.DB) {
    if (type === "wealth") {
      const entries = [...FALLBACK_PLAYERS.values()].sort((a, b) => b.coins - a.coins).slice(0, 25);
      return jsonResponse({ ok: true, storage: "memory", type, entries });
    }
    const entries = FALLBACK_CATCHES
      .filter((c) => species === "all" || c.species_id === species)
      .sort((a, b) => b.weight_kg - a.weight_kg)
      .slice(0, 25);
    return jsonResponse({ ok: true, storage: "memory", type, species, entries });
  }

  if (type === "wealth") {
    const { results } = await env.DB.prepare(
      `SELECT player_id, player_name, coins, level, total_catches, best_weight_kg, best_species_name, updated_at
       FROM leaderboard_players
       ORDER BY coins DESC, total_catches DESC
       LIMIT 25`
    ).all();
    return jsonResponse({ ok: true, storage: "d1", type: "wealth", entries: results || [] });
  }

  if (species !== "all" && SPECIES_LIMITS[species]) {
    const { results } = await env.DB.prepare(
      `SELECT player_id, player_name, species_id, species_name, weight_kg, created_at
       FROM leaderboard_catches
       WHERE species_id = ?
       ORDER BY weight_kg DESC, created_at ASC
       LIMIT 25`
    )
      .bind(species)
      .all();
    return jsonResponse({ ok: true, storage: "d1", type: "trophy", species, entries: results || [] });
  }

  const { results } = await env.DB.prepare(
    `SELECT player_id, player_name, species_id, species_name, weight_kg, created_at
     FROM leaderboard_catches
     ORDER BY weight_kg DESC, created_at ASC
     LIMIT 25`
  ).all();
  return jsonResponse({ ok: true, storage: "d1", type: "trophy", species: "all", entries: results || [] });
}

async function handleLeaderboardPost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const playerId = String(body.playerId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  if (!playerId) return jsonResponse({ ok: false, error: "Missing playerId" }, 400);
  const playerName = cleanName(body.playerName);
  const coins = Math.max(0, Math.min(99999999, Math.round(Number(body.coins) || 0)));
  const level = Math.max(1, Math.min(99, Math.round(Number(body.level) || 1)));
  const totalCatches = Math.max(0, Math.min(999999, Math.round(Number(body.totalCatches) || 0)));
  const now = Date.now();

  const catchInfo = body.catch;
  let validCatch = null;
  if (catchInfo && SPECIES_LIMITS[catchInfo.speciesId]) {
    const spec = SPECIES_LIMITS[catchInfo.speciesId];
    const w = Number(catchInfo.weightKg);
    if (Number.isFinite(w) && w >= 0.1 && w <= spec.maxKg) {
      validCatch = {
        speciesId: catchInfo.speciesId,
        speciesName: spec.name,
        weightKg: Math.round(w * 100) / 100,
      };
    }
  }

  if (!env.DB) {
    if (validCatch) {
      FALLBACK_CATCHES.push({
        player_id: playerId,
        player_name: playerName,
        species_id: validCatch.speciesId,
        species_name: validCatch.speciesName,
        weight_kg: validCatch.weightKg,
        created_at: now,
      });
    }
    const prev = FALLBACK_PLAYERS.get(playerId) || { coins: 0, level: 1, total_catches: 0, best_weight_kg: 0, best_species_name: "" };
    const useNewBest = validCatch && validCatch.weightKg >= prev.best_weight_kg;
    FALLBACK_PLAYERS.set(playerId, {
      player_id: playerId,
      player_name: playerName,
      coins: Math.max(prev.coins, coins),
      level: Math.max(prev.level, level),
      total_catches: Math.max(prev.total_catches, totalCatches),
      best_weight_kg: useNewBest ? validCatch.weightKg : prev.best_weight_kg,
      best_species_name: useNewBest ? validCatch.speciesName : prev.best_species_name,
      updated_at: now,
    });
    return jsonResponse({ ok: true, storage: "memory", playerId, playerName, coins });
  }

  if (validCatch) {
    await env.DB.prepare(
      `INSERT INTO leaderboard_catches (player_id, player_name, species_id, species_name, weight_kg, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(playerId, playerName, validCatch.speciesId, validCatch.speciesName, validCatch.weightKg, now)
      .run();
  }

  const existing = await env.DB.prepare(
    `SELECT best_weight_kg, best_species_id, best_species_name FROM leaderboard_players WHERE player_id = ?`
  )
    .bind(playerId)
    .first();

  let bestW = existing?.best_weight_kg || 0;
  let bestSid = existing?.best_species_id || "";
  let bestSname = existing?.best_species_name || "";
  if (validCatch && validCatch.weightKg >= bestW) {
    bestW = validCatch.weightKg;
    bestSid = validCatch.speciesId;
    bestSname = validCatch.speciesName;
  }

  await env.DB.prepare(
    `INSERT INTO leaderboard_players (player_id, player_name, coins, level, total_catches, best_weight_kg, best_species_id, best_species_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET
       player_name = excluded.player_name,
       coins = MAX(leaderboard_players.coins, excluded.coins),
       level = MAX(leaderboard_players.level, excluded.level),
       total_catches = MAX(leaderboard_players.total_catches, excluded.total_catches),
       best_weight_kg = excluded.best_weight_kg,
       best_species_id = excluded.best_species_id,
       best_species_name = excluded.best_species_name,
       updated_at = excluded.updated_at`
  )
    .bind(playerId, playerName, coins, level, totalCatches, bestW, bestSid, bestSname, now)
    .run();

  return jsonResponse({ ok: true, storage: "d1", playerId, playerName, coins });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (url.pathname === "/api/leaderboard") {
      if (request.method === "GET") return handleLeaderboardGet(url, env);
      if (request.method === "POST") return handleLeaderboardPost(request, env);
      return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
    }
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not Found", { status: 404 });
  },
};
