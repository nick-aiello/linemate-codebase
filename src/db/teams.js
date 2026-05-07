import { TEAM_CONFIGS, DIVISIONS, CAHL_RINKS } from '../constants.js';
import { CAHL } from '../assets.js';

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function getTeamConfig(env, teamId) {
  try {
    const raw = await env.LINEUP_KV.get("team:" + teamId);
    if (raw) {
      const t = JSON.parse(raw);
      return {
        name: t.name,
        chillerTeamId: t.chillerTeamId || null,
        primaryColor: t.primaryColor || "#c0392b",
        opponents: [],
        rinks: [...CAHL_RINKS],
        roster: [["", ""]],
        defaults: {},
        logoMain: null,
        logoMainAlt: t.name,
        logoFooter: [{ src: CAHL, alt: "CAHL" }],
        division: t.division || null,
        _kvTeam: true,
      };
    }
  } catch(e) {}
  return TEAM_CONFIGS[teamId] || null;
}

export async function createTeam(env, { slug, name, division, chillerTeamId, primaryColor, contactName, contactEmail }) {
  const team = { slug, name, division: division || null, chillerTeamId: chillerTeamId || null, primaryColor: primaryColor || "#c0392b", contactName, contactEmail, createdAt: Date.now() };
  await env.LINEUP_KV.put("team:" + slug, JSON.stringify(team));
  return team;
}

export async function listTeams(env) {
  const result = await env.LINEUP_KV.list({ prefix: "team:", limit: 1000 });
  const teams = await Promise.all(result.keys.map(k => env.LINEUP_KV.get(k.name).then(r => r ? JSON.parse(r) : null)));
  return teams.filter(Boolean);
}

export async function resolveConfig(base, teamId, env) {
  var merged = base;
  try {
    const raw = await env.LINEUP_KV.get(teamId + ":chiller");
    if (raw) {
      const cached = JSON.parse(raw);
      merged = {
        ...merged,
        name: cached.name || merged.name,
        roster: cached.roster && cached.roster.length > 1 ? cached.roster : merged.roster,
        opponents: cached.opponents && cached.opponents.length ? cached.opponents : merged.opponents,
        rinks: [...new Set([...CAHL_RINKS, ...(cached.rinks || []), ...(merged.rinks || [])])],
        nextGame: cached.nextGame || null,
        availability: cached.availability || [],
        playerStats: cached.playerStats || [],
        schedule: cached.schedule || [],
        standings: cached.standings || [],
        syncedAt: cached.syncedAt || null,
      };
    }
  } catch(e) {}
  try {
    const rosterRaw = await env.LINEUP_KV.get(teamId + ":roster");
    if (rosterRaw) {
      const managedRoster = JSON.parse(rosterRaw);
      if (managedRoster && managedRoster.length > 1) {
        // Convert managed roster [{num,name,isSub}] to [[num,name]] format for compatibility
        merged.roster = managedRoster.map(function(p) { return [p.num, p.name]; });
        merged.managedRoster = managedRoster;
      }
    }
  } catch(e) {}
  try {
    const brandRaw = await env.LINEUP_KV.get(teamId + ":brand");
    if (brandRaw) {
      const brand = JSON.parse(brandRaw);
      merged = {
        ...merged,
        primaryColor: /^#[0-9a-fA-F]{6}$/.test(brand.primaryColor) ? brand.primaryColor : merged.primaryColor,
        logoMain: brand.hasLogoMain ? "/" + teamId + "/logo/main" : merged.logoMain,
        jerseys: brand.jerseys || null,
        threeDefLines: brand.threeDefLines || merged.threeDefLines || false,
        fwdLines: brand.fwdLines || merged.fwdLines || 3,
        defLines: brand.defLines || (brand.threeDefLines ? 3 : (merged.defLines || 2)),
        division: brand.division || merged.division || null,
        chillerTeamId: brand.chillerTeamId || merged.chillerTeamId || null,
      };
    }
  } catch(e) {}
  merged._teamId = teamId;
  merged._cahlSrc = CAHL;
  return merged;
}

export async function buildMyTeams(session, env) {
  if (session.role === "superadmin" || session.role === "admin") {
    const kvTeams = await listTeams(env);
    const allIds = [...Object.keys(TEAM_CONFIGS), ...kvTeams.map(t => t.slug)];
    return (await Promise.all(allIds.map(async function(id) {
      const cfg = await getTeamConfig(env, id);
      return cfg ? { slug: id, name: cfg.name } : null;
    }))).filter(Boolean);
  } else {
    const { getUserTeamIds } = await import('../db/users.js');
    const teamIds = getUserTeamIds(session);
    if (teamIds.length > 1) {
      return (await Promise.all(teamIds.map(async function(id) {
        const cfg = await getTeamConfig(env, id);
        return cfg ? { slug: id, name: cfg.name } : null;
      }))).filter(Boolean);
    }
    return [];
  }
}
