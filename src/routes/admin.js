import { TEAM_CONFIGS, DIVISIONS } from '../constants.js';
import { listUsers, getUserById, getUserByEmail, getUserByUsername, createUser } from '../db/users.js';
import { listTeams } from '../db/teams.js';
import { adminDashboardPage, adminTeamsPage, adminTeamEditPage, adminUsersPage } from '../ui/pages/admin.js';

export async function handleAdminRoutes(request, env, url, session) {
  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    if (!session || session.role !== "superadmin") return new Response("", { status: 302, headers: { Location: "/login" } });
    const [users, kvTeams] = await Promise.all([listUsers(env), listTeams(env)]);
    const stats = { users: users.length, teams: Object.keys(TEAM_CONFIGS).length + kvTeams.length };
    return new Response(adminDashboardPage(session, stats, kvTeams), { headers: { "Content-Type": "text/html" } });
  }

  if (url.pathname.startsWith("/admin/users")) {
    if (!session || session.role !== "superadmin") return new Response("", { status: 302, headers: { Location: "/login" } });
    const adminParts = url.pathname.split("/").filter(Boolean);
    const kvTeams = await listTeams(env);
    const allTeamIds = [...Object.keys(TEAM_CONFIGS), ...kvTeams.map(t => t.slug)];
    if (adminParts.length <= 2) {
      const users = await listUsers(env);
      return new Response(adminUsersPage(users, allTeamIds, session), { headers: { "Content-Type": "text/html" } });
    }
    if (request.method === "POST" && adminParts[2] === "create") {
      const fd = await request.formData();
      const username = (fd.get("username") || "").trim();
      const email = (fd.get("email") || "").trim().toLowerCase();
      const password = fd.get("password") || "";
      const role = fd.get("role") || "team_member";
      const teamIds = fd.getAll("teamId").filter(Boolean);
      const users = await listUsers(env);
      async function renderError(msg) {
        return new Response(adminUsersPage(users, allTeamIds, session, msg), { headers: { "Content-Type": "text/html" } });
      }
      if (!username || !password) return renderError("Username and password are required");
      if (password.length < 8) return renderError("Password must be at least 8 characters");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return renderError("Invalid email address");
      if (email && await getUserByEmail(env, email)) return renderError("Email already in use");
      if (await getUserByUsername(env, username)) return renderError("Username already taken");
      if (!["superadmin","admin","team_manager","team_member"].includes(role)) return renderError("Invalid role");
      await createUser(env, { username, email, password, role, teamIds });
      return new Response("", { status: 302, headers: { Location: "/admin/users" } });
    }
    if (request.method === "POST" && adminParts.length === 4) {
      const targetId = adminParts[2];
      const action = adminParts[3];
      const targetUser = await getUserById(env, targetId);
      if (!targetUser) return new Response("User not found", { status: 404 });
      if (action === "role") {
        const fd = await request.formData();
        const newRole = fd.get("role") || "";
        const newTeamIds = fd.getAll("teamId").filter(Boolean);
        const newEmail = (fd.get("email") || "").trim().toLowerCase() || null;
        if (!["superadmin","admin","team_manager","team_member"].includes(newRole)) return new Response("Invalid role", { status: 400 });
        // Update email index: remove old, add new
        if (targetUser.email && targetUser.email !== newEmail) {
          await env.LINEUP_KV.delete("user:email:" + targetUser.email.toLowerCase());
        }
        if (newEmail && newEmail !== targetUser.email) {
          await env.LINEUP_KV.put("user:email:" + newEmail, targetId);
        }
        targetUser.role = newRole;
        targetUser.teamIds = newTeamIds;
        targetUser.email = newEmail || targetUser.email || null;
        await env.LINEUP_KV.put("user:" + targetId, JSON.stringify(targetUser));
        return new Response("", { status: 302, headers: { Location: "/admin/users" } });
      }
      if (action === "clear-chiller") {
        delete targetUser.chillerCookie;
        await env.LINEUP_KV.put("user:" + targetId, JSON.stringify(targetUser));
        return new Response("", { status: 302, headers: { Location: "/admin/users" } });
      }
      if (action === "delete") {
        if (targetUser.id === session.userId) return new Response("Cannot delete yourself", { status: 400 });
        await env.LINEUP_KV.delete("user:" + targetId);
        if (targetUser.email) await env.LINEUP_KV.delete("user:email:" + targetUser.email.toLowerCase());
        await env.LINEUP_KV.delete("user:username:" + targetUser.username.toLowerCase());
        return new Response("", { status: 302, headers: { Location: "/admin/users" } });
      }
    }
    return new Response("Not found", { status: 404 });
  }

  if (url.pathname.startsWith("/admin/teams")) {
    if (!session || session.role !== "superadmin") return new Response("", { status: 302, headers: { Location: "/login" } });
    const teamAdminParts = url.pathname.split("/").filter(Boolean);
    if (request.method === "GET" && teamAdminParts.length === 4 && teamAdminParts[3] === "edit") {
      const targetSlug = teamAdminParts[2];
      if (TEAM_CONFIGS[targetSlug]) return new Response("Cannot edit built-in teams", { status: 400 });
      const teamRaw = await env.LINEUP_KV.get("team:" + targetSlug);
      if (!teamRaw) return new Response("Team not found", { status: 404 });
      return new Response(adminTeamEditPage(JSON.parse(teamRaw)), { headers: { "Content-Type": "text/html" } });
    }
    if (request.method === "POST" && teamAdminParts.length === 4) {
      const targetSlug = teamAdminParts[2];
      const action = teamAdminParts[3];
      if (action === "delete") {
        if (TEAM_CONFIGS[targetSlug]) return new Response("Cannot delete built-in teams", { status: 400 });
        await env.LINEUP_KV.delete("team:" + targetSlug);
        return new Response("", { status: 302, headers: { Location: "/admin/teams" } });
      }
      if (action === "edit") {
        if (TEAM_CONFIGS[targetSlug]) return new Response("Cannot edit built-in teams", { status: 400 });
        const fd = await request.formData();
        const teamRaw = await env.LINEUP_KV.get("team:" + targetSlug);
        if (!teamRaw) return new Response("Team not found", { status: 404 });
        const teamRecord = JSON.parse(teamRaw);
        const name = (fd.get("name") || "").trim();
        if (name) teamRecord.name = name;
        teamRecord.contactName = (fd.get("contactName") || "").trim();
        teamRecord.contactEmail = (fd.get("contactEmail") || "").trim().toLowerCase();
        teamRecord.chillerTeamId = (fd.get("chillerTeamId") || "").trim() || null;
        await env.LINEUP_KV.put("team:" + targetSlug, JSON.stringify(teamRecord));
        return new Response("", { status: 302, headers: { Location: "/admin/teams" } });
      }
      if (action === "update") {
        const fd = await request.formData();
        const division = (fd.get("division") || "").trim();
        const newDivision = DIVISIONS.includes(division) ? division : null;
        // Update KV team record for registered teams
        const teamRaw = await env.LINEUP_KV.get("team:" + targetSlug);
        if (teamRaw) {
          const teamRecord = JSON.parse(teamRaw);
          teamRecord.division = newDivision;
          await env.LINEUP_KV.put("team:" + targetSlug, JSON.stringify(teamRecord));
        }
        // Always update brand so resolveConfig picks it up (covers built-in teams too)
        let brand = {};
        try { const b = await env.LINEUP_KV.get(targetSlug + ":brand"); if (b) brand = JSON.parse(b); } catch(e) {}
        brand.division = newDivision;
        await env.LINEUP_KV.put(targetSlug + ":brand", JSON.stringify(brand));
        return new Response("", { status: 302, headers: { Location: "/admin/teams" } });
      }
    }
    const kvTeams = await listTeams(env);
    const builtInDivisions = Object.fromEntries(await Promise.all(Object.keys(TEAM_CONFIGS).map(async function(slug) {
      try { const b = await env.LINEUP_KV.get(slug + ":brand"); if (b) { const brand = JSON.parse(b); return [slug, brand.division || null]; } } catch(e) {}
      return [slug, null];
    })));
    return new Response(adminTeamsPage(kvTeams, builtInDivisions, session), { headers: { "Content-Type": "text/html" } });
  }

  return null;
}
