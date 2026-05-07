import { TEAM_CONFIGS, FETCH_HEADERS } from '../constants.js';
import { getTeamConfig, listTeams, resolveConfig, buildMyTeams } from '../db/teams.js';
import { getUserTeamIds } from '../db/users.js';
import { fetchChillerstats, parseNextGame } from '../db/chillerstats.js';
import { viewPage } from '../ui/pages/view.js';
import { editPage } from '../ui/pages/edit.js';
import { historyPage } from '../ui/pages/history.js';
import { brandPage } from '../ui/pages/brand.js';
import { rosterPage } from '../ui/pages/roster.js';
import { schedulePage } from '../ui/pages/schedule.js';
import { statsPage } from '../ui/pages/stats.js';

export async function handleTeamRoutes(request, env, url, parts, session) {
  const teamId = parts[0];
  const baseConfig = await getTeamConfig(env, teamId);
  if (!baseConfig) return new Response("Team not found", { status: 404 });
  const config = await resolveConfig(baseConfig, teamId, env);

  // Normalize: /native-sons → /native-sons/
  if (parts.length === 1 && !url.pathname.endsWith("/")) {
    return Response.redirect(url.origin + "/" + teamId + "/", 302);
  }

  const subPath = "/" + parts.slice(1).join("/");
  const kvKey = teamId + ":lineup";

  // Logo and view are public — no auth required
  if (subPath.startsWith("/logo/") && request.method === "POST") {
    const logoType = subPath.slice(6);
    const buf = await request.arrayBuffer();
    const ct = request.headers.get("Content-Type") || "image/png";
    const r2Key = teamId + "/logo/" + logoType;
    if (env.LOGO_BUCKET) {
      await env.LOGO_BUCKET.put(r2Key, buf, { httpMetadata: { contentType: ct } });
    } else {
      await env.LINEUP_KV.put(teamId + ":logo:" + logoType, buf, { metadata: { contentType: ct } });
    }
    // Mark hasLogoMain in brand record
    let brand = {};
    try { const r = await env.LINEUP_KV.get(teamId + ":brand"); if (r) brand = JSON.parse(r); } catch(e) {}
    brand["hasLogo" + logoType.charAt(0).toUpperCase() + logoType.slice(1)] = true;
    await env.LINEUP_KV.put(teamId + ":brand", JSON.stringify(brand));
    return new Response("ok");
  }

  if (subPath.startsWith("/logo/") && request.method === "GET") {
    const r2Key = teamId + "/logo/" + subPath.slice(6);
    // Try R2 first, fall back to KV for existing logos
    if (env.LOGO_BUCKET) {
      const obj = await env.LOGO_BUCKET.get(r2Key);
      if (obj) {
        const ct = obj.httpMetadata?.contentType || "image/png";
        return new Response(obj.body, { headers: { "Content-Type": ct, "Cache-Control": "public, max-age=3600, must-revalidate" } });
      }
    }
    const { value, metadata } = await env.LINEUP_KV.getWithMetadata(teamId + ":logo:" + subPath.slice(6).replace(/\//g, ":"), { type: "arrayBuffer" });
    if (!value) return new Response("Not found", { status: 404 });
    return new Response(value, { headers: { "Content-Type": (metadata && metadata.contentType) || "image/png", "Cache-Control": "public, max-age=3600" } });
  }

  if (subPath === "/view") {
    let state = null;
    try { const raw = await env.LINEUP_KV.get(kvKey); if (raw) state = JSON.parse(raw); } catch(e) {}
    const exportMode = url.searchParams.get("export");
    let html = viewPage(state, config);
    if (exportMode === "print") {
      html = html.replace("</body>", "<script>window.onload=function(){window.print();window.addEventListener('afterprint',function(){history.back();});}<\/script></body>");
    } else if (exportMode === "png") {
      const pngJs = "window.onload=function(){var scr=document.createElement('script');scr.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';scr.onload=function(){html2canvas(document.querySelector('.card'),{backgroundColor:'#f5f2ec',scale:2,useCORS:false,logging:false}).then(function(canvas){canvas.toBlob(function(blob){var fname='" + teamId + "-lineup.png';var imgUrl=URL.createObjectURL(blob);var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:20px;padding:20px;box-sizing:border-box;';var img=document.createElement('img');img.src=imgUrl;img.style.cssText='max-width:100%;max-height:65vh;border-radius:4px;box-shadow:0 4px 24px rgba(0,0,0,.5);';var row=document.createElement('div');row.style.cssText='display:flex;gap:12px;';var saveBtn=document.createElement('button');saveBtn.textContent='Save Image';saveBtn.style.cssText='padding:13px 28px;background:#c0392b;color:white;border:none;border-radius:6px;font-family:inherit;font-size:15px;cursor:pointer;letter-spacing:.5px;';saveBtn.onclick=function(){var file=new File([blob],fname,{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:fname}).catch(function(){});}else{var a=document.createElement('a');a.href=imgUrl;a.download=fname;document.body.appendChild(a);a.click();document.body.removeChild(a);}};var backBtn=document.createElement('button');backBtn.textContent='Back';backBtn.style.cssText='padding:13px 28px;background:rgba(255,255,255,.15);color:white;border:none;border-radius:6px;font-family:inherit;font-size:15px;cursor:pointer;letter-spacing:.5px;';backBtn.onclick=function(){URL.revokeObjectURL(imgUrl);history.back();};row.appendChild(saveBtn);row.appendChild(backBtn);ov.appendChild(img);ov.appendChild(row);document.body.appendChild(ov);});}).catch(function(e){alert('PNG export failed: '+e.message);history.back();});};scr.onerror=function(){alert('Failed to load html2canvas. Check your connection.');history.back();};document.head.appendChild(scr);};";
      html = html.replace("</body>", "<script>" + pngJs + "<\/script></body>");
    }
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }

  // All other team routes require a valid global session
  if (!session) return new Response("", { status: 302, headers: { Location: "/login" } });

  // superadmin/admin can access all teams; others must be assigned to this team
  const canAccessTeam = session.role === "superadmin" || session.role === "admin" || getUserTeamIds(session).includes(teamId);
  if (!canAccessTeam) return new Response("You do not have access to this team.", { status: 403 });

  if (subPath === "/sync" && request.method === "POST") {
    if (!baseConfig.chillerTeamId) return new Response("No chillerstats ID configured for this team", { status: 400 });
    try {
      const { getUserById } = await import('../db/users.js');
      const { syncTeamData } = await import('../db/sync.js');
      const syncUser = session.userId ? await getUserById(env, session.userId) : null;
      const chillerCookie = syncUser && syncUser.chillerCookie ? syncUser.chillerCookie : null;
      const data = await syncTeamData(env, teamId, baseConfig.chillerTeamId, chillerCookie);
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch(e) {
      return new Response("Sync failed: " + e.message, { status: 500 });
    }
  }

  if (subPath === "/save" && request.method === "POST") {
    const body = await request.json();
    await env.LINEUP_KV.put(kvKey, JSON.stringify(body));
    return new Response("ok");
  }

  if (subPath === "/debug-availability") {
    const { FETCH_HEADERS } = await import('../constants.js');
    const { parseAttendance } = await import('../db/chillerstats.js');
    // 1. Check what's in chiller cache
    const raw = await env.LINEUP_KV.get(teamId + ":chiller");
    const cached = raw ? JSON.parse(raw) : null;
    // 2. Re-fetch schedule and check regex
    const schedRes = await fetch("https://chillerstats.com/team/schedule.cfm?TeamID=" + baseConfig.chillerTeamId, { headers: FETCH_HEADERS });
    const schedHtml = await schedRes.text();
    const attendeeMatch = schedHtml.match(/data-remote-link="attendee_display\.cfm\?([^"]+)"/);
    const attendeeParams = attendeeMatch ? attendeeMatch[1] : null;
    // 3. If found, try fetching attendance
    let attStatus = null, attData = [];
    if (attendeeParams) {
      const attRes = await fetch("https://chillerstats.com/team/attendee_display.cfm?" + attendeeParams, { headers: FETCH_HEADERS });
      attStatus = attRes.status;
      if (attRes.ok) {
        const attHtml = await attRes.text();
        attData = parseAttendance(attHtml);
      }
    }
    return new Response(JSON.stringify({ cachedAvailability: cached?.availability, attendeeParamsFound: attendeeParams, attFetchStatus: attStatus, attData }, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  if (subPath === "/debug-schedule") {
    const raw = await env.LINEUP_KV.get(teamId + ":chiller");
    const cached = raw ? JSON.parse(raw) : null;
    const cachedSchedule = cached ? cached.schedule || [] : null;
    return new Response(JSON.stringify({ cachedCount: cachedSchedule ? cachedSchedule.length : "no cache", cachedSchedule }, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  if (subPath === "/debug-stats") {
    const raw = await env.LINEUP_KV.get(teamId + ":chiller");
    if (!raw) return new Response(JSON.stringify({ error: "no chiller cache" }), { headers: { "Content-Type": "application/json" } });
    const cached = JSON.parse(raw);
    return new Response(JSON.stringify({ playerStatsCount: (cached.playerStats || []).length, playerStats: (cached.playerStats || []).slice(0, 3), availabilityCount: (cached.availability || []).length }, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  if (subPath === "/availability") {
    const raw = await env.LINEUP_KV.get(teamId + ":chiller");
    if (!raw) return new Response(JSON.stringify({ availability: [] }), { headers: { "Content-Type": "application/json" } });
    const cached = JSON.parse(raw);
    return new Response(JSON.stringify({ availability: cached.availability || [] }), { headers: { "Content-Type": "application/json" } });
  }

  if (subPath === "/next-game") {
    if (!baseConfig.chillerTeamId) return new Response("null", { headers: { "Content-Type": "application/json" } });
    try {
      const res = await fetch("https://chillerstats.com/team/schedule.cfm?TeamID=" + baseConfig.chillerTeamId, { headers: FETCH_HEADERS });
      const html = await res.text();
      return new Response(JSON.stringify(parseNextGame(html)), { headers: { "Content-Type": "application/json" } });
    } catch(e) {
      return new Response("null", { headers: { "Content-Type": "application/json" } });
    }
  }

  if (subPath === "/toggle-status" && request.method === "POST") {
    let state = null;
    try { const raw = await env.LINEUP_KV.get(kvKey); if (raw) state = JSON.parse(raw); } catch(e) {}
    state = state || {};
    state.isSet = !state.isSet;
    await env.LINEUP_KV.put(kvKey, JSON.stringify(state));
    if (state.isSet) {
      const ts = Date.now();
      await env.LINEUP_KV.put(teamId + ":history:" + ts, JSON.stringify(state), {
        metadata: { opponent: state.opponent || "", gamedate: state.gamedate || "", homeaway: state.homeaway || "" }
      });
    }
    return new Response(JSON.stringify({ isSet: state.isSet }), { headers: { "Content-Type": "application/json" } });
  }

  if (subPath === "/brand" && request.method === "POST") {
    const fd = await request.formData();
    const primaryColor = (fd.get("primaryColor") || "").trim();
    // Load existing brand to preserve flags for logos not being replaced
    let brand = {};
    try { const r = await env.LINEUP_KV.get(teamId + ":brand"); if (r) brand = JSON.parse(r); } catch(e) {}
    brand.primaryColor = primaryColor;
    brand.fwdLines = parseInt(fd.get("fwdLines") || "3", 10);
    brand.defLines = parseInt(fd.get("defLines") || "2", 10);
    brand.threeDefLines = brand.defLines === 3;
    // Jersey config — alt is optional
    var jerseyIds = ["home", "away"];
    if ((fd.get("jersey_alt_label") || "").trim()) jerseyIds.push("alt");
    brand.jerseys = jerseyIds.map(function(id) {
      return {
        id: id,
        label: (fd.get("jersey_" + id + "_label") || "").trim() || id.charAt(0).toUpperCase() + id.slice(1),
        color: (fd.get("jersey_" + id + "_color") || "#1a1a1a").trim(),
      };
    });
    async function storeLogoIfUploaded(field, r2Key, kvKey, flagKey) {
      const file = fd.get(field);
      if (file && file.size > 0) {
        const buf = await file.arrayBuffer();
        if (env.LOGO_BUCKET) {
          await env.LOGO_BUCKET.put(r2Key, buf, { httpMetadata: { contentType: file.type || "image/png" } });
        } else {
          await env.LINEUP_KV.put(kvKey, buf, { metadata: { contentType: file.type || "image/png" } });
        }
        brand[flagKey] = true;
      }
    }
    await storeLogoIfUploaded("logoMain", teamId + "/logo/main", teamId + ":logo:main", "hasLogoMain");
    const division = (fd.get("division") || "").trim();
    const { DIVISIONS } = await import('../constants.js');
    brand.division = DIVISIONS.includes(division) ? division : null;
    const chillerUrl = (fd.get("chillerUrl") || "").trim();
    if (chillerUrl) {
      try {
        const parsed = new URL(chillerUrl);
        const newChillerId = parsed.searchParams.get("TeamID") || parsed.searchParams.get("teamid") || parsed.searchParams.get("teamID") || null;
        if (newChillerId) brand.chillerTeamId = newChillerId;
      } catch(e) {}
    }
    await env.LINEUP_KV.put(teamId + ":brand", JSON.stringify(brand));
    // Also update the team KV record for registered teams so admin table stays in sync
    if (baseConfig._kvTeam) {
      const teamRaw = await env.LINEUP_KV.get("team:" + teamId);
      if (teamRaw) {
        const teamRecord = JSON.parse(teamRaw);
        teamRecord.division = brand.division;
        if (brand.chillerTeamId) teamRecord.chillerTeamId = brand.chillerTeamId;
        await env.LINEUP_KV.put("team:" + teamId, JSON.stringify(teamRecord));
      }
    }
    const freshConfig = await resolveConfig(baseConfig, teamId, env);
    const myTeams2 = await buildMyTeams(session, env);
    return new Response(brandPage(freshConfig, teamId, brand, true, session, myTeams2), { headers: { "Content-Type": "text/html" } });
  }

  if (subPath === "/brand") {
    let brand = {};
    try { const r = await env.LINEUP_KV.get(teamId + ":brand"); if (r) brand = JSON.parse(r); } catch(e) {}
    const myTeams2 = await buildMyTeams(session, env);
    return new Response(brandPage(config, teamId, brand, false, session, myTeams2), { headers: { "Content-Type": "text/html" } });
  }

  if (subPath === "/" || subPath === "") {
    let state = null;
    try { const raw = await env.LINEUP_KV.get(kvKey); if (raw) state = JSON.parse(raw); } catch(e) {}
    const myTeams = await buildMyTeams(session, env);
    return new Response(editPage(state, config, teamId, session, myTeams), { headers: { "Content-Type": "text/html" } });
  }

  if (subPath === "/stats") {
    const myTeams2 = await buildMyTeams(session, env);
    return new Response(statsPage(config, teamId, session, myTeams2), { headers: { "Content-Type": "text/html" } });
  }

  if (subPath === "/roster" && request.method === "POST") {
    const fd = await request.formData();
    const count = parseInt(fd.get("count") || "0");
    const managed = [{ num: "", name: "", isSub: false }];
    for (let i = 1; i <= count; i++) {
      const name = (fd.get("name_" + i) || "").trim().toUpperCase();
      if (!name) continue;
      const num = (fd.get("num_" + i) || "").trim();
      const isSub = fd.get("sub_" + i) === "1";
      managed.push({ num, name, isSub });
    }
    managed.sort(function(a, b) { if (!a.name) return -1; if (!b.name) return 1; return a.name.localeCompare(b.name); });
    await env.LINEUP_KV.put(teamId + ":roster", JSON.stringify(managed));
    const freshConfig = await resolveConfig(baseConfig, teamId, env);
    const myTeams2 = await buildMyTeams(session, env);
    return new Response(rosterPage(freshConfig, teamId, managed, session, myTeams2, true), { headers: { "Content-Type": "text/html" } });
  }

  if (subPath === "/roster") {
    const rosterRaw = await env.LINEUP_KV.get(teamId + ":roster");
    const managed = rosterRaw ? JSON.parse(rosterRaw) : null;
    const myTeams2 = await buildMyTeams(session, env);
    return new Response(rosterPage(config, teamId, managed, session, myTeams2, false), { headers: { "Content-Type": "text/html" } });
  }

  if (subPath === "/schedule") {
    const myTeams2 = await buildMyTeams(session, env);
    return new Response(schedulePage(config, teamId, session, myTeams2), { headers: { "Content-Type": "text/html" } });
  }

  if (subPath.startsWith("/roster/profile/")) {
    const playerName = decodeURIComponent(subPath.slice(16));
    const kvKey2 = teamId + ":profile:" + playerName.toUpperCase();
    if (request.method === "POST") {
      const body = await request.json();
      const profile = { email: (body.email || "").trim(), phone: (body.phone || "").trim() };
      await env.LINEUP_KV.put(kvKey2, JSON.stringify(profile));
      return new Response(JSON.stringify(profile), { headers: { "Content-Type": "application/json" } });
    }
    const raw = await env.LINEUP_KV.get(kvKey2);
    const profile = raw ? JSON.parse(raw) : { email: "", phone: "" };
    return new Response(JSON.stringify(profile), { headers: { "Content-Type": "application/json" } });
  }

  if (subPath === "/history") {
    const listResult = await env.LINEUP_KV.list({ prefix: teamId + ":history:", limit: 50 });
    const entries = listResult.keys.sort(function(a, b) { return b.name.localeCompare(a.name); });
    const myTeams2 = await buildMyTeams(session, env);
    return new Response(historyPage(entries, config, teamId, session, myTeams2), { headers: { "Content-Type": "text/html" } });
  }

  if (subPath.startsWith("/history/") && subPath.endsWith("/recap")) {
    const ts = subPath.slice(9, -6);
    const historyKey = teamId + ":history:" + ts;
    const { metadata: histMeta } = await env.LINEUP_KV.getWithMetadata(historyKey);
    const meta = histMeta || {};
    const gamedate = meta.gamedate || "";
    const opponent = meta.opponent || "";
    if (!gamedate || !opponent) return new Response(JSON.stringify({ error: "no game info" }), { headers: { "Content-Type": "application/json" } });

    const cacheKey = teamId + ":recap:" + gamedate + ":" + opponent.replace(/[^a-z0-9]/gi, "_");
    const cachedRecap = await env.LINEUP_KV.get(cacheKey);
    if (cachedRecap) return new Response(cachedRecap, { headers: { "Content-Type": "application/json" } });

    const chillerRaw = await env.LINEUP_KV.get(teamId + ":chiller");
    if (!chillerRaw) return new Response(JSON.stringify({ error: "no schedule" }), { headers: { "Content-Type": "application/json" } });
    const chiller = JSON.parse(chillerRaw);
    const schedule = chiller.schedule || [];
    const schedEntry = schedule.find(function(s) {
      return s.date === gamedate && s.opponent && s.opponent.toUpperCase() === opponent.toUpperCase() && s.isPast;
    });
    if (!schedEntry) return new Response(JSON.stringify({ error: "no schedule match" }), { headers: { "Content-Type": "application/json" } });

    const baseResult = { score: schedEntry.score, result: schedEntry.result, isHome: schedEntry.isHome };
    if (!schedEntry.scoresheetUrl) return new Response(JSON.stringify(baseResult), { headers: { "Content-Type": "application/json" } });

    try {
      const { parseScoresheet } = await import('../db/chillerstats.js');
      const ssRes = await fetch(schedEntry.scoresheetUrl, { headers: FETCH_HEADERS });
      if (!ssRes.ok) return new Response(JSON.stringify(baseResult), { headers: { "Content-Type": "application/json" } });
      const ssHtml = await ssRes.text();
      const recap = parseScoresheet(ssHtml, config.chillerTeamId);
      const full = { ...baseResult, goals: recap.goals, ourScore: recap.ourScore, theirScore: recap.theirScore };
      const json = JSON.stringify(full);
      await env.LINEUP_KV.put(cacheKey, json, { expirationTtl: 86400 });
      return new Response(json, { headers: { "Content-Type": "application/json" } });
    } catch(e) {
      return new Response(JSON.stringify(baseResult), { headers: { "Content-Type": "application/json" } });
    }
  }

  if (subPath.startsWith("/history/") && subPath.endsWith("/delete") && request.method === "POST") {
    const ts = subPath.slice(9, -7);
    await env.LINEUP_KV.delete(teamId + ":history:" + ts);
    return new Response("ok");
  }

  if (subPath.startsWith("/history/") && subPath.endsWith("/apply") && request.method === "POST") {
    const ts = subPath.slice(9, -6);
    let state = null;
    try { const raw = await env.LINEUP_KV.get(teamId + ":history:" + ts); if (raw) state = JSON.parse(raw); } catch(e) {}
    if (!state) return new Response("Not found", { status: 404 });
    state.isSet = false;
    await env.LINEUP_KV.put(kvKey, JSON.stringify(state));
    return new Response("ok");
  }

  if (subPath.startsWith("/history/")) {
    const ts = subPath.slice(9);
    let state = null;
    try { const raw = await env.LINEUP_KV.get(teamId + ":history:" + ts); if (raw) state = JSON.parse(raw); } catch(e) {}
    if (!state) return new Response("Not found", { status: 404 });
    return new Response(viewPage(state, config), { headers: { "Content-Type": "text/html" } });
  }

  return new Response("Not found", { status: 404 });
}
