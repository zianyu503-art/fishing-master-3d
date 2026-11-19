import { DurableObject } from "cloudflare:workers";

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
    for (const c of FALLBACK_CATCHES) {
      if (c.player_id === playerId) c.player_name = playerName;
    }
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

  // Sync updated player_name across all prior trophy catches for this player
  await env.DB.prepare(`UPDATE leaderboard_catches SET player_name = ? WHERE player_id = ?`)
    .bind(playerName, playerId)
    .run();

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

function sanitizeRoomId(raw) {
  return String(raw || "lobby").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "lobby";
}

function sanitizePlayerId(raw) {
  return String(raw || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
}

function sanitizeRoomState(raw, fallback = {}) {
  const num = (v, def, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  let bobber = null;
  if (raw?.bobber && Number.isFinite(Number(raw.bobber.x)) && Number.isFinite(Number(raw.bobber.z))) {
    bobber = {
      x: Math.round(num(raw.bobber.x, 0, -60, 60) * 1000) / 1000,
      y: Math.round(num(raw.bobber.y, 0.02, -5, 15) * 1000) / 1000,
      z: Math.round(num(raw.bobber.z, 12, -60, 60) * 1000) / 1000,
    };
  }
  const allowedStates = new Set(["IDLE", "CHARGING", "FLYING", "WAITING", "BITE", "FIGHTING", "SHARK_AMBUSH", "SHOWCASE"]);
  const st = allowedStates.has(raw?.state) ? raw.state : (fallback.state || "IDLE");
  return {
    playerId: sanitizePlayerId(raw?.playerId || fallback.playerId),
    name: cleanName(raw?.name ?? fallback.name),
    level: Math.max(1, Math.min(99, Math.round(Number(raw?.level ?? fallback.level) || 1))),
    x: Math.round(num(raw?.x, fallback.x ?? 0, -1.45, 1.45) * 1000) / 1000,
    z: Math.round(num(raw?.z, fallback.z ?? 30.0, 25.8, 36.2) * 1000) / 1000,
    yaw: Math.round(num(raw?.yaw, fallback.yaw ?? 0, -3.5, 3.5) * 1000) / 1000,
    state: st,
    rodBend: Math.round(num(raw?.rodBend, fallback.rodBend ?? 0, 0, 1.2) * 1000) / 1000,
    bobber,
    env: String(raw?.env || fallback.env || "lakeside").replace(/[^a-z]/g, "").slice(0, 16),
    updatedAt: Date.now(),
  };
}

export class FishingRoom extends DurableObject {
  _broadcast(payloadObj, excludeWs = null) {
    const raw = JSON.stringify(payloadObj);
    for (const peer of this.ctx.getWebSockets()) {
      if (peer === excludeWs) continue;
      try {
        peer.send(raw);
      } catch {
        // Stale socket will trigger webSocketClose/webSocketError
      }
    }
  }

  _collectPlayers(excludeWs = null) {
    const list = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excludeWs) continue;
      try {
        const att = ws.deserializeAttachment();
        if (att && att.playerId) list.push(att);
      } catch {
        // Ignore uninitialized attachment
      }
    }
    return list;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/status")) {
      const players = this._collectPlayers();
      return jsonResponse({
        ok: true,
        transport: "durable_object_ws",
        online: players.length,
        players,
        serverTime: Date.now(),
      });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return jsonResponse({ ok: false, error: "Expected WebSocket upgrade" }, 426);
    }

    const playerId = sanitizePlayerId(url.searchParams.get("playerId")) || `guest-${crypto.randomUUID().slice(0, 8)}`;
    const roomId = sanitizeRoomId(url.searchParams.get("room") || url.pathname.split("/").pop());
    const initial = sanitizeRoomState({
      playerId,
      name: url.searchParams.get("name"),
      level: url.searchParams.get("level"),
      x: url.searchParams.get("x"),
      z: url.searchParams.get("z"),
      yaw: url.searchParams.get("yaw"),
      state: "IDLE",
      env: url.searchParams.get("env"),
    });

    // Replace any stale socket from the exact same playerId
    for (const existing of this.ctx.getWebSockets()) {
      try {
        const att = existing.deserializeAttachment();
        if (att?.playerId === playerId) {
          existing.close(1000, "Replaced by newer session");
        }
      } catch {}
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(initial);

    const peers = this._collectPlayers(server);
    server.send(
      JSON.stringify({
        type: "welcome",
        roomId,
        playerId,
        serverTime: Date.now(),
        online: peers.length + 1,
        players: peers,
      })
    );
    this._broadcast({ type: "player_joined", player: initial }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    let msg;
    try {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      msg = JSON.parse(text);
    } catch {
      return;
    }
    const att = ws.deserializeAttachment() || {};
    if (!att.playerId) return;

    if (msg.type === "ping") {
      ws.send(
        JSON.stringify({
          type: "pong",
          ts: msg.ts || Date.now(),
          serverTime: Date.now(),
          online: this.ctx.getWebSockets().length,
        })
      );
      return;
    }

    if (msg.type === "state") {
      const next = sanitizeRoomState(msg, att);
      ws.serializeAttachment(next);
      this._broadcast({ type: "player_update", player: next }, ws);
      return;
    }

    if (msg.type === "catch" && SPECIES_LIMITS[msg.speciesId]) {
      const spec = SPECIES_LIMITS[msg.speciesId];
      const w = Number(msg.weightKg);
      if (!Number.isFinite(w) || w < 0.05 || w > spec.maxKg) return;
      const event = {
        kind: "catch",
        playerId: att.playerId,
        name: cleanName(msg.name || att.name),
        speciesId: msg.speciesId,
        speciesName: spec.name,
        weightKg: Math.round(w * 100) / 100,
        electrocuted: Boolean(msg.electrocuted),
        ts: Date.now(),
      };
      this._broadcast({ type: "room_event", event }, ws);
      return;
    }

    if (msg.type === "emote") {
      const cleanText = String(msg.text || "").replace(/[<>&"'`]/g, "").trim().slice(0, 36);
      if (!cleanText) return;
      const event = {
        kind: "emote",
        playerId: att.playerId,
        name: cleanName(msg.name || att.name),
        text: cleanText,
        ts: Date.now(),
      };
      this._broadcast({ type: "room_event", event }, ws);
    }
  }

  async webSocketClose(ws) {
    try {
      const att = ws.deserializeAttachment();
      if (att?.playerId) {
        this._broadcast({ type: "player_left", playerId: att.playerId, name: att.name }, ws);
      }
    } catch {}
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
}

async function handleRoomSyncPost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }
  const roomId = sanitizeRoomId(body.roomId);
  const st = sanitizeRoomState(body);
  if (!st.playerId) return jsonResponse({ ok: false, error: "Missing playerId" }, 400);
  const now = Date.now();
  const since = Number(body.since) || now - 8000;

  if (!env.DB) {
    return jsonResponse({ ok: true, transport: "memory", roomId, players: [], events: [], serverTime: now });
  }

  await env.DB.prepare(
    `INSERT INTO room_presence (room_id, player_id, player_name, level, x, z, yaw, state, rod_bend, bobber_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(room_id, player_id) DO UPDATE SET
       player_name = excluded.player_name,
       level = excluded.level,
       x = excluded.x,
       z = excluded.z,
       yaw = excluded.yaw,
       state = excluded.state,
       rod_bend = excluded.rod_bend,
       bobber_json = excluded.bobber_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      roomId,
      st.playerId,
      st.name,
      st.level,
      st.x,
      st.z,
      st.yaw,
      st.state,
      st.rodBend,
      st.bobber ? JSON.stringify(st.bobber) : "",
      now
    )
    .run();

  if (body.event && typeof body.event === "object") {
    const kind = body.event.kind === "catch" ? "catch" : body.event.kind === "emote" ? "emote" : "";
    if (kind) {
      await env.DB.prepare(
        `INSERT INTO room_events (room_id, player_id, player_name, kind, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(roomId, st.playerId, st.name, kind, JSON.stringify(body.event).slice(0, 512), now)
        .run();
    }
  }

  await env.DB.prepare(`DELETE FROM room_presence WHERE updated_at < ?`).bind(now - 15000).run();
  await env.DB.prepare(`DELETE FROM room_events WHERE created_at < ?`).bind(now - 60000).run();

  const { results: pRows } = await env.DB.prepare(
    `SELECT player_id, player_name, level, x, z, yaw, state, rod_bend, bobber_json, updated_at
     FROM room_presence WHERE room_id = ? AND player_id != ?`
  )
    .bind(roomId, st.playerId)
    .all();

  const { results: eRows } = await env.DB.prepare(
    `SELECT player_id, player_name, kind, payload_json, created_at
     FROM room_events WHERE room_id = ? AND created_at > ? AND player_id != ?
     ORDER BY created_at ASC LIMIT 20`
  )
    .bind(roomId, since, st.playerId)
    .all();

  const players = (pRows || []).map((r) => {
    let bobber = null;
    try {
      if (r.bobber_json) bobber = JSON.parse(r.bobber_json);
    } catch {}
    return {
      playerId: r.player_id,
      name: r.player_name,
      level: r.level,
      x: r.x,
      z: r.z,
      yaw: r.yaw,
      state: r.state,
      rodBend: r.rod_bend,
      bobber,
      updatedAt: r.updated_at,
    };
  });

  const events = (eRows || []).map((e) => {
    let payload = {};
    try {
      payload = JSON.parse(e.payload_json);
    } catch {}
    return { ...payload, playerId: e.player_id, name: e.player_name, kind: e.kind, ts: e.created_at };
  });

  return jsonResponse({
    ok: true,
    transport: "d1_http",
    roomId,
    online: players.length + 1,
    players,
    events,
    serverTime: now,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (url.pathname.startsWith("/ws/room/")) {
      if (!env.FISHING_ROOMS) {
        return jsonResponse({ ok: false, error: "Durable Objects unavailable" }, 503);
      }
      const rawRoom = url.pathname.slice("/ws/room/".length);
      const roomId = sanitizeRoomId(rawRoom);
      const id = env.FISHING_ROOMS.idFromName(roomId);
      const stub = env.FISHING_ROOMS.get(id);
      return stub.fetch(request);
    }
    if (url.pathname === "/api/room/status" && request.method === "GET") {
      const roomId = sanitizeRoomId(url.searchParams.get("room") || "lobby");
      if (env.FISHING_ROOMS) {
        const stub = env.FISHING_ROOMS.get(env.FISHING_ROOMS.idFromName(roomId));
        const res = await stub.fetch("https://room/status");
        const data = await res.json();
        return jsonResponse({ ...data, roomId });
      }
      return jsonResponse({ ok: true, roomId, online: 0, transport: "d1_only", players: [] });
    }
    if (url.pathname === "/api/room/sync" && request.method === "POST") {
      return handleRoomSyncPost(request, env);
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
