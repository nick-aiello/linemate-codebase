import { TEAM_CONFIGS } from '../constants.js';
import { getSessionId, getSession } from '../db/sessions.js';
import { getUserTeamIds, listUsers } from '../db/users.js';
import { getTeamConfig } from '../db/teams.js';
import { teamPickerPage } from '../ui/pages/auth.js';
import { handleAssetRoutes } from './assets.js';
import { handleAuthRoutes } from './auth.js';
import { handleAdminRoutes } from './admin.js';
import { handleTeamRoutes } from './team.js';
import { handleApiRoutes } from './api.js';

export async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  // Mobile API routes
  const apiResponse = await handleApiRoutes(request, env, url, ctx);
  if (apiResponse) return apiResponse;

  // Static asset routes (no KV needed)
  const assetResponse = await handleAssetRoutes(request, env, url);
  if (assetResponse) return assetResponse;

  if (!env.LINEUP_KV) return new Response("KV namespace not bound. Add your KV namespace ID to wrangler.toml.", { status: 500 });

  // Resolve global session
  const sessionId = getSessionId(request);
  const isDev = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const devSession = isDev ? { userId: "dev", username: "nick", role: "superadmin", email: "aiello.nick@icloud.com", teamIds: ["native-sons", "lumberquacks"] } : null;
  const session = devSession || await getSession(env, sessionId);

  // --- Global auth routes ---
  const authResponse = await handleAuthRoutes(request, env, url, session, sessionId, ctx);
  if (authResponse) return authResponse;

  // --- Admin routes (superadmin only) ---
  const adminResponse = await handleAdminRoutes(request, env, url, session);
  if (adminResponse) return adminResponse;

  // /teams — dedicated page showing all accessible teams
  if (url.pathname === "/teams" || url.pathname === "/teams/") {
    if (!session) return Response.redirect(url.origin + "/login", 302);
    const { buildMyTeams } = await import('../db/teams.js');
    const teams = await buildMyTeams(session, env);
    const { teamPickerPage } = await import('../ui/pages/auth.js');
    return new Response(teamPickerPage(session, teams), { headers: { "Content-Type": "text/html" } });
  }

  // Redirect "/" → team or admin panel
  if (url.pathname === "/") {
    if (!session) return Response.redirect(url.origin + "/login", 302);
    const sessionTeamIds = getUserTeamIds(session);
    if (sessionTeamIds.length === 1) return Response.redirect(url.origin + "/" + sessionTeamIds[0] + "/", 302);
    if (sessionTeamIds.length > 1) {
      const teamConfigs = await Promise.all(sessionTeamIds.map(async function(id) {
        const cfg = await getTeamConfig(env, id);
        return cfg ? Object.assign({}, cfg, { slug: id }) : null;
      }));
      return new Response(teamPickerPage(session, teamConfigs.filter(Boolean)), { headers: { "Content-Type": "text/html" } });
    }
    if (session.role === "superadmin" || session.role === "admin") return Response.redirect(url.origin + "/admin", 302);
    const firstTeam = Object.keys(TEAM_CONFIGS)[0];
    return Response.redirect(url.origin + "/" + firstTeam + "/", 302);
  }

  // --- Team routes ---
  if (parts.length > 0) {
    return await handleTeamRoutes(request, env, url, parts, session);
  }

  return new Response("Not found", { status: 404 });
}
