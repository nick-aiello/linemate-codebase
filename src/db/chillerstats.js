import { FETCH_HEADERS } from '../constants.js';

export async function chillerLogin(username, password) {
  const body = new URLSearchParams({ username, userpassword: password, PayNow: "N" });
  const res = await fetch("https://chillerstats.com/cflogin.cfm", {
    method: "POST",
    headers: { ...FETCH_HEADERS, "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://chillerstats.com/login.cfm" },
    body: body.toString(),
    redirect: "manual",
  });
  // Success = redirect away from login.cfm
  const location = res.headers.get("Location") || "";
  if (res.status !== 302 || location.includes("login.cfm")) return null;
  // Extract all Set-Cookie headers and join them for use as a Cookie header
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  if (!cookies.length) return null;
  // Store just the name=value pairs
  return cookies.map(c => c.split(";")[0]).join("; ");
}

export function parseNextGame(schedHtml) {
  const trScanRe = /<tr>([\s\S]*?)<\/tr>/g;
  let tRow;
  while ((tRow = trScanRe.exec(schedHtml)) !== null) {
    const row = tRow[1];
    const scoreCell = row.match(/<td[^>]*min-width:50px[^>]*>([\s\S]*?)<\/td>/);
    if (!scoreCell || scoreCell[1].trim()) continue;
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let cm;
    while ((cm = cellRe.exec(row)) !== null) cells.push(cm[1].replace(/<[^>]+>/g, "").trim());
    const dateStr = cells[0] || "";
    const time12 = cells[1] || "";
    const facility = (cells[2] || "").replace(/^Chiller\s+/, "");
    const oppMatch = row.match(/<td[^>]*><a href="index\.cfm[^"]*"[^>]*>([^<]+)<\/a><\/td>/);
    if (!dateStr || !time12 || !oppMatch) break;
    // Detect home/away by scanning all cells for the opponent name
    // (column layout varies: some rows have an extra rink-sub column)
    const opponent = oppMatch[1].trim();
    let isHome = null;
    for (var ci = 3; ci < cells.length - 1; ci++) {
      if (cells[ci] === opponent) { isHome = false; break; }      // opponent in home slot → we're away
      if (cells[ci + 1] === opponent) { isHome = true; break; }   // opponent in away slot → we're home
    }
    const MONTHS = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
    const dp = dateStr.trim().split(/\s+/);
    const mon = MONTHS[dp[0]], day = parseInt(dp[1]);
    const now = new Date();
    let year = now.getFullYear();
    if (mon && day && new Date(year, mon - 1, day) < now) year++;
    const dateISO = mon && day ? year + "-" + String(mon).padStart(2,"0") + "-" + String(day).padStart(2,"0") : "";
    const tm = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let time24 = "";
    if (tm) {
      let h = parseInt(tm[1]);
      if (tm[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (tm[3].toUpperCase() === "AM" && h === 12) h = 0;
      time24 = String(h).padStart(2,"0") + ":" + tm[2];
    }
    return { date: dateISO, time: time24, rink: facility, opponent, isHome };
  }
  return null;
}

export async function fetchChillerstats(chillerTeamId, chillerCookie) {
  const base = "https://chillerstats.com/team/";
  const headers = chillerCookie ? { ...FETCH_HEADERS, "Cookie": chillerCookie } : FETCH_HEADERS;
  // Schedule fetched without auth for row parsing — authenticated responses inject nested
  // rink-selector sub-tables into the next game row that break TR regex parsing.
  // Authenticated schedule fetched separately only to extract the attendee_display link.
  const fetches = [
    fetch(base + "stats.cfm?TeamID=" + chillerTeamId, { headers }),
    fetch(base + "schedule.cfm?TeamID=" + chillerTeamId, { headers: FETCH_HEADERS }),
  ];
  if (chillerCookie) {
    fetches.push(fetch(base + "schedule.cfm?TeamID=" + chillerTeamId, { headers }));
  }
  const [statsRes, schedRes, authSchedRes] = await Promise.all(fetches);
  if (!statsRes.ok) throw new Error("chillerstats stats fetch failed: " + statsRes.status);
  if (!schedRes.ok) throw new Error("chillerstats schedule fetch failed: " + schedRes.status);

  const textFetches = [statsRes.text(), schedRes.text()];
  if (authSchedRes) textFetches.push(authSchedRes.text());
  const [statsHtml, schedHtml, authSchedHtml] = await Promise.all(textFetches);

  // --- team name ---
  const nameMatch = statsHtml.match(/<h1>([^<]+)<\/h1>/);
  const name = nameMatch ? nameMatch[1].trim() : "";

  // --- roster: pair each Jersey td with the following Name td ---
  const roster = [["", ""]];
  const rowRe = /data-title="Jersey">(\d*)<\/td>[\s\S]*?data-title="Name">[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
  const seen = new Set();
  let m;
  while ((m = rowRe.exec(statsHtml)) !== null) {
    const num = m[1].trim();
    const playerName = m[2].trim().toUpperCase();
    if (!seen.has(playerName)) {
      seen.add(playerName);
      roster.push([num, playerName]);
    }
  }

  // --- opponents: all linked team names in schedule that are not this team ---
  const opponents = new Set();
  const oppRe = /<td class="text-center"><a href="index\.cfm[^"]*"[^>]*>([^<]+)<\/a><\/td>/g;
  while ((m = oppRe.exec(schedHtml)) !== null) {
    opponents.add(m[1].trim());
  }

  const rinks = new Set();

  // --- next upcoming game + attendance link ---
  const nextGame = parseNextGame(schedHtml);
  // Grab the attendee_display URL — only present in authenticated schedule HTML
  const attendeeMatch = (authSchedHtml || "").match(/data-remote-link="attendee_display\.cfm\?([^"]+)"/);
  const attendeeParams = attendeeMatch ? attendeeMatch[1] : null;

  // --- full schedule ---
  // Structure per row: Date | Time | Facility | Surface | Team1 | Team2 | Score | Scoresheet
  // Our team is always bold (style contains "font-weight:bold") with no link.
  // Opponent always has an <a href="index.cfm..."> link.
  // Team1 = home, Team2 = away.
  // W/L/T is in the scoresheet link text.
  const schedule = [];
  const MONTHS2 = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const schedRowRe2 = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let sr;
  while ((sr = schedRowRe2.exec(schedHtml)) !== null) {
    const row = sr[1];
    // Date: first td text, stripping any inner tags (upcoming rows may wrap date in <b>/<span>)
    const firstTd = row.match(/<td[^>]*>([\s\S]*?)<\/td>/);
    if (!firstTd) continue;
    const dateText = firstTd[1].replace(/<[^>]+>/g, "").trim();
    const dateMatch = dateText.match(/^([A-Za-z]+)\s+(\d+)/);
    if (!dateMatch) continue;
    const mon2 = MONTHS2[dateMatch[1]];
    if (!mon2) continue;
    const day2 = parseInt(dateMatch[2]);
    if (!day2) continue;
    const now2 = new Date();
    let yr2 = now2.getFullYear();
    // If computed date is more than 6 months in the future, it's from last year (e.g. Oct game parsed in Apr)
    if (new Date(yr2, mon2 - 1, day2) > new Date(now2.getTime() + 180 * 24 * 60 * 60 * 1000)) yr2--;
    const dateISO2 = yr2 + "-" + String(mon2).padStart(2,"0") + "-" + String(day2).padStart(2,"0");
    // Time — capture 12h string and convert to 24h for formatTime compatibility
    const timeCell = row.match(/<td[^>]*>\s*(\d+):(\d+)\s*(AM|PM)\s*<\/td>/i);
    let time = "";
    if (timeCell) {
      let th = parseInt(timeCell[1]);
      if (timeCell[3].toUpperCase() === "PM" && th !== 12) th += 12;
      if (timeCell[3].toUpperCase() === "AM" && th === 12) th = 0;
      time = String(th).padStart(2,"0") + ":" + timeCell[2];
    }
    // Facility is the 3rd td column (Date | Time | Facility | ...)
    const allTds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    const facilityText = allTds[2] ? allTds[2][1].replace(/<[^>]+>/g, "").trim() : "";
    // Strip "Chiller " prefix unless it's part of the actual name (e.g. "Chiller Ice Works")
    const rink = /^Chiller\s+(North|Dublin|Easton|Fairgrounds)$/i.test(facilityText)
      ? facilityText.replace(/^Chiller\s+/i, "").trim()
      : facilityText;
    // Score
    const scoreCell2 = row.match(/<td[^>]*min-width:50px[^>]*>([\s\S]*?)<\/td>/);
    const score = scoreCell2 ? scoreCell2[1].replace(/<[^>]+>/g,"").trim() : "";
    const isPast = score.length > 0;
    // Opponent: any linked team name via index.cfm (be flexible about surrounding td attributes)
    const oppMatch2 = row.match(/<a\s[^>]*href="index\.cfm[^"]*"[^>]*>([^<]+)<\/a>/);
    if (!oppMatch2) continue;
    const opponent = oppMatch2[1].trim();
    // Home/away: our team is bold (no link). Check if bold td comes before or after opponent td.
    const ourTdIdx = row.search(/<td[^>]*style="[^"]*font-weight:bold[^"]*"[^>]*>/);
    const oppTdIdx = row.search(/<td[^>]*><a href="index\.cfm/);
    const isHome = ourTdIdx !== -1 && oppTdIdx !== -1 ? ourTdIdx < oppTdIdx : null;
    // W/L/T/OTL: from scoresheet link text; also grab scoresheet URL
    const wltMatch = row.match(/href="(\.\.\/scoresheet_new\.cfm\?([^"]+))"[^>]*class="btn btn-info"[^>]*>\s*(W|L|OTL|T)\s*<\/a>/);
    const result = wltMatch ? wltMatch[3].trim() : null;
    const scoresheetUrl = wltMatch ? "https://chillerstats.com/scoresheet_new.cfm?" + wltMatch[2] : null;
    if (rink) rinks.add(rink);
    schedule.push({ date: dateISO2, time, rink, opponent, isHome, score, isPast, result, scoresheetUrl });
  }

  // --- player stats ---
  const playerStats = [];
  const statRowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let ps;
  while ((ps = statRowRe.exec(statsHtml)) !== null) {
    const row = ps[1];
    const nameMatch = row.match(/data-title="Name">[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    const gpMatch = row.match(/data-title="GP">(\d+)<\/td>/);
    if (!nameMatch || !gpMatch) continue;
    const jerseyMatch = row.match(/data-title="Jersey">(\d*)<\/td>/);
    const gMatch = row.match(/data-title="G">(\d+)<\/td>/);
    const aMatch = row.match(/data-title="A">(\d+)<\/td>/);
    const ptsMatch = row.match(/data-title="PTS">(\d+)<\/td>/);
    const pimMatch = row.match(/data-title="PIM">(\d+)<\/td>/);
    playerStats.push({
      num: jerseyMatch ? jerseyMatch[1] : "",
      name: nameMatch[1].trim().toUpperCase(),
      gp: parseInt(gpMatch[1]) || 0,
      g: parseInt(gMatch && gMatch[1]) || 0,
      a: parseInt(aMatch && aMatch[1]) || 0,
      pts: parseInt(ptsMatch && ptsMatch[1]) || 0,
      pim: parseInt(pimMatch && pimMatch[1]) || 0,
    });
  }

  // --- attendance ---
  let availability = [];
  if (attendeeParams) {
    try {
      const attHeaders = chillerCookie ? { ...FETCH_HEADERS, "Cookie": chillerCookie } : FETCH_HEADERS;
      const attRes = await fetch("https://chillerstats.com/team/attendee_display.cfm?" + attendeeParams, { headers: attHeaders });
      if (attRes.ok) {
        const attHtml = await attRes.text();
        availability = parseAttendance(attHtml);
      }
    } catch(e) {}
  }

  // If attendee_display didn't work, try nextgame.cfm which requires login but has same data
  if (!availability.length && chillerCookie) {
    try {
      const ngRes = await fetch("https://chillerstats.com/team/nextgame.cfm?TeamID=" + chillerTeamId, { headers: { ...FETCH_HEADERS, "Cookie": chillerCookie } });
      if (ngRes.ok) {
        const ngHtml = await ngRes.text();
        availability = parseNextgameAttendance(ngHtml);
      }
    } catch(e) {}
  }

  // --- roster emails from alerts.cfm (requires login) ---
  let rosterEmails = [];
  if (chillerCookie) {
    try {
      const alertsRes = await fetch(base + "alerts.cfm?TeamID=" + chillerTeamId, { headers: { ...FETCH_HEADERS, "Cookie": chillerCookie } });
      if (alertsRes.ok) {
        const alertsHtml = await alertsRes.text();
        rosterEmails = parseRosterEmails(alertsHtml);
      }
    } catch(e) {}
  }

  // --- standings ---
  let standings = [];
  try {
    // Look for a standings link anywhere in the schedule page
    const standingsLinkMatch = schedHtml.match(/href="([^"]*standings[^"]*\.cfm[^"]*|[^"]*\.cfm\?[^"]*[Dd]ivision[^"]*)"/i);
    const candidateUrls = [];
    if (standingsLinkMatch) {
      let u = standingsLinkMatch[1];
      if (u.startsWith("../")) u = "https://chillerstats.com/" + u.slice(3);
      else if (u.startsWith("/")) u = "https://chillerstats.com" + u;
      else if (!u.startsWith("http")) u = "https://chillerstats.com/team/" + u;
      candidateUrls.push(u);
    }
    // Fallback: try TeamID-based standings URL
    candidateUrls.push("https://chillerstats.com/standings.cfm?TeamID=" + chillerTeamId);
    for (const url of candidateUrls) {
      const standingsRes = await fetch(url, { headers: FETCH_HEADERS });
      if (standingsRes.ok) {
        const parsed = parseStandings(await standingsRes.text());
        if (parsed.length) { standings = parsed; break; }
      }
    }
  } catch(e) {}

  return {
    name,
    roster: roster.sort((a, b) => a[1].localeCompare(b[1])),
    opponents: [...opponents].sort(),
    rinks: [...rinks].sort(),
    nextGame,
    schedule,
    playerStats,
    availability,
    rosterEmails,
    standings,
  };
}

export function parseScoresheet(html, chillerTeamId) {
  // Parse all playerJSobj properties to identify our team's players and side
  const allPlayers = {};
  const propRe = /playerJSobj\["([^"]+)"\]\["([^"]+)"\]\s*=\s*"([^"]*)"/g;
  let pm;
  while ((pm = propRe.exec(html)) !== null) {
    const pid = pm[1], prop = pm[2], val = pm[3];
    if (!allPlayers[pid]) allPlayers[pid] = {};
    allPlayers[pid][prop] = val;
  }
  const ourPlayers = new Set();
  var ourSide = null;
  for (const pid in allPlayers) {
    const p = allPlayers[pid];
    if (p.teamid === String(chillerTeamId)) {
      if (!ourSide && p.homeoraway) ourSide = p.homeoraway; // "H" or "A"
      const last = (p.lastname || "").trim().toUpperCase();
      if (last) ourPlayers.add(last);
    }
  }

  // Scores
  const homeScoreM = html.match(/<span[^>]*id="homeTeamScore"[^>]*>(\d+)<\/span>/);
  const awayScoreM = html.match(/<span[^>]*id="awayTeamScore"[^>]*>(\d+)<\/span>/);
  const homeScore = homeScoreM ? parseInt(homeScoreM[1]) : null;
  const awayScore = awayScoreM ? parseInt(awayScoreM[1]) : null;
  const ourScore = ourSide === "H" ? homeScore : ourSide === "A" ? awayScore : null;
  const theirScore = ourSide === "H" ? awayScore : ourSide === "A" ? homeScore : null;

  // Parse scoring rows
  const goals = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const row = rm[1];
    if (!row.includes('data-title="Goal:"')) continue;
    const periodM = row.match(/data-title="Period:"[^>]*>\s*([^<]+?)\s*<\/td>/);
    const teamM = row.match(/data-title="Team:"[^>]*>\s*([^<]+?)\s*<\/td>/);
    const goalM = row.match(/data-title="Goal:"[^>]*>\s*([^<]+?)\s*<\/td>/);
    const strengthM = row.match(/data-title="Strength:"[^>]*>\s*([^<]+?)\s*<\/td>/);
    const timeM = row.match(/data-title="Time:"[^>]*>\s*([^<]+?)\s*<\/td>/);
    const assistCell = row.match(/data-title="Assist:"[^>]*>([\s\S]*?)<\/td>/);

    const goalText = goalM ? goalM[1].trim() : "";
    // Extract name from "11 - Jenkins" format
    const scorerM = goalText.match(/(?:\d+\s*-\s*)(.+)$/);
    const scorer = scorerM ? scorerM[1].trim() : goalText;
    const scorerLast = scorer.split(/\s+/).pop().toUpperCase();
    const isOurGoal = ourSide !== null ? ourPlayers.has(scorerLast) : null;

    const assists = [];
    if (assistCell) {
      const divRe = /<div[^>]*>([^<]+)<\/div>/g;
      let am;
      while ((am = divRe.exec(assistCell[1])) !== null) {
        const aText = am[1].trim();
        if (aText && aText.toLowerCase() !== "none") assists.push(aText);
      }
    }

    goals.push({
      period: periodM ? periodM[1].trim() : "",
      team: teamM ? teamM[1].trim() : "",
      scorer,
      assists,
      strength: strengthM ? strengthM[1].trim() : "",
      time: timeM ? timeM[1].trim() : "",
      isOurGoal,
    });
  }

  return { ourSide, ourScore, theirScore, homeScore, awayScore, goals };
}

export function parseRosterEmails(html) {
  const result = [];
  const re = /<input[^>]*data-player-email="([^"]+)"[^>]*>\s*\n?\s*([^\n<]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const email = m[1].trim().toLowerCase();
    const name = m[2].trim().toUpperCase();
    if (email && name) result.push({ name, email });
  }
  return result;
}

export function parseNextgameAttendance(html) {
  // nextgame.cfm table: <td><a href="/email_check.cfm?...">Name</a></td><td class="text-center">Yes/No/Maybe/No Response</td>
  const result = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];
    const nameMatch = row.match(/<td><a href="\/email_check\.cfm\?[^"]*">([^<]+)<\/a><\/td>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim().toUpperCase();
    const statusMatch = row.match(/<td class="text-center">\s*([\s\S]*?)\s*<\/td>/);
    const raw = statusMatch ? statusMatch[1].replace(/<[^>]+>/g, "").trim().toLowerCase() : "";
    let status;
    if (raw === "yes") status = "yes";
    else if (raw === "no") status = "no";
    else if (raw === "maybe") status = "maybe";
    else status = "unknown";
    result.push({ name, status });
  }
  return result;
}

export function parseStandings(html) {
  const standings = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];
    const teamMatch = row.match(/data-title="Team"[^>]*>([\s\S]*?)<\/td>/i);
    if (!teamMatch) continue;
    const teamName = teamMatch[1].replace(/<[^>]+>/g, "").trim();
    if (!teamName || teamName.toLowerCase() === "team") continue;
    function col(title) {
      const re = new RegExp('data-title="' + title + '"[^>]*>([\\s\\S]*?)<\\/td>', 'i');
      const c = row.match(re);
      return c ? (parseInt(c[1].replace(/<[^>]+>/g, "").trim()) || 0) : 0;
    }
    standings.push({
      name: teamName,
      gp: col("GP"),
      w: col("W"),
      l: col("L"),
      otl: col("OTL"),
      t: col("T"),
      pts: col("PTS"),
      gf: col("GF"),
      ga: col("GA"),
    });
  }
  return standings;
}

export function parseAttendance(html) {
  const result = [];
  const rowRe = /<tr class="(success|danger|info)">([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const cls = m[1];
    const nameMatch = m[2].match(/<td[^>]*align="left"[^>]*>([^<]+)<\/td>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim().toUpperCase();
    const statusText = m[2].match(/<div>([\s\S]*?)<\/div>/);
    const raw = statusText ? statusText[1].trim() : "";
    let status;
    if (cls === "success") status = "yes";
    else if (cls === "danger" && raw.toLowerCase() === "no") status = "no";
    else if (raw.toLowerCase() === "maybe") status = "maybe";
    else status = "unknown";
    result.push({ name, status });
  }
  return result;
}
