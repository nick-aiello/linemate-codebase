import { generateId, getUserTeamIds } from './users.js';

const ONE_HOUR = 60 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

export async function createSession(env, user) {
  const sessionId = generateId();
  const session = { userId: user.id, username: user.username, role: user.role, teamIds: getUserTeamIds(user), lastActivity: Date.now() };
  await env.LINEUP_KV.put("session:" + sessionId, JSON.stringify(session), { expirationTtl: 2592000 });
  return sessionId;
}

export async function getSession(env, sessionId) {
  if (!sessionId) return null;
  const raw = await env.LINEUP_KV.get("session:" + sessionId);
  if (!raw) return null;
  const session = JSON.parse(raw);
  const now = Date.now();
  // Expire after 1 hour of inactivity
  if (session.lastActivity && now - session.lastActivity > ONE_HOUR) {
    await env.LINEUP_KV.delete("session:" + sessionId);
    return null;
  }
  // Refresh lastActivity at most every 5 minutes to limit KV writes
  if (!session.lastActivity || now - session.lastActivity > FIVE_MIN) {
    session.lastActivity = now;
    await env.LINEUP_KV.put("session:" + sessionId, JSON.stringify(session), { expirationTtl: 2592000 });
  }
  return session;
}

export async function deleteSession(env, sessionId) {
  if (sessionId) await env.LINEUP_KV.delete("session:" + sessionId);
}

export function getSessionId(request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)linemate_session=([^;]+)/);
  return match ? match[1] : null;
}
