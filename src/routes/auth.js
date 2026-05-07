import { DIVISIONS } from '../constants.js';
import { listUsers, getUserByEmail, getUserByUsername, getUserById, getUserTeamIds, createUser } from '../db/users.js';
import { createSession, deleteSession } from '../db/sessions.js';
import { createTeam, slugify } from '../db/teams.js';
import { loginPage, signupPage } from '../ui/pages/auth.js';

export async function handleAuthRoutes(request, env, url, session, sessionId, ctx) {
  if (url.pathname === "/signup" || url.pathname === "/signup/") {
    const existingUsers = await listUsers(env);
    const isFirstUser = existingUsers.length === 0;
    const isAddingTeam = !isFirstUser && !!session;

    // Helper to parse and register a team, used for both logged-in and new-user flows
    async function registerTeam(fd, errorFn) {
      const contactName = (fd.get("contactName") || "").trim();
      const teamName = (fd.get("teamName") || "").trim();
      const division = (fd.get("division") || "").trim();
      const chillerUrl = (fd.get("chillerUrl") || "").trim();
      if (!contactName || !teamName || !division || !chillerUrl) return errorFn("All fields are required");
      if (!DIVISIONS.includes(division)) return errorFn("Invalid division");
      const slug = slugify(teamName) + "-" + slugify(division);
      if (!slug) return errorFn("Invalid team name");
      const { TEAM_CONFIGS } = await import('../constants.js');
      if (TEAM_CONFIGS[slug] || await env.LINEUP_KV.get("team:" + slug)) return errorFn("A team with that name and division already exists");
      let chillerTeamId = null;
      try {
        const parsed = new URL(chillerUrl);
        chillerTeamId = parsed.searchParams.get("TeamID") || parsed.searchParams.get("teamid") || parsed.searchParams.get("teamID") || null;
      } catch(e) {}
      if (!chillerTeamId) return errorFn("Could not parse TeamID from ChillerStats URL");
      return { contactName, teamName, division, slug, chillerTeamId };
    }

    if (request.method === "POST") {
      const fd = await request.formData();

      // Logged-in user adding another team — no password needed
      if (isAddingTeam) {
        const result = await registerTeam(fd, msg => new Response(signupPage(msg, false, true), { headers: { "Content-Type": "text/html" } }));
        if (result instanceof Response) return result;
        const { contactName, teamName, division, slug, chillerTeamId } = result;
        await createTeam(env, { slug, name: teamName, division, chillerTeamId, primaryColor: "#c0392b", contactName, contactEmail: session.email || "" });
        const fullUser = await getUserById(env, session.userId);
        const updatedIds = [...getUserTeamIds(fullUser), slug];
        fullUser.teamIds = updatedIds;
        await env.LINEUP_KV.put("user:" + fullUser.id, JSON.stringify(fullUser));
        const newSessionId = await createSession(env, fullUser);
        return new Response("", { status: 302, headers: { Location: "/", "Set-Cookie": "linemate_session=" + newSessionId + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000" } });
      }

      const email = (fd.get("email") || "").trim().toLowerCase();
      const password = fd.get("password") || "";
      const confirm = fd.get("confirm") || "";
      if (!password) return new Response(signupPage("Password is required", !isFirstUser), { headers: { "Content-Type": "text/html" } });
      if (password !== confirm) return new Response(signupPage("Passwords do not match", !isFirstUser), { headers: { "Content-Type": "text/html" } });
      if (password.length < 8) return new Response(signupPage("Password must be at least 8 characters", !isFirstUser), { headers: { "Content-Type": "text/html" } });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return new Response(signupPage("Invalid email address", !isFirstUser), { headers: { "Content-Type": "text/html" } });
      if (email && await getUserByEmail(env, email)) return new Response(signupPage("Email already in use", !isFirstUser), { headers: { "Content-Type": "text/html" } });
      if (isFirstUser) {
        const username = (fd.get("username") || "").trim();
        if (!username) return new Response(signupPage("All fields are required", false), { headers: { "Content-Type": "text/html" } });
        if (await getUserByUsername(env, username)) return new Response(signupPage("Username already taken", false), { headers: { "Content-Type": "text/html" } });
        const user = await createUser(env, { username, email, password, role: "superadmin" });
        const newSessionId = await createSession(env, user);
        return new Response("", { status: 302, headers: { Location: "/admin/teams", "Set-Cookie": "linemate_session=" + newSessionId + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000" } });
      } else {
        const result = await registerTeam(fd, msg => new Response(signupPage(msg, true), { headers: { "Content-Type": "text/html" } }));
        if (result instanceof Response) return result;
        const { contactName, teamName, division, slug, chillerTeamId } = result;
        let username = slug;
        let usernameAttempt = 0;
        while (await getUserByUsername(env, username)) { usernameAttempt++; username = slug + "-" + usernameAttempt; }
        await createTeam(env, { slug, name: teamName, division, chillerTeamId, primaryColor: "#c0392b", contactName, contactEmail: email });
        const existingUser = email ? await getUserByEmail(env, email) : null;
        if (existingUser) {
          const updatedIds = [...getUserTeamIds(existingUser), slug];
          existingUser.teamIds = updatedIds;
          await env.LINEUP_KV.put("user:" + existingUser.id, JSON.stringify(existingUser));
          const newSessionId = await createSession(env, existingUser);
          return new Response("", { status: 302, headers: { Location: "/", "Set-Cookie": "linemate_session=" + newSessionId + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000" } });
        }
        const user = await createUser(env, { username, email, password, role: "team_manager", teamIds: [slug] });
        const newSessionId = await createSession(env, user);
        return new Response("", { status: 302, headers: { Location: "/" + slug + "/", "Set-Cookie": "linemate_session=" + newSessionId + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000" } });
      }
    }
    return new Response(signupPage(null, !isFirstUser, isAddingTeam), { headers: { "Content-Type": "text/html" } });
  }

  if (url.pathname === "/login" || url.pathname === "/login/") {
    if (session) return Response.redirect(url.origin + "/", 302);
    if (request.method === "POST") {
      const fd = await request.formData();
      const identifier = (fd.get("identifier") || "").trim();
      const password = fd.get("password") || "";
      const { verifyPassword } = await import('../db/users.js');
      const { chillerLogin } = await import('../db/chillerstats.js');

      // Try ChillerStats SSO first
      let chillerCookie = null;
      try { chillerCookie = await chillerLogin(identifier, password); } catch(e) {}

      const user = identifier.includes("@") ? await getUserByEmail(env, identifier) : await getUserByUsername(env, identifier);

      // Determine auth: ChillerStats SSO OR Linemate password
      const chillerAuthed = !!chillerCookie;
      const linematePwdAuthed = user && await verifyPassword(password, user.passwordHash);

      if (user && (chillerAuthed || linematePwdAuthed)) {
        // Store ChillerStats cookie on user record for use in syncs
        if (chillerCookie && user.chillerCookie !== chillerCookie) {
          user.chillerCookie = chillerCookie;
          await env.LINEUP_KV.put("user:" + user.id, JSON.stringify(user));
        }
        const newSessionId = await createSession(env, user);
        // Background sync for all user teams on login
        if (ctx) {
          const cookie = chillerCookie || user.chillerCookie || null;
          ctx.waitUntil((async () => {
            const { getUserTeamIds } = await import('../db/users.js');
            const { getTeamConfig } = await import('../db/teams.js');
            const { syncTeamData } = await import('../db/sync.js');
            const teamIds = getUserTeamIds(user);
            await Promise.all(teamIds.map(async function(tid) {
              try {
                const cfg = await getTeamConfig(env, tid);
                if (cfg && cfg.chillerTeamId) await syncTeamData(env, tid, cfg.chillerTeamId, cookie);
              } catch(e) {}
            }));
          })());
        }
        return new Response("", { status: 302, headers: { Location: "/", "Set-Cookie": "linemate_session=" + newSessionId + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000" } });
      }
      return new Response(loginPage("Invalid username/email or password"), { headers: { "Content-Type": "text/html" } });
    }
    return new Response(loginPage(null), { headers: { "Content-Type": "text/html" } });
  }

  if (url.pathname === "/logout" && request.method === "POST") {
    await deleteSession(env, sessionId);
    return new Response("", { status: 302, headers: { Location: "/login", "Set-Cookie": "linemate_session=; Path=/; Max-Age=0" } });
  }

  return null;
}
