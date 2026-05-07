export async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return saltHex + ":" + hashHex;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [saltHex, hashHex] = stored.split(":");
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  const newHashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return newHashHex === hashHex;
}

export function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function createUser(env, { username, email, password, role, teamIds }) {
  const id = generateId();
  const passwordHash = await hashPassword(password);
  const ids = Array.isArray(teamIds) ? teamIds : (teamIds ? [teamIds] : []);
  const user = { id, username, email, passwordHash, role: role || "team_member", teamIds: ids, createdAt: Date.now() };
  await env.LINEUP_KV.put("user:" + id, JSON.stringify(user));
  if (email) await env.LINEUP_KV.put("user:email:" + email.toLowerCase(), id);
  await env.LINEUP_KV.put("user:username:" + username.toLowerCase(), id);
  return user;
}

export function getUserTeamIds(user) {
  if (user.teamIds && user.teamIds.length) return user.teamIds;
  if (user.teamId) return [user.teamId]; // backward compat
  return [];
}

export async function getUserById(env, userId) {
  const raw = await env.LINEUP_KV.get("user:" + userId);
  return raw ? JSON.parse(raw) : null;
}

export async function getUserByEmail(env, email) {
  const id = await env.LINEUP_KV.get("user:email:" + email.toLowerCase());
  if (!id) return null;
  return getUserById(env, id);
}

export async function getUserByUsername(env, username) {
  const id = await env.LINEUP_KV.get("user:username:" + username.toLowerCase());
  if (!id) return null;
  return getUserById(env, id);
}

export async function listUsers(env) {
  const result = await env.LINEUP_KV.list({ prefix: "user:", limit: 1000 });
  const userKeys = result.keys.filter(k => !k.name.startsWith("user:email:") && !k.name.startsWith("user:username:"));
  const users = await Promise.all(userKeys.map(k => env.LINEUP_KV.get(k.name).then(r => r ? JSON.parse(r) : null)));
  return users.filter(Boolean);
}
