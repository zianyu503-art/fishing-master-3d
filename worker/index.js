// Self-contained Cloudflare Worker script written by deploy script (or direct wrangler/MCP upload).
// Source template at worker/index.js expects embedded ASSETS map injected by scripts/build_worker_bundle.mjs.
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

const UPSTREAM_ASSETS_BASE = "https://zianyu503-art.github.io/fishing-master-3d";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
  if (!env.DB) {
    return jsonResponse({ ok: false, error: "D1 database not bound" }, 503);
  }
  const type = url.searchParams.get("type") === "wealth" ? "wealth" : "trophy";
  const species = url.searchParams.get("species") || "all";

  if (type === "wealth") {
    const { results } = await env.DB.prepare(
      `SELECT player_id, player_name, coins, level, total_catches, best_weight_kg, best_species_name, updated_at
       FROM leaderboard_players
       ORDER BY coins DESC, total_catches DESC
       LIMIT 25`
    ).all();
    return jsonResponse({ ok: true, type: "wealth", entries: results || [] });
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
    return jsonResponse({ ok: true, type: "trophy", species, entries: results || [] });
  }

  const { results } = await env.DB.prepare(
    `SELECT player_id, player_name, species_id, species_name, weight_kg, created_at
     FROM leaderboard_catches
     ORDER BY weight_kg DESC, created_at ASC
     LIMIT 25`
  ).all();
  return jsonResponse({ ok: true, type: "trophy", species: "all", entries: results || [] });
}

async function handleLeaderboardPost(request, env) {
  if (!env.DB) {
    return jsonResponse({ ok: false, error: "D1 database not bound" }, 503);
  }
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

  return jsonResponse({ ok: true, playerId, playerName, coins });
}

async function handleAssetProxy(request, url, ctx) {
  const cache = caches.default;
  const cacheReq = new Request(url.toString(), { method: "GET" });
  const hit = await cache.match(cacheReq);
  if (hit) return hit;

  const upstreamUrl = `${UPSTREAM_ASSETS_BASE}${url.pathname}`;
  const upstreamRes = await fetch(upstreamUrl);
  if (!upstreamRes.ok) {
    return new Response("Not Found", { status: upstreamRes.status, headers: CORS_HEADERS });
  }
  const headers = new Headers(upstreamRes.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "public, max-age=86400");
  if (url.pathname.endsWith(".glb")) headers.set("Content-Type", "model/gltf-binary");
  else if (url.pathname.endsWith(".hdr")) headers.set("Content-Type", "application/octet-stream");
  else if (url.pathname.endsWith(".webp")) headers.set("Content-Type", "image/webp");
  else if (url.pathname.endsWith(".png")) headers.set("Content-Type", "image/png");

  const res = new Response(upstreamRes.body, { status: 200, headers });
  ctx.waitUntil(cache.put(cacheReq, res.clone()));
  return res;
}

export function createWorkerHandler(staticMap) {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (url.pathname === "/api/leaderboard") {
        if (request.method === "GET") return handleLeaderboardGet(url, env);
        if (request.method === "POST") return handleLeaderboardPost(request, env);
        return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      }

      const routeKey = url.pathname === "/" ? "/index.html" : url.pathname;
      if (staticMap[routeKey]) {
        const { body, contentType } = staticMap[routeKey];
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=60",
            ...CORS_HEADERS,
          },
        });
      }

      if (url.pathname.startsWith("/outputs/") || url.pathname.startsWith("/refs/")) {
        return handleAssetProxy(request, url, ctx);
      }

      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    },
  };
}
