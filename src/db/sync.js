import { fetchChillerstats } from './chillerstats.js';

export async function syncTeamData(env, teamId, chillerTeamId, chillerCookie) {
  const data = await fetchChillerstats(chillerTeamId, chillerCookie);
  await env.LINEUP_KV.put(teamId + ":chiller", JSON.stringify({ ...data, syncedAt: Date.now() }));
  // Smart-merge: preserve isSub flags and manually-added players not in ChillerStats
  const existingRaw = await env.LINEUP_KV.get(teamId + ":roster");
  const existing = existingRaw ? JSON.parse(existingRaw) : null;
  const subMap = {};
  if (existing) existing.forEach(function(p) { if (p.name && p.isSub) subMap[p.name] = true; });
  if (data.roster && data.roster.length > 1) {
    const chillerNames = new Set();
    const managed = data.roster.slice(1).map(function(r) {
      chillerNames.add(r[1]);
      return { num: r[0], name: r[1], isSub: !!subMap[r[1]] };
    });
    // Preserve manually-added players (e.g. goaltenders) not returned by ChillerStats
    if (existing) {
      existing.forEach(function(p) {
        if (p.name && !chillerNames.has(p.name)) {
          managed.push({ num: p.num || "", name: p.name, isSub: !!p.isSub });
        }
      });
    }
    managed.sort(function(a, b) { return a.name.localeCompare(b.name); });
    managed.unshift({ num: "", name: "", isSub: false });
    await env.LINEUP_KV.put(teamId + ":roster", JSON.stringify(managed));
  }
  // Auto-populate player profile emails (never overwrite existing)
  if (data.rosterEmails && data.rosterEmails.length) {
    await Promise.all(data.rosterEmails.map(async function({ name, email }) {
      const profileKey = teamId + ":profile:" + name;
      const existing = await env.LINEUP_KV.get(profileKey);
      const profile = existing ? JSON.parse(existing) : {};
      if (!profile.email) {
        profile.email = email;
        await env.LINEUP_KV.put(profileKey, JSON.stringify(profile));
      }
    }));
  }
  return data;
}
