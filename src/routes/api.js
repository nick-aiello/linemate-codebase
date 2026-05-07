import { getUserById, getUserByEmail, getUserTeamIds, hashPassword, verifyPassword, createUser, listUsers } from '../db/users.js';
import { createSession, getSession, deleteSession, getSessionId } from '../db/sessions.js';
import { getTeamConfig, resolveConfig, listTeams, createTeam, slugify } from '../db/teams.js';
import { syncTeamData } from '../db/sync.js';
import { chillerLogin, parseNextGame } from '../db/chillerstats.js';
import { FETCH_HEADERS } from '../constants.js';
import { ensureChatSchema, ensureChannel, ensureGameChannels, upsertLineup, upsertRoster, upsertUser } from '../db/d1.js';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function err(message, code, status) {
  return json({ error: message, code }, status || 400);
}

function getBearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

async function getApiSession(env, request) {
  const token = getBearerToken(request);
  if (token) return await getSession(env, token);
  return await getSession(env, getSessionId(request));
}

function divSlug(division) {
  return (division || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function checkChannelAccess(env, session, channelId) {
  if (session.role === "superadmin" || session.role === "admin") return true;
  const teamIds = session.teamIds || [];
  if (channelId.startsWith("league:")) return teamIds.length > 0;
  if (channelId.startsWith("dm:")) {
    const rest = channelId.slice(3);
    const idx = rest.indexOf(":");
    if (idx === -1) return false;
    return session.userId === rest.slice(0, idx) || session.userId === rest.slice(idx + 1);
  }
  if (channelId.startsWith("div:")) {
    for (const tid of teamIds) {
      const tc = await getTeamConfig(env, tid);
      if (tc && tc.division && "div:" + divSlug(tc.division) === channelId) return true;
    }
    return false;
  }
  return teamIds.includes(channelId.split(":")[0]);
}

export async function handleApiRoutes(request, env, url, ctx) {
  if (!url.pathname.startsWith("/api/")) return null;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const path = url.pathname.slice(4);

  // --- Public auth routes ---
  if (path === "/auth/login" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const { email, password } = body || {};
    if (!email || !password) return err("Email and password are required", "missing_fields");
    const user = await getUserByEmail(env, email.trim().toLowerCase());
    let chillerCookie = null;
    if (user && user.email) {
      try { chillerCookie = await chillerLogin(user.email, password); } catch(e) {}
    }
    const authed = user && (!!chillerCookie || await verifyPassword(password, user.passwordHash));
    if (!authed) return err("Invalid email or password", "invalid_credentials", 401);
    if (chillerCookie && user.chillerCookie !== chillerCookie) {
      user.chillerCookie = chillerCookie;
      await env.LINEUP_KV.put("user:" + user.id, JSON.stringify(user));
    }
    const sessionId = await createSession(env, user);
    if (ctx) {
      const cookie = chillerCookie || user.chillerCookie || null;
      ctx.waitUntil((async () => {
        const teamIds = getUserTeamIds(user);
        await Promise.all(teamIds.map(async tid => {
          try {
            const cfg = await getTeamConfig(env, tid);
            if (cfg && cfg.chillerTeamId) await syncTeamData(env, tid, cfg.chillerTeamId, cookie);
          } catch(e) {}
        }));
      })());
    }
    return json({
      sessionId,
      user: {
        id: user.id,
        email: user.email || null,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        displayName: user.firstName && user.lastName ? user.firstName + " " + user.lastName : user.firstName || user.lastName || user.email || "",
        role: user.role,
        teamIds: getUserTeamIds(user),
      },
    });
  }

  if (path === "/auth/signup" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const { email, password, firstName, lastName, inviteToken } = body || {};
    if (!email || !password) return err("Email and password are required", "missing_fields");
    if (password.length < 8) return err("Password must be at least 8 characters", "password_too_short");
    const existing = await getUserByEmail(env, email.trim().toLowerCase());
    if (existing) return err("An account with that email already exists", "email_taken", 409);
    let inviteTeamId = null;
    if (inviteToken) {
      const raw = await env.LINEUP_KV.get("invite:" + inviteToken);
      if (raw) {
        const inv = JSON.parse(raw);
        if (!inv.expiresAt || Date.now() < inv.expiresAt) inviteTeamId = inv.teamId;
      }
    }
    const newUser = await createUser(env, {
      email: email.trim().toLowerCase(),
      firstName: (firstName || "").trim(),
      lastName: (lastName || "").trim(),
      password,
      role: "team_member",
      teamIds: inviteTeamId ? [inviteTeamId] : [],
    });
    const sessionId = await createSession(env, newUser);
    return json({
      sessionId,
      inviteTeamId,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName || null,
        lastName: newUser.lastName || null,
        displayName: [newUser.firstName, newUser.lastName].filter(Boolean).join(" ") || newUser.email,
        role: newUser.role,
        teamIds: inviteTeamId ? [inviteTeamId] : [],
      },
    }, 201);
  }

  if (path.startsWith("/invite/") && request.method === "GET") {
    const token = path.slice("/invite/".length);
    if (!token) return err("Invalid invite", "invalid_invite", 404);
    const raw = await env.LINEUP_KV.get("invite:" + token);
    if (!raw) return err("Invite not found or expired", "invalid_invite", 404);
    const inv = JSON.parse(raw);
    if (inv.expiresAt && Date.now() >= inv.expiresAt) return err("Invite has expired", "expired_invite", 410);
    const teamConfig = await getTeamConfig(env, inv.teamId);
    if (!teamConfig) return err("Team not found", "not_found", 404);
    return json({ token, teamId: inv.teamId, teamName: teamConfig.name || inv.teamId, primaryColor: teamConfig.primaryColor || "#c0392b" });
  }

  if (path === "/auth/logout" && request.method === "POST") {
    const token = getBearerToken(request);
    if (token) await deleteSession(env, token);
    return json({ ok: true });
  }

  // --- All routes below require auth ---
  const session = await getApiSession(env, request);
  if (!session) return err("Unauthorized", "unauthorized", 401);

  if (path === "/me" && request.method === "GET") {
    const meUser = await getUserById(env, session.userId);
    return json({
      id: session.userId,
      email: session.email || null,
      firstName: meUser?.firstName || null,
      lastName: meUser?.lastName || null,
      displayName: session.displayName || null,
      role: session.role,
      teamIds: session.teamIds || [],
    });
  }

  if (path === "/me/profile" && request.method === "GET") {
    const meUser = await getUserById(env, session.userId);
    const userEmail = (meUser?.email || session.email || "").toLowerCase();
    const teamIds = session.teamIds || [];
    let effectiveChillerId = meUser?.chillerPlayerId || null;
    if (!effectiveChillerId && meUser?.linkedPlayers) {
      for (const [ltid, lname] of Object.entries(meUser.linkedPlayers)) {
        const raw = await env.LINEUP_KV.get(ltid + ":profile:" + lname);
        if (raw) {
          const prof = JSON.parse(raw);
          if (prof.chillerPlayerId) { effectiveChillerId = prof.chillerPlayerId; break; }
        }
      }
    }
    const teams = (await Promise.all(teamIds.map(async tid => {
      const base = await getTeamConfig(env, tid);
      if (!base) return null;
      const config = await resolveConfig(base, tid, env);
      let linkedPlayer = null;
      const roster = (config.managedRoster || config.roster || []).filter(p => p.name);
      function buildLinkedPlayer(player) {
        const stats = (config.playerStats || []).find(s => s.name === player.name) || null;
        const avEntry = (config.availability || []).find(a => a.name === player.name);
        const ppg = stats && stats.gp > 0 ? Math.round(stats.pts / stats.gp * 100) / 100 : null;
        const ranked = (config.playerStats || []).filter(s => s.gp > 0).sort((a, b) => b.pts - a.pts || b.g - a.g);
        const rankIdx = stats && stats.gp > 0 ? ranked.findIndex(s => s.name === player.name) : -1;
        return { name: player.name, num: player.num || "", isSub: !!player.isSub, stats, rsvp: avEntry?.status || null, ppg, teamRank: rankIdx >= 0 ? rankIdx + 1 : null, teamRankOf: ranked.length, recentGames: (config.schedule || []).filter(g => g.isPast).slice(-5).reverse() };
      }
      if (!linkedPlayer && meUser?.linkedPlayers?.[tid]) {
        const p = roster.find(r => r.name === meUser.linkedPlayers[tid]);
        if (p) linkedPlayer = buildLinkedPlayer(p);
      }
      if (!linkedPlayer && effectiveChillerId) {
        for (const player of roster) {
          const raw = await env.LINEUP_KV.get(tid + ":profile:" + player.name);
          if (!raw) continue;
          const prof = JSON.parse(raw);
          if (prof.chillerPlayerId === effectiveChillerId) { linkedPlayer = buildLinkedPlayer(player); break; }
        }
      }
      if (!linkedPlayer && userEmail) {
        for (const player of roster) {
          const raw = await env.LINEUP_KV.get(tid + ":profile:" + player.name);
          if (!raw) continue;
          const prof = JSON.parse(raw);
          if (prof.email && prof.email.toLowerCase() === userEmail) { linkedPlayer = buildLinkedPlayer(player); break; }
        }
      }
      let lineupSlot = null, lineupIsSet = false;
      if (linkedPlayer) {
        const lineupRaw = await env.LINEUP_KV.get(tid + ":lineup");
        if (lineupRaw) {
          const lineup = JSON.parse(lineupRaw);
          lineupIsSet = !!lineup.isSet;
          for (const [slot, name] of Object.entries(lineup)) {
            if (name && name === linkedPlayer.name) { lineupSlot = slot; break; }
          }
        }
      }
      const nextGame = (config.schedule || []).find(g => !g.isPast) || null;
      let bio = null;
      if (linkedPlayer) {
        try {
          const profRaw = await env.LINEUP_KV.get(tid + ":profile:" + linkedPlayer.name);
          if (profRaw) bio = JSON.parse(profRaw).bio || null;
        } catch(e) {}
      }
      let teamOnApp = 0;
      if (env.DB) {
        try {
          const row = await env.DB.prepare("SELECT COUNT(*) as cnt FROM user_teams WHERE team_id = ?").bind(tid).first();
          teamOnApp = row?.cnt || 0;
        } catch(e) {}
      }
      return { id: tid, name: config.name, primaryColor: config.primaryColor || "#c0392b", division: config.division || null, linkedPlayer: linkedPlayer ? { ...linkedPlayer, lineupSlot, lineupIsSet } : null, nextGame, bio, teamOnApp };
    }))).filter(Boolean);
    return json({ id: session.userId, email: userEmail || null, firstName: meUser?.firstName || "", lastName: meUser?.lastName || "", avatarColor: meUser?.avatarColor || null, chillerPlayerId: meUser?.chillerPlayerId || null, teams });
  }

  if (path === "/me/bio" && request.method === "PATCH") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const { teamId, bio } = body || {};
    if (!teamId) return err("teamId required", "invalid_input", 400);
    const meUser = await getUserById(env, session.userId);
    const playerName = meUser?.linkedPlayers?.[teamId];
    if (!playerName) return err("Not linked to a player on this team", "not_linked", 400);
    const profileKey = teamId + ":profile:" + playerName;
    const raw = await env.LINEUP_KV.get(profileKey);
    const prof = raw ? JSON.parse(raw) : {};
    prof.bio = (bio || "").trim().slice(0, 500);
    await env.LINEUP_KV.put(profileKey, JSON.stringify(prof));
    return json({ ok: true });
  }

  if (path === "/me/link" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const u = await getUserById(env, session.userId);
    if (!u) return err("User not found", "not_found", 404);
    if (body.playerName && body.teamId) {
      const userTeamIds = session.teamIds || [];
      if (!userTeamIds.includes(body.teamId) && session.role !== "superadmin" && session.role !== "admin") return err("Not a member of this team", "forbidden", 403);
      const base = await getTeamConfig(env, body.teamId);
      if (!base) return err("Team not found", "not_found", 404);
      const config = await resolveConfig(base, body.teamId, env);
      const roster = config.managedRoster || config.roster || [];
      const player = roster.find(p => p.name === body.playerName);
      if (!player) return err("Player not found on roster", "not_found", 404);
      if (!u.linkedPlayers) u.linkedPlayers = {};
      u.linkedPlayers[body.teamId] = body.playerName;
      const profileKey = body.teamId + ":profile:" + body.playerName;
      const raw = await env.LINEUP_KV.get(profileKey);
      const profile = raw ? JSON.parse(raw) : {};
      if (!profile.email && u.email) { profile.email = u.email; await env.LINEUP_KV.put(profileKey, JSON.stringify(profile)); }
      const pid = profile.chillerPlayerId || player.chillerPlayerId;
      if (pid && !u.chillerPlayerId) u.chillerPlayerId = pid;
    } else {
      return err("Provide playerName+teamId", "missing_fields");
    }
    await env.LINEUP_KV.put("user:" + u.id, JSON.stringify(u));
    if (env.DB) {
      try { await upsertUser(env.DB, { ...u, teamIds: getUserTeamIds(u) }); } catch(e) {}
    }
    return json({ ok: true });
  }

  if (path === "/me/unlink" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const u = await getUserById(env, session.userId);
    if (!u) return err("User not found", "not_found", 404);
    if (body.teamId && u.linkedPlayers) delete u.linkedPlayers[body.teamId];
    await env.LINEUP_KV.put("user:" + u.id, JSON.stringify(u));
    return json({ ok: true });
  }

  if (path === "/me/update" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const u = await getUserById(env, session.userId);
    if (!u) return err("User not found", "not_found", 404);
    if (body.firstName !== undefined) u.firstName = (body.firstName || "").trim();
    if (body.lastName !== undefined) u.lastName = (body.lastName || "").trim();
    if (body.avatarColor !== undefined) u.avatarColor = body.avatarColor || null;
    await env.LINEUP_KV.put("user:" + u.id, JSON.stringify(u));
    if (env.DB) {
      try { await upsertUser(env.DB, { ...u, teamIds: getUserTeamIds(u) }); } catch(e) {}
    }
    return json({ ok: true, displayName: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "" });
  }

  if (path === "/me/password" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const { currentPassword, newPassword } = body || {};
    if (!currentPassword || !newPassword) return err("Both passwords required", "missing_fields");
    if (newPassword.length < 8) return err("Password must be at least 8 characters", "too_short");
    const u = await getUserById(env, session.userId);
    if (!u) return err("User not found", "not_found", 404);
    const valid = await verifyPassword(currentPassword, u.passwordHash);
    if (!valid) return err("Current password is incorrect", "wrong_password", 401);
    u.passwordHash = await hashPassword(newPassword);
    await env.LINEUP_KV.put("user:" + u.id, JSON.stringify(u));
    if (env.DB) {
      try { await upsertUser(env.DB, { ...u, teamIds: getUserTeamIds(u) }); } catch(e) {}
    }
    return json({ ok: true });
  }

  if (path === "/me/avatar" && request.method === "POST") {
    if (!env.LOGO_BUCKET) return err("Storage not available", "no_storage", 503);
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const { imageBase64, mimeType } = body || {};
    if (!imageBase64) return err("imageBase64 required", "missing_fields");
    const mime = mimeType || "image/jpeg";
    const ext = mime === "image/png" ? "png" : "jpg";
    const key = "avatars/" + session.userId + "." + ext;
    const binary = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    await env.LOGO_BUCKET.put(key, binary, { httpMetadata: { contentType: mime } });
    const avatarUrl = "https://linemate-app.com/cdn/" + key;
    const u = await getUserById(env, session.userId);
    if (u) { u.avatarUrl = avatarUrl; await env.LINEUP_KV.put("user:" + u.id, JSON.stringify(u)); }
    return json({ ok: true, avatarUrl });
  }

  if (path.startsWith("/cdn/") && request.method === "GET") {
    const key = path.slice("/cdn/".length);
    if (!env.LOGO_BUCKET) return new Response("Not found", { status: 404 });
    const obj = await env.LOGO_BUCKET.get(key);
    if (!obj) return new Response("Not found", { status: 404 });
    return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream", "Cache-Control": "public, max-age=31536000" } });
  }

  if (path.match(/^\/teams\/[^/]+\/invite\/generate$/) && request.method === "POST") {
    const teamId = path.split("/")[2];
    if (session.role !== "admin" && session.role !== "superadmin") return err("Forbidden", "forbidden", 403);
    const token = crypto.randomUUID().replace(/-/g, "");
    await env.LINEUP_KV.put("invite:" + token, JSON.stringify({ teamId, createdBy: session.userId, createdAt: Date.now(), expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
    return json({ url: "https://linemate-app.com/invite/" + token, token });
  }

  if (path === "/push-token" && request.method === "POST") {
    if (!env.DB) return err("Not available", "no_db", 503);
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const token = (body.token || "").trim();
    const platform = body.platform === "android" ? "android" : "ios";
    if (!token) return err("Token is required", "missing_token");
    await env.DB.prepare(`INSERT OR IGNORE INTO push_tokens (user_id, token, platform, created_at) VALUES (?, ?, ?, ?)`).bind(session.userId, token, platform, Date.now()).run();
    return json({ ok: true });
  }

  if (path === "/push-token" && request.method === "DELETE") {
    if (!env.DB) return err("Not available", "no_db", 503);
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const token = (body.token || "").trim();
    if (!token) return err("Token is required", "missing_token");
    await env.DB.prepare(`DELETE FROM push_tokens WHERE user_id = ? AND token = ?`).bind(session.userId, token).run();
    return json({ ok: true });
  }

  if (path === "/teams" && request.method === "GET") {
    const isAdmin = session.role === "superadmin" || session.role === "admin";
    const teamIds = isAdmin ? (await listTeams(env)).map(t => t.slug) : session.teamIds || [];
    const teams = (await Promise.all(teamIds.map(async id => {
      const base = await getTeamConfig(env, id);
      if (!base) return null;
      const config = await resolveConfig(base, id, env);
      return { id, slug: id, name: config.name, division: config.division || null, primaryColor: config.primaryColor };
    }))).filter(Boolean);
    return json(teams);
  }

  // --- Channel message routes ---
  if (path.startsWith("/channels/")) {
    if (!env.DB) return err("Chat not available", "no_db", 503);
    const channelSuffix = path.slice("/channels/".length);

    // GET/POST /channels/:channelId/messages
    const msgMatch = channelSuffix.match(/^(.+)\/messages$/);
    if (msgMatch) {
      const channelId = msgMatch[1];
      if (!await checkChannelAccess(env, session, channelId)) return err("Forbidden", "forbidden", 403);
      const channel = await env.DB.prepare(`SELECT id, type, name FROM chat_rooms WHERE id = ?`).bind(channelId).first();
      if (!channel) return err("Channel not found", "not_found", 404);

      if (request.method === "GET") {
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
        const beforeId = url.searchParams.get("before") ? parseInt(url.searchParams.get("before")) : null;
        const { results: messages } = await env.DB.prepare(
          `SELECT m.id, m.user_id, m.content, m.created_at, m.display_name, m.team_id, m.team_name, m.primary_color,
                  m.reply_to_id, m.reply_to_snippet, m.edited, m.deleted,
                  u.first_name, u.last_name, u.avatar_url
           FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id
           WHERE m.room_id = ?${beforeId ? " AND m.id < ?" : ""}
           ORDER BY m.id DESC LIMIT ?`
        ).bind(...(beforeId ? [channelId, beforeId, limit] : [channelId, limit])).all();
        let reactionsByMsg = {};
        if (messages.length) {
          const ids = messages.map(m => m.id);
          const { results: rows } = await env.DB.prepare(
            `SELECT message_id, emoji, user_id FROM reactions WHERE message_id IN (${ids.map(() => "?").join(",")})`
          ).bind(...ids).all();
          for (const r of rows) {
            if (!reactionsByMsg[r.message_id]) reactionsByMsg[r.message_id] = {};
            if (!reactionsByMsg[r.message_id][r.emoji]) reactionsByMsg[r.message_id][r.emoji] = { count: 0, mine: false };
            reactionsByMsg[r.message_id][r.emoji].count++;
            if (r.user_id === session.userId) reactionsByMsg[r.message_id][r.emoji].mine = true;
          }
        }
        return json({
          channelId,
          channelName: channel.name,
          channelType: channel.type,
          messages: messages.reverse().map(m => ({
            id: m.id,
            userId: m.user_id,
            displayName: m.display_name || [m.first_name, m.last_name].filter(Boolean).join(" ") || "Unknown",
            avatarUrl: m.avatar_url || null,
            teamId: m.team_id || null,
            teamName: m.team_name || null,
            primaryColor: m.primary_color || null,
            content: m.deleted ? null : m.content,
            deleted: !!m.deleted,
            edited: !!m.edited,
            replyToId: m.reply_to_id || null,
            replyToSnippet: m.reply_to_snippet || null,
            createdAt: m.created_at,
            reactions: m.deleted ? [] : Object.entries(reactionsByMsg[m.id] || {}).map(([emoji, d]) => ({ emoji, count: d.count, mine: d.mine })),
          })),
        });
      }

      if (request.method === "POST") {
        let body;
        try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
        const content = (body.content || "").trim();
        if (!content) return err("Message content is required", "missing_content");
        if (content.length > 2000) return err("Message too long", "too_long");
        const senderUser = await getUserById(env, session.userId);
        const displayName = senderUser ? [senderUser.firstName, senderUser.lastName].filter(Boolean).join(" ") || senderUser.email || "Unknown" : "Unknown";
        let msgTeamId = null, msgTeamName = null, msgColor = null;
        const userTeamIds = session.teamIds || [];
        if (!channelId.startsWith("dm:") && !channelId.startsWith("div:")) {
          msgTeamId = channelId.split(":")[0];
          const tc = await getTeamConfig(env, msgTeamId);
          msgTeamName = tc ? tc.name : null;
          msgColor = tc ? tc.primaryColor || null : null;
        } else if (channelId.startsWith("div:")) {
          for (const tid of userTeamIds) {
            const tc = await getTeamConfig(env, tid);
            if (tc && tc.division && "div:" + divSlug(tc.division) === channelId) {
              msgTeamId = tid; msgTeamName = tc.name; msgColor = tc.primaryColor || null; break;
            }
          }
        }
        // Handle reply
        let replyToId = null, replyToSnippet = null;
        if (body.replyToId) {
          replyToId = parseInt(body.replyToId);
          const replyMsg = await env.DB.prepare(`SELECT content, display_name, user_id FROM chat_messages WHERE id = ? AND room_id = ?`).bind(replyToId, channelId).first();
          if (replyMsg && !replyMsg.deleted) {
            replyToSnippet = (replyMsg.display_name || "Unknown") + ": " + (replyMsg.content || "").slice(0, 100);
          }
        }
        const now = Date.now();
        const result = await env.DB.prepare(
          `INSERT INTO chat_messages (room_id, user_id, content, display_name, team_id, team_name, primary_color, reply_to_id, reply_to_snippet, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(channelId, session.userId, content, displayName, msgTeamId, msgTeamName, msgColor, replyToId, replyToSnippet, now).run();
        return json({ id: result.meta.last_row_id, createdAt: now });
      }
    }

    // PATCH /channels/:channelId/messages/:msgId — edit
    const editMatch = channelSuffix.match(/^(.+)\/messages\/(\d+)$/);
    if (editMatch && request.method === "PATCH") {
      const channelId = editMatch[1];
      const msgId = parseInt(editMatch[2]);
      if (!await checkChannelAccess(env, session, channelId)) return err("Forbidden", "forbidden", 403);
      const msg = await env.DB.prepare(`SELECT id, user_id, deleted FROM chat_messages WHERE id = ? AND room_id = ?`).bind(msgId, channelId).first();
      if (!msg) return err("Message not found", "not_found", 404);
      if (msg.deleted) return err("Cannot edit a deleted message", "deleted", 400);
      if (msg.user_id !== session.userId && session.role !== "superadmin" && session.role !== "admin") return err("Not authorized", "forbidden", 403);
      let body;
      try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
      const content = (body.content || "").trim();
      if (!content) return err("Message content is required", "missing_content");
      if (content.length > 2000) return err("Message too long", "too_long");
      await env.DB.prepare(`UPDATE chat_messages SET content = ?, edited = 1 WHERE id = ?`).bind(content, msgId).run();
      return json({ ok: true });
    }

    // DELETE /channels/:channelId/messages/:msgId — soft delete
    if (editMatch && request.method === "DELETE") {
      const channelId = editMatch[1];
      const msgId = parseInt(editMatch[2]);
      if (!await checkChannelAccess(env, session, channelId)) return err("Forbidden", "forbidden", 403);
      const msg = await env.DB.prepare(`SELECT id, user_id FROM chat_messages WHERE id = ? AND room_id = ?`).bind(msgId, channelId).first();
      if (!msg) return err("Message not found", "not_found", 404);
      if (msg.user_id !== session.userId && session.role !== "superadmin" && session.role !== "admin") return err("Not authorized", "forbidden", 403);
      await env.DB.prepare(`UPDATE chat_messages SET deleted = 1, content = NULL WHERE id = ?`).bind(msgId).run();
      return json({ ok: true });
    }

    // POST /channels/:channelId/messages/:msgId/react
    const reactMatch = channelSuffix.match(/^(.+)\/messages\/(\d+)\/react$/);
    if (reactMatch && request.method === "POST") {
      const channelId = reactMatch[1];
      const msgId = parseInt(reactMatch[2]);
      if (!await checkChannelAccess(env, session, channelId)) return err("Forbidden", "forbidden", 403);
      let body;
      try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
      const emoji = (body.emoji || "").trim();
      if (!emoji) return err("Emoji is required", "missing_emoji");
      const existing = await env.DB.prepare(`SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`).bind(msgId, session.userId, emoji).first();
      if (existing) {
        await env.DB.prepare(`DELETE FROM reactions WHERE id = ?`).bind(existing.id).run();
        return json({ ok: true, added: false });
      }
      await env.DB.prepare(`INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`).bind(msgId, session.userId, emoji).run();
      return json({ ok: true, added: true });
    }

    // POST /channels/:channelId/read
    const readMatch = channelSuffix.match(/^(.+)\/read$/);
    if (readMatch && request.method === "POST") {
      const channelId = readMatch[1];
      if (!await checkChannelAccess(env, session, channelId)) return err("Forbidden", "forbidden", 403);
      try { await ensureChatSchema(env.DB); } catch(e) {}
      const now = Date.now();
      await env.DB.prepare(
        `INSERT INTO channel_reads (user_id, channel_id, last_read_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id, channel_id) DO UPDATE SET last_read_at = excluded.last_read_at`
      ).bind(session.userId, channelId, now).run();
      return json({ ok: true });
    }

    return err("Not found", "not_found", 404);
  }

  // --- Team routes ---
  const teamMatch = path.match(/^\/teams\/([^/]+)(\/.*)?$/);
  if (!teamMatch) return err("Not found", "not_found", 404);
  const teamId = teamMatch[1];
  const teamPath = teamMatch[2] || "/";
  const canAccess = session.role === "superadmin" || session.role === "admin" || (session.teamIds || []).includes(teamId);
  if (!canAccess) return err("Forbidden", "forbidden", 403);
  const baseConfig = await getTeamConfig(env, teamId);
  if (!baseConfig) return err("Team not found", "team_not_found", 404);
  const config = await resolveConfig(baseConfig, teamId, env);

  if (teamPath === "/brand" && request.method === "GET") {
    let brand = {};
    try { const r = await env.LINEUP_KV.get(teamId + ":brand"); if (r) brand = JSON.parse(r); } catch(e) {}
    return json({ primaryColor: config.primaryColor || "#c0392b", fwdLines: config.fwdLines || 3, defLines: config.defLines || (config.threeDefLines ? 3 : 2), division: config.division || null, chillerTeamId: config.chillerTeamId || null, jerseys: config.jerseys || [{ id: "home", label: "Black", color: "#1a1a1a" }, { id: "away", label: "White", color: "#1a1a1a" }] });
  }

  if (teamPath === "/brand" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    let brand = {};
    try { const r = await env.LINEUP_KV.get(teamId + ":brand"); if (r) brand = JSON.parse(r); } catch(e) {}
    if (body.primaryColor) brand.primaryColor = body.primaryColor.trim();
    if (body.fwdLines) brand.fwdLines = Math.max(2, Math.min(4, parseInt(body.fwdLines) || 3));
    if (body.defLines) brand.defLines = Math.max(2, Math.min(3, parseInt(body.defLines) || 2));
    brand.threeDefLines = brand.defLines === 3;
    if (body.division !== undefined) brand.division = body.division || null;
    if (body.jerseys && Array.isArray(body.jerseys)) brand.jerseys = body.jerseys.map(j => ({ id: j.id, label: (j.label || "").trim() || j.id.charAt(0).toUpperCase() + j.id.slice(1), color: (j.color || "#1a1a1a").trim() })).filter(j => j.id);
    if (body.chillerUrl) {
      const raw = body.chillerUrl.trim();
      try {
        const parsed = new URL(raw);
        const newId = parsed.searchParams.get("TeamID") || parsed.searchParams.get("teamid") || parsed.searchParams.get("teamID") || null;
        if (newId) brand.chillerTeamId = newId;
      } catch(e) { if (raw.length > 8) brand.chillerTeamId = raw; }
    }
    await env.LINEUP_KV.put(teamId + ":brand", JSON.stringify(brand));
    if (baseConfig._kvTeam) {
      try {
        const teamRaw = await env.LINEUP_KV.get("team:" + teamId);
        if (teamRaw) {
          const teamRecord = JSON.parse(teamRaw);
          if (brand.division !== undefined) teamRecord.division = brand.division;
          if (brand.chillerTeamId) teamRecord.chillerTeamId = brand.chillerTeamId;
          await env.LINEUP_KV.put("team:" + teamId, JSON.stringify(teamRecord));
        }
      } catch(e) {}
    }
    return json({ ok: true, chillerTeamId: brand.chillerTeamId || null });
  }

  if (teamPath === "/config" && request.method === "GET") {
    let myLinkedPlayer = null, lineupIsSet = false;
    try {
      const meUser = await getUserById(env, session.userId);
      const playerName = meUser?.linkedPlayers?.[teamId] || null;
      const lineupRaw = await env.LINEUP_KV.get(teamId + ":lineup");
      if (lineupRaw) {
        const lineup = JSON.parse(lineupRaw);
        lineupIsSet = !!lineup.isSet;
        if (playerName) {
          const SLOT_RE = /^(lw|c|rw|ld|rd|g)\d+$/;
          for (const [slot, name] of Object.entries(lineup)) {
            if (SLOT_RE.test(slot) && name === playerName) { myLinkedPlayer = { name: playerName, slot }; break; }
          }
          if (!myLinkedPlayer) myLinkedPlayer = { name: playerName, slot: null };
        }
      } else if (playerName) {
        myLinkedPlayer = { name: playerName, slot: null };
      }
    } catch(e) {}
    let avOverrides = {};
    try { const r = await env.LINEUP_KV.get(teamId + ":availability_overrides"); if (r) avOverrides = JSON.parse(r); } catch(e) {}
    const baseAvailability = config.availability || [];
    const availability = baseAvailability.map(a => avOverrides[a.name] !== undefined ? { ...a, status: avOverrides[a.name], source: "app" } : { ...a, source: "chiller" });
    for (const [name, status] of Object.entries(avOverrides)) {
      if (!availability.find(a => a.name === name)) availability.push({ name, status, source: "app" });
    }
    return json({ name: config.name, primaryColor: config.primaryColor || "#c0392b", opponents: config.opponents || [], rinks: config.rinks || [], jerseys: config.jerseys || [{ id: "home", label: "Black", color: "#1a1a1a" }, { id: "away", label: "White", color: "#1a1a1a" }], fwdLines: config.fwdLines || 3, defLines: config.defLines || (config.threeDefLines ? 3 : 2), chillerTeamId: config.chillerTeamId || null, myLinkedPlayer, availability, nextGame: config.nextGame || null, lineupIsSet });
  }

  if (teamPath === "/availability" && request.method === "POST") {
    const { status } = await request.json();
    if (status !== null && !["yes", "no", "maybe"].includes(status)) return err("Invalid status", "invalid_status");
    const meUser = await getUserById(env, session.userId);
    const playerName = meUser?.linkedPlayers?.[teamId] || null;
    if (!playerName) return err("No linked player for this team", "no_linked_player");
    const overridesRaw = await env.LINEUP_KV.get(teamId + ":availability_overrides");
    const overrides = overridesRaw ? JSON.parse(overridesRaw) : {};
    if (status === null) { delete overrides[playerName]; } else { overrides[playerName] = status; }
    await env.LINEUP_KV.put(teamId + ":availability_overrides", JSON.stringify(overrides));
    return json({ ok: true, playerName, status });
  }

  if (teamPath === "/roster" && request.method === "GET") return json(config.managedRoster || config.roster || []);
  if (teamPath === "/schedule" && request.method === "GET") return json(config.schedule || []);
  if (teamPath === "/stats" && request.method === "GET") return json({ playerStats: config.playerStats || [], standings: config.standings || [], syncedAt: config.syncedAt || null });

  if (teamPath === "/lineup" && request.method === "GET") {
    const raw = await env.LINEUP_KV.get(teamId + ":lineup");
    return json(raw ? JSON.parse(raw) : {});
  }

  if (teamPath === "/lineup" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    await env.LINEUP_KV.put(teamId + ":lineup", JSON.stringify(body));
    return json({ ok: true });
  }

  if (teamPath === "/lineup/set" && request.method === "POST") {
    const raw = await env.LINEUP_KV.get(teamId + ":lineup");
    if (!raw) return err("No lineup to set", "no_lineup", 400);
    const ts = Date.now().toString();
    const state = JSON.parse(raw);
    state.isSet = true;
    const metadata = { opponent: state.opponent || null, gamedate: state.gamedate || null, homeaway: state.homeaway || null };
    await env.LINEUP_KV.put(teamId + ":history:" + ts, JSON.stringify(state), { metadata });
    if (env.DB) {
      try { await upsertLineup(env.DB, teamId, ts, state); } catch(e) {}
    }
    return json({ ok: true, timestamp: ts });
  }

  if (teamPath === "/lineup/toggle" && request.method === "POST") {
    const raw = await env.LINEUP_KV.get(teamId + ":lineup");
    const state = raw ? JSON.parse(raw) : {};
    state.isSet = !state.isSet;
    await env.LINEUP_KV.put(teamId + ":lineup", JSON.stringify(state));
    if (state.isSet) {
      const ts = Date.now();
      const metadata = { opponent: state.opponent || null, gamedate: state.gamedate || null, homeaway: state.homeaway || null };
      await env.LINEUP_KV.put(teamId + ":history:" + ts, JSON.stringify(state), { metadata });
      if (env.DB) {
        try { await upsertLineup(env.DB, teamId, ts.toString(), state); } catch(e) {}
      }
    }
    return json({ ok: true, isSet: state.isSet });
  }

  if (teamPath === "/history" && request.method === "GET") {
    const result = await env.LINEUP_KV.list({ prefix: teamId + ":history:", limit: 100 });
    const prefix = teamId + ":history:";
    const entries = result.keys.map(k => {
      const ts = k.name.slice(prefix.length);
      const m = k.metadata || {};
      return { timestamp: ts, date: new Date(parseInt(ts)).toISOString(), opponent: m.opponent || null, gamedate: m.gamedate || null, homeaway: m.homeaway || null };
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return json(entries);
  }

  const historyMatch = teamPath.match(/^\/history\/(\d+)$/);
  if (historyMatch && request.method === "GET") {
    const raw = await env.LINEUP_KV.get(teamId + ":history:" + historyMatch[1]);
    if (!raw) return err("Not found", "not_found", 404);
    return json(JSON.parse(raw));
  }

  const historyApplyMatch = teamPath.match(/^\/history\/(\d+)\/apply$/);
  if (historyApplyMatch && request.method === "POST") {
    const ts = historyApplyMatch[1];
    const raw = await env.LINEUP_KV.get(teamId + ":history:" + ts);
    if (!raw) return err("Not found", "not_found", 404);
    const state = JSON.parse(raw);
    state.isSet = false;
    await env.LINEUP_KV.put(teamId + ":lineup", JSON.stringify(state));
    return json({ ok: true });
  }

  const historyDeleteMatch = teamPath.match(/^\/history\/(\d+)\/delete$/);
  if (historyDeleteMatch && request.method === "POST") {
    await env.LINEUP_KV.delete(teamId + ":history:" + historyDeleteMatch[1]);
    return json({ ok: true });
  }

  if (teamPath === "/chat" && request.method === "GET") {
    if (!env.DB) return err("Chat not available", "no_db", 503);
    const roomId = teamId + ":general";
    await env.DB.prepare(`INSERT OR IGNORE INTO chat_rooms (id, team_id, name, created_at) VALUES (?, ?, 'General', ?)`).bind(roomId, teamId, Date.now()).run();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const beforeId = url.searchParams.get("before") ? parseInt(url.searchParams.get("before")) : null;
    const { results: messages } = await env.DB.prepare(
      `SELECT m.id, m.user_id, m.content, m.created_at, u.first_name, u.last_name
       FROM chat_messages m JOIN users u ON u.id = m.user_id
       WHERE m.room_id = ?${beforeId ? " AND m.id < ?" : ""}
       ORDER BY m.id DESC LIMIT ?`
    ).bind(...(beforeId ? [roomId, beforeId, limit] : [roomId, limit])).all();
    const messageIds = messages.map(m => m.id);
    let reactionRows = [];
    if (messageIds.length) {
      const { results } = await env.DB.prepare(`SELECT message_id, emoji, user_id FROM reactions WHERE message_id IN (${messageIds.map(() => "?").join(",")})`).bind(...messageIds).all();
      reactionRows = results;
    }
    const reactionsByMsg = {};
    for (const r of reactionRows) {
      if (!reactionsByMsg[r.message_id]) reactionsByMsg[r.message_id] = {};
      if (!reactionsByMsg[r.message_id][r.emoji]) reactionsByMsg[r.message_id][r.emoji] = { count: 0, mine: false };
      reactionsByMsg[r.message_id][r.emoji].count++;
      if (r.user_id === session.userId) reactionsByMsg[r.message_id][r.emoji].mine = true;
    }
    return json({ messages: messages.reverse().map(m => ({ id: m.id, userId: m.user_id, displayName: [m.first_name, m.last_name].filter(Boolean).join(" ") || "Unknown", content: m.content, createdAt: m.created_at, reactions: Object.entries(reactionsByMsg[m.id] || {}).map(([emoji, d]) => ({ emoji, count: d.count, mine: d.mine })) })) });
  }

  if (teamPath === "/chat" && request.method === "POST") {
    if (!env.DB) return err("Chat not available", "no_db", 503);
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const content = (body.content || "").trim();
    if (!content) return err("Message content is required", "missing_content");
    if (content.length > 2000) return err("Message too long", "too_long");
    const roomId = teamId + ":general";
    await env.DB.prepare(`INSERT OR IGNORE INTO chat_rooms (id, team_id, name, created_at) VALUES (?, ?, 'General', ?)`).bind(roomId, teamId, Date.now()).run();
    const now = Date.now();
    const result = await env.DB.prepare(`INSERT INTO chat_messages (room_id, user_id, content, created_at) VALUES (?, ?, ?, ?)`).bind(roomId, session.userId, content, now).run();
    return json({ id: result.meta.last_row_id, createdAt: now });
  }

  const chatReactMatch = teamPath.match(/^\/chat\/(\d+)\/react$/);
  if (chatReactMatch && request.method === "POST") {
    if (!env.DB) return err("Chat not available", "no_db", 503);
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const emoji = (body.emoji || "").trim();
    if (!emoji) return err("Emoji is required", "missing_emoji");
    const msgId = parseInt(chatReactMatch[1]);
    const existing = await env.DB.prepare(`SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`).bind(msgId, session.userId, emoji).first();
    if (existing) {
      await env.DB.prepare(`DELETE FROM reactions WHERE id = ?`).bind(existing.id).run();
      return json({ ok: true, added: false });
    }
    await env.DB.prepare(`INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`).bind(msgId, session.userId, emoji).run();
    return json({ ok: true, added: true });
  }

  if (teamPath === "/channels" && request.method === "GET") {
    if (!env.DB) return err("Chat not available", "no_db", 503);
    try { await ensureChatSchema(env.DB); } catch(e) {}
    try { await ensureChannel(env.DB, teamId + ":general", teamId, "general", "general"); } catch(e) {}
    if (config.schedule) {
      try { await ensureGameChannels(env.DB, teamId, config.schedule); } catch(e) {}
    }
    let allTeamChannels = [];
    try {
      const { results } = await env.DB.prepare(`SELECT id, type, name, game_date, opponent, archived FROM chat_rooms WHERE team_id = ? AND archived = 0 AND type NOT IN ('dm', 'division') ORDER BY game_date ASC`).bind(teamId).all();
      allTeamChannels = results || [];
    } catch(e) {}
    allTeamChannels.sort((a, b) => a.name === "general" ? -1 : b.name === "general" ? 1 : 0);
    const today = new Date().toISOString().slice(0, 10);
    const pastGames = (config.schedule || []).filter(g => g.isPast && g.date).sort((a, b) => a.date > b.date ? 1 : -1);
    const lastPastGameDate = pastGames.length ? pastGames[pastGames.length - 1].date : null;
    const gameChannels = allTeamChannels.filter(c => c.type === "game" && c.game_date);
    const nextGameChannel = gameChannels.find(c => c.game_date >= today);
    const showGameChannel = nextGameChannel && (!lastPastGameDate || today > lastPastGameDate);
    const teamChannels = [...allTeamChannels.filter(c => c.type !== "game"), ...(showGameChannel ? [nextGameChannel] : [])];
    const withPreviews = await Promise.all(teamChannels.map(async ch => {
      try {
        const last = await env.DB.prepare(`SELECT m.content, m.created_at, m.display_name, u.first_name, u.last_name FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.room_id = ? AND m.deleted = 0 ORDER BY m.id DESC LIMIT 1`).bind(ch.id).first();
        let unreadCount = 0;
        try {
          const unreadRow = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM chat_messages WHERE room_id = ? AND created_at > COALESCE((SELECT last_read_at FROM channel_reads WHERE user_id = ? AND channel_id = ?), 0) AND deleted = 0`).bind(ch.id, session.userId, ch.id).first();
          unreadCount = unreadRow?.cnt || 0;
        } catch(e) {}
        return { id: ch.id, type: ch.type, name: ch.name, gameDate: ch.game_date, opponent: ch.opponent, unreadCount, lastMessage: last ? { preview: (last.content || "").slice(0, 80), createdAt: last.created_at, authorName: last.display_name || [last.first_name, last.last_name].filter(Boolean).join(" ") || "Unknown" } : null };
      } catch(e) {
        return { id: ch.id, type: ch.type, name: ch.name, gameDate: ch.game_date, opponent: ch.opponent, lastMessage: null, unreadCount: 0 };
      }
    }));
    let divChannel = null;
    if (config.division) {
      try {
        const dSlug = divSlug(config.division);
        const divId = "div:" + dSlug;
        await ensureChannel(env.DB, divId, teamId, "division", config.division, { division: config.division });
        const allTeams = await listTeams(env);
        const teamCount = allTeams.filter(t => t.division === config.division).length;
        const last = await env.DB.prepare(`SELECT m.content, m.created_at, m.display_name, m.team_name FROM chat_messages m WHERE m.room_id = ? AND m.deleted = 0 ORDER BY m.id DESC LIMIT 1`).bind(divId).first();
        let divUnread = 0;
        try {
          const divUnreadRow = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM chat_messages WHERE room_id = ? AND created_at > COALESCE((SELECT last_read_at FROM channel_reads WHERE user_id = ? AND channel_id = ?), 0) AND deleted = 0`).bind(divId, session.userId, divId).first();
          divUnread = divUnreadRow?.cnt || 0;
        } catch(e) {}
        divChannel = { id: divId, type: "division", name: config.division, teamCount, unreadCount: divUnread, lastMessage: last ? { preview: (last.content || "").slice(0, 80), createdAt: last.created_at, authorName: last.display_name || "Unknown", teamName: last.team_name || null } : null };
      } catch(e) {}
    }
    let dmRows = [];
    try {
      const { results } = await env.DB.prepare(`SELECT id, type, dm_user1, dm_user2 FROM chat_rooms WHERE type = 'dm' AND (dm_user1 = ? OR dm_user2 = ?)`).bind(session.userId, session.userId).all();
      dmRows = results || [];
    } catch(e) {}
    const dmChannels = await Promise.all(dmRows.map(async ch => {
      const otherId = ch.dm_user1 === session.userId ? ch.dm_user2 : ch.dm_user1;
      const other = await getUserById(env, otherId);
      const otherName = other ? [other.firstName, other.lastName].filter(Boolean).join(" ") || other.email || "Unknown" : "Unknown";
      let last = null;
      try { last = await env.DB.prepare(`SELECT content, created_at, display_name FROM chat_messages WHERE room_id = ? AND deleted = 0 ORDER BY id DESC LIMIT 1`).bind(ch.id).first(); } catch(e) {}
      let dmUnread = 0;
      try {
        const dmUnreadRow = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM chat_messages WHERE room_id = ? AND created_at > COALESCE((SELECT last_read_at FROM channel_reads WHERE user_id = ? AND channel_id = ?), 0) AND deleted = 0`).bind(ch.id, session.userId, ch.id).first();
        dmUnread = dmUnreadRow?.cnt || 0;
      } catch(e) {}
      return { id: ch.id, type: "dm", name: otherName, otherUserId: otherId, unreadCount: dmUnread, lastMessage: last ? { preview: (last.content || "").slice(0, 80), createdAt: last.created_at, authorName: last.display_name || "Unknown" } : null };
    }));
    let leagueChannels = [];
    try {
      await env.DB.prepare(`INSERT OR IGNORE INTO teams (id, name, division, chiller_team_id, primary_color, created_at) VALUES ('league', 'League', NULL, NULL, '#1a1a1a', ?)`).bind(Date.now()).run();
      await env.DB.prepare(`INSERT OR IGNORE INTO chat_rooms (id, team_id, type, name, archived, created_at) VALUES ('league:goalies', 'league', 'general', 'goalies', 0, ?)`).bind(Date.now()).run();
      const { results: leagueRows } = await env.DB.prepare(`SELECT id, type, name FROM chat_rooms WHERE team_id = 'league' AND archived = 0`).all();
      leagueChannels = await Promise.all((leagueRows || []).map(async ch => {
        try {
          const last = await env.DB.prepare(`SELECT m.content, m.created_at, m.display_name FROM chat_messages m WHERE m.room_id = ? AND m.deleted = 0 ORDER BY m.id DESC LIMIT 1`).bind(ch.id).first();
          let lgUnread = 0;
          try {
            const lgUnreadRow = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM chat_messages WHERE room_id = ? AND created_at > COALESCE((SELECT last_read_at FROM channel_reads WHERE user_id = ? AND channel_id = ?), 0) AND deleted = 0`).bind(ch.id, session.userId, ch.id).first();
            lgUnread = lgUnreadRow?.cnt || 0;
          } catch(e) {}
          return { id: ch.id, type: ch.type, name: ch.name, unreadCount: lgUnread, lastMessage: last ? { preview: (last.content || "").slice(0, 80), createdAt: last.created_at, authorName: last.display_name || "Unknown" } : null };
        } catch(e) {
          return { id: ch.id, type: ch.type, name: ch.name, lastMessage: null, unreadCount: 0 };
        }
      }));
    } catch(e) {}
    return json({ teamChannels: withPreviews, divChannel, dmChannels, leagueChannels });
  }

  if (teamPath === "/channels" && request.method === "POST") {
    if (!env.DB) return err("Chat not available", "no_db", 503);
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const rawName = (body.name || "").trim();
    if (!rawName) return err("Channel name is required", "missing_name");
    const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    if (!slug) return err("Invalid channel name", "invalid_name");
    const channelId = teamId + ":" + slug;
    const existing = await env.DB.prepare(`SELECT id FROM chat_rooms WHERE id = ?`).bind(channelId).first();
    if (existing) return err("A channel with that name already exists", "name_taken", 409);
    await env.DB.prepare(`INSERT INTO chat_rooms (id, team_id, type, name, archived, created_at) VALUES (?, ?, 'general', ?, 0, ?)`).bind(channelId, teamId, slug, Date.now()).run();
    return json({ id: channelId, type: "general", name: slug });
  }

  if (teamPath === "/members" && request.method === "GET") {
    if (!env.DB) return err("Not available", "no_db", 503);
    const { results } = await env.DB.prepare(`SELECT u.id, u.first_name, u.last_name, u.email FROM users u JOIN user_teams ut ON ut.user_id = u.id WHERE ut.team_id = ? AND u.id != ? ORDER BY u.first_name, u.last_name`).bind(teamId, session.userId).all();
    return json(results.map(u => ({ id: u.id, displayName: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Unknown" })));
  }

  if (teamPath === "/dm/open" && request.method === "POST") {
    if (!env.DB) return err("Not available", "no_db", 503);
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const targetId = (body.targetUserId || "").trim();
    if (!targetId) return err("Target user ID required", "missing_target");
    if (targetId === session.userId) return err("Cannot DM yourself", "invalid_target");
    try {
      const [a, b] = [session.userId, targetId].sort();
      const channelId = "dm:" + a + ":" + b;
      const targetUser = await getUserById(env, targetId);
      const otherName = targetUser ? [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ") || targetUser.email || "Unknown" : "Unknown";
      try { await ensureChatSchema(env.DB); } catch(e) {}
      await env.DB.prepare(`INSERT OR IGNORE INTO chat_rooms (id, team_id, type, name, dm_user1, dm_user2, archived, created_at) VALUES (?, ?, 'dm', ?, ?, ?, 0, ?)`).bind(channelId, teamId, otherName, a, b, Date.now()).run();
      return json({ channelId, name: otherName, type: "dm", otherUserId: targetId });
    } catch(e) {
      return err("DM open failed: " + (e && e.message ? e.message : String(e)), "dm_failed", 500);
    }
  }

  if (teamPath === "/subs" && request.method === "GET") {
    if (!env.DB) return err("Subs not available", "no_db", 503);
    const status = url.searchParams.get("status") || "open";
    const { results } = await env.DB.prepare(`SELECT s.id, s.player_name, s.message, s.status, s.created_at, u.first_name, u.last_name, g.date as game_date, g.time as game_time, g.opponent, g.rink FROM sub_requests s LEFT JOIN users u ON u.id = s.created_by LEFT JOIN games g ON g.id = s.game_id WHERE s.team_id = ? AND s.status = ? ORDER BY s.created_at DESC`).bind(teamId, status).all();
    return json(results.map(s => ({ id: s.id, playerName: s.player_name, message: s.message || null, status: s.status, createdAt: s.created_at, createdBy: [s.first_name, s.last_name].filter(Boolean).join(" ") || null, game: s.game_date ? { date: s.game_date, time: s.game_time, opponent: s.opponent, rink: s.rink } : null })));
  }

  if (teamPath === "/subs" && request.method === "POST") {
    if (!env.DB) return err("Subs not available", "no_db", 503);
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const playerName = (body.playerName || "").trim().toUpperCase();
    if (!playerName) return err("Player name is required", "missing_player");
    const message = (body.message || "").trim() || null;
    const gameId = body.gameId ? parseInt(body.gameId) : null;
    const now = Date.now();
    const result = await env.DB.prepare(`INSERT INTO sub_requests (team_id, player_name, game_id, message, status, created_by, created_at) VALUES (?, ?, ?, ?, 'open', ?, ?)`).bind(teamId, playerName, gameId, message, session.userId, now).run();
    return json({ id: result.meta.last_row_id, ok: true });
  }

  const subActionMatch = teamPath.match(/^\/subs\/(\d+)\/(fill|cancel)$/);
  if (subActionMatch && request.method === "POST") {
    if (!env.DB) return err("Subs not available", "no_db", 503);
    const subId = parseInt(subActionMatch[1]);
    const action = subActionMatch[2];
    const sub = await env.DB.prepare(`SELECT id, created_by FROM sub_requests WHERE id = ? AND team_id = ?`).bind(subId, teamId).first();
    if (!sub) return err("Sub request not found", "not_found", 404);
    if (action === "cancel" && sub.created_by !== session.userId && session.role !== "superadmin" && session.role !== "admin") return err("Not authorized", "forbidden", 403);
    await env.DB.prepare(`UPDATE sub_requests SET status = ? WHERE id = ?`).bind(action === "fill" ? "filled" : "cancelled", subId).run();
    return json({ ok: true });
  }

  if (teamPath === "/notifications" && request.method === "GET") {
    if (!env.DB) return err("Not available", "no_db", 503);
    const prefs = await env.DB.prepare(`SELECT lineup_set, game_reminder, chat_messages FROM notification_preferences WHERE user_id = ? AND team_id = ?`).bind(session.userId, teamId).first();
    return json({ lineupSet: prefs ? !!prefs.lineup_set : true, gameReminder: prefs ? !!prefs.game_reminder : true, chatMessages: prefs ? !!prefs.chat_messages : true });
  }

  if (teamPath === "/notifications" && request.method === "POST") {
    if (!env.DB) return err("Not available", "no_db", 503);
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    await env.DB.prepare(`INSERT INTO notification_preferences (user_id, team_id, lineup_set, game_reminder, chat_messages) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, team_id) DO UPDATE SET lineup_set=excluded.lineup_set, game_reminder=excluded.game_reminder, chat_messages=excluded.chat_messages`).bind(session.userId, teamId, body.lineupSet !== false ? 1 : 0, body.gameReminder !== false ? 1 : 0, body.chatMessages !== false ? 1 : 0).run();
    return json({ ok: true });
  }

  if (teamPath === "/sync" && request.method === "POST") {
    if (!config.chillerTeamId) return err("No ChillerStats ID configured", "no_chiller_id", 400);
    try {
      const user = session.userId ? await getUserById(env, session.userId) : null;
      const chillerCookie = user && user.chillerCookie || await env.LINEUP_KV.get(teamId + ":chillercookie") || null;
      const data = await syncTeamData(env, teamId, config.chillerTeamId, chillerCookie);
      return json(data);
    } catch(e) {
      return err("Sync failed: " + e.message, "sync_failed", 500);
    }
  }

  if (teamPath === "/next-game" && request.method === "GET") {
    if (!config.chillerTeamId) return json(null);
    try {
      const res = await fetch("https://chillerstats.com/team/schedule.cfm?TeamID=" + config.chillerTeamId, { headers: FETCH_HEADERS });
      const html = await res.text();
      const game = parseNextGame(html);
      if (game && game.date) {
        const notesRaw = await env.LINEUP_KV.get(teamId + ":game-notes");
        const notesMap = notesRaw ? JSON.parse(notesRaw) : {};
        game.notes = notesMap[game.date] || null;
      }
      return json(game);
    } catch(e) { return json(null); }
  }

  if (teamPath === "/game-notes" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const { date, note } = body || {};
    if (!date) return err("date required", "invalid_input");
    const notesRaw = await env.LINEUP_KV.get(teamId + ":game-notes");
    const notes = notesRaw ? JSON.parse(notesRaw) : {};
    if (note && note.trim()) { notes[date] = note.trim(); } else { delete notes[date]; }
    await env.LINEUP_KV.put(teamId + ":game-notes", JSON.stringify(notes));
    return json({ ok: true });
  }

  if (teamPath === "/announcements" && request.method === "GET") {
    const raw = await env.LINEUP_KV.get(teamId + ":announcements");
    return json(raw ? JSON.parse(raw) : []);
  }

  if (teamPath === "/announcements" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const { message } = body || {};
    if (!message || !message.trim()) return err("message required", "invalid_input");
    const meUser = await getUserById(env, session.userId);
    const authorName = [meUser?.firstName, meUser?.lastName].filter(Boolean).join(" ") || meUser?.email || "";
    const raw = await env.LINEUP_KV.get(teamId + ":announcements");
    const announcements = raw ? JSON.parse(raw) : [];
    const entry = { id: Date.now().toString(), message: message.trim(), author: authorName, createdAt: new Date().toISOString() };
    announcements.unshift(entry);
    await env.LINEUP_KV.put(teamId + ":announcements", JSON.stringify(announcements));
    return json({ ok: true, announcement: entry });
  }

  const profileMatch = teamPath.match(/^\/roster\/profile\/(.+)$/);
  if (profileMatch) {
    const playerName = decodeURIComponent(profileMatch[1]).toUpperCase();
    const profileKey = teamId + ":profile:" + playerName;
    if (request.method === "GET") {
      const raw = await env.LINEUP_KV.get(profileKey);
      const profile = raw ? JSON.parse(raw) : {};
      let hasAccount = false;
      if (profile.email) { const linked = await getUserByEmail(env, profile.email.toLowerCase()); hasAccount = !!linked; }
      return json({ ...profile, hasAccount });
    }
    if (request.method === "POST") {
      let body;
      try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
      const existing = await env.LINEUP_KV.get(profileKey);
      const profile = existing ? JSON.parse(existing) : {};
      if (body.email !== undefined) profile.email = body.email;
      if (body.phone !== undefined) profile.phone = body.phone;
      await env.LINEUP_KV.put(profileKey, JSON.stringify(profile));
      return json({ ok: true });
    }
  }

  if (teamPath === "/roster" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
    const players = Array.isArray(body) ? body : [];
    const managed = [{ num: "", name: "", isSub: false }, ...players.map(p => ({ num: (p.num || "").trim(), name: (p.name || "").trim().toUpperCase(), isSub: !!p.isSub })).filter(p => p.name)];
    await env.LINEUP_KV.put(teamId + ":roster", JSON.stringify(managed));
    if (env.DB) {
      try { await upsertRoster(env.DB, teamId, managed); } catch(e) {}
    }
    return json({ ok: true });
  }

  // --- Admin routes ---
  if (path.startsWith("/admin")) {
    if (session.role !== "superadmin" && session.role !== "admin") return err("Forbidden", "forbidden", 403);
    const adminPath = path.slice(6);
    if (adminPath === "/summary" && request.method === "GET") {
      const [users, teams] = await Promise.all([listUsers(env), listTeams(env)]);
      return json({ users: users.length, teams: teams.length });
    }
    if (adminPath === "/teams" && request.method === "GET") return json(await listTeams(env));
    if (adminPath === "/users" && request.method === "GET") {
      const users = await listUsers(env);
      return json(users.map(u => ({ id: u.id, email: u.email || null, firstName: u.firstName || "", lastName: u.lastName || "", role: u.role || "team_member", teamIds: u.teamIds || [], createdAt: u.createdAt || null })));
    }
    if (adminPath === "/users/create" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
      const { email, firstName, lastName, password, role, teamIds } = body || {};
      if (!email || !password) return err("Email and password are required", "missing_fields");
      if (password.length < 8) return err("Password must be at least 8 characters", "weak_password");
      if (await getUserByEmail(env, email)) return err("Email already in use", "email_taken");
      const validRoles = ["superadmin", "admin", "team_manager", "team_member"];
      if (role && !validRoles.includes(role)) return err("Invalid role", "invalid_role");
      const user = await createUser(env, { email: email.toLowerCase(), firstName: firstName || "", lastName: lastName || "", password, role: role || "team_member", teamIds: teamIds || [] });
      return json({ ok: true, id: user.id });
    }
    const userUpdateMatch = adminPath.match(/^\/users\/([^/]+)\/update$/);
    if (userUpdateMatch && request.method === "POST") {
      const targetId = userUpdateMatch[1];
      const targetUser = await getUserById(env, targetId);
      if (!targetUser) return err("User not found", "not_found", 404);
      let body;
      try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
      const { role, teamIds, email, firstName, lastName } = body || {};
      const validRoles = ["superadmin", "admin", "team_manager", "team_member"];
      if (role && !validRoles.includes(role)) return err("Invalid role", "invalid_role");
      if (email !== undefined && email !== targetUser.email) {
        if (targetUser.email) await env.LINEUP_KV.delete("user:email:" + targetUser.email.toLowerCase());
        if (email) await env.LINEUP_KV.put("user:email:" + email.toLowerCase(), targetId);
        targetUser.email = email || null;
      }
      if (role) targetUser.role = role;
      if (teamIds) targetUser.teamIds = teamIds;
      if (firstName !== undefined) targetUser.firstName = firstName;
      if (lastName !== undefined) targetUser.lastName = lastName;
      await env.LINEUP_KV.put("user:" + targetId, JSON.stringify(targetUser));
      return json({ ok: true });
    }
    const resetPwMatch = adminPath.match(/^\/users\/([^/]+)\/reset-password$/);
    if (resetPwMatch && request.method === "POST") {
      const targetId = resetPwMatch[1];
      const targetUser = await getUserById(env, targetId);
      if (!targetUser) return err("User not found", "not_found", 404);
      let body;
      try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
      const { password } = body || {};
      if (!password || password.length < 8) return err("Password must be at least 8 characters", "weak_password");
      targetUser.passwordHash = await hashPassword(password);
      await env.LINEUP_KV.put("user:" + targetId, JSON.stringify(targetUser));
      return json({ ok: true });
    }
    const deleteUserMatch = adminPath.match(/^\/users\/([^/]+)\/delete$/);
    if (deleteUserMatch && request.method === "POST") {
      const targetId = deleteUserMatch[1];
      if (targetId === session.userId) return err("Cannot delete yourself", "self_delete", 400);
      const targetUser = await getUserById(env, targetId);
      if (!targetUser) return err("User not found", "not_found", 404);
      await env.LINEUP_KV.delete("user:" + targetId);
      if (targetUser.email) await env.LINEUP_KV.delete("user:email:" + targetUser.email.toLowerCase());
      if (targetUser.username) await env.LINEUP_KV.delete("user:username:" + targetUser.username.toLowerCase());
      return json({ ok: true });
    }
    if (adminPath === "/teams/create" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
      const { name, primaryColor, division } = body || {};
      if (!name) return err("Team name is required", "missing_name");
      const slug = slugify(name) + (division ? "-" + slugify(division) : "");
      if (!slug) return err("Invalid team name", "invalid_name");
      if (await env.LINEUP_KV.get("team:" + slug)) return err("A team with that name already exists", "slug_taken");
      const team = await createTeam(env, { slug, name, primaryColor: primaryColor || "#c0392b", division: division || null });
      return json({ ok: true, slug: team.slug });
    }
    const teamEditMatch = adminPath.match(/^\/teams\/([^/]+)\/edit$/);
    if (teamEditMatch && request.method === "POST") {
      const targetSlug = teamEditMatch[1];
      const teamRaw = await env.LINEUP_KV.get("team:" + targetSlug);
      if (!teamRaw) return err("Team not found", "not_found", 404);
      let body;
      try { body = await request.json(); } catch(e) { return err("Invalid JSON", "invalid_json"); }
      const { name, primaryColor, division, chillerTeamId } = body || {};
      const teamRecord = JSON.parse(teamRaw);
      let brand = {};
      try { const b = await env.LINEUP_KV.get(targetSlug + ":brand"); if (b) brand = JSON.parse(b); } catch(e) {}
      if (name) teamRecord.name = name;
      if (/^#[0-9a-fA-F]{6}$/.test(primaryColor)) { teamRecord.primaryColor = primaryColor; brand.primaryColor = primaryColor; }
      if (division !== undefined) { teamRecord.division = division || null; brand.division = division || null; }
      if (chillerTeamId !== undefined) { teamRecord.chillerTeamId = chillerTeamId || null; if (chillerTeamId) brand.chillerTeamId = chillerTeamId; else delete brand.chillerTeamId; }
      await Promise.all([env.LINEUP_KV.put("team:" + targetSlug, JSON.stringify(teamRecord)), env.LINEUP_KV.put(targetSlug + ":brand", JSON.stringify(brand))]);
      return json({ ok: true });
    }
    const teamDeleteMatch = adminPath.match(/^\/teams\/([^/]+)\/delete$/);
    if (teamDeleteMatch && request.method === "POST") {
      if (session.role !== "superadmin") return err("Forbidden", "forbidden", 403);
      const targetSlug = teamDeleteMatch[1];
      const simpleKeys = ["team:", ":lineup", ":roster", ":brand", ":chiller", ":chillercookie"].map(k => k.startsWith(":") ? targetSlug + k : k + targetSlug);
      const [histKeys, profileKeys, logoKeys] = await Promise.all([env.LINEUP_KV.list({ prefix: targetSlug + ":history:" }), env.LINEUP_KV.list({ prefix: targetSlug + ":profile:" }), env.LINEUP_KV.list({ prefix: targetSlug + ":logo:" })]);
      const allKeys = [...simpleKeys, ...histKeys.keys.map(k => k.name), ...profileKeys.keys.map(k => k.name), ...logoKeys.keys.map(k => k.name)];
      await Promise.all(allKeys.map(k => env.LINEUP_KV.delete(k)));
      return json({ ok: true });
    }
  }

  return err("Not found", "not_found", 404);
}
