const SLOT_POSITIONS = new Set(["lw", "c", "rw", "ld", "rd", "g"]);

function parseSlot(slot) {
  const m = slot.match(/^([a-z]+)(\d+)$/);
  if (!m || !SLOT_POSITIONS.has(m[1])) return null;
  return { position: m[1], line_number: parseInt(m[2], 10) };
}

export async function upsertUser(db, user) {
  try { await db.prepare(`ALTER TABLE users ADD COLUMN avatar_url TEXT`).run(); } catch(e) {}
  await db.prepare(
    `INSERT INTO users (id, email, first_name, last_name, password_hash, role, chiller_cookie, avatar_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email=excluded.email, first_name=excluded.first_name, last_name=excluded.last_name,
       password_hash=excluded.password_hash, role=excluded.role, chiller_cookie=excluded.chiller_cookie,
       avatar_url=excluded.avatar_url`
  ).bind(user.id, user.email||null, user.firstName||"", user.lastName||"", user.passwordHash||null, user.role||"team_member", user.chillerCookie||null, user.avatarUrl||null, user.createdAt||Date.now()).run();
  if (user.teamIds && user.teamIds.length) {
    await Promise.all(user.teamIds.map(tid =>
      db.prepare(`INSERT OR IGNORE INTO user_teams (user_id, team_id) VALUES (?, ?)`).bind(user.id, tid).run()
    ));
  }
}

export async function upsertTeam(db, team) {
  await db.prepare(
    `INSERT INTO teams (id, name, division, chiller_team_id, primary_color, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, division=excluded.division,
       chiller_team_id=excluded.chiller_team_id, primary_color=excluded.primary_color`
  ).bind(team.slug||team.id, team.name, team.division||null, team.chillerTeamId||null, team.primaryColor||"#c0392b", team.createdAt||Date.now()).run();
}

export async function upsertGames(db, teamId, schedule) {
  if (!schedule || !schedule.length) return;
  const stmt = db.prepare(
    `INSERT INTO games (team_id, date, time, opponent, rink, is_home, score, result, scoresheet_url, is_past, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_id, date, opponent) DO UPDATE SET
       time=excluded.time, rink=excluded.rink, is_home=excluded.is_home,
       score=excluded.score, result=excluded.result, scoresheet_url=excluded.scoresheet_url,
       is_past=excluded.is_past, synced_at=excluded.synced_at`
  );
  const now = Date.now();
  await Promise.all(schedule.map(g => stmt.bind(teamId, g.date, g.time||null, g.opponent||"", g.rink||null, g.isHome?1:0, g.score||null, g.result||null, g.scoresheetUrl||null, g.isPast?1:0, now).run()));
}

export async function upsertLineup(db, teamId, lineupId, state) {
  await db.prepare(
    `INSERT INTO lineups (id, team_id, opponent, game_date, game_time, rink, jersey, home_away, notes, is_set, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       opponent=excluded.opponent, game_date=excluded.game_date, game_time=excluded.game_time,
       rink=excluded.rink, jersey=excluded.jersey, home_away=excluded.home_away,
       notes=excluded.notes, is_set=excluded.is_set`
  ).bind(lineupId, teamId, state.opponent||null, state.gamedate||null, state.gametime||null, state.rink||null, state.jersey||null, state.homeaway||null, state.notes||null, state.isSet?1:0, parseInt(lineupId)||Date.now()).run();
  await db.prepare(`DELETE FROM player_assignments WHERE lineup_id = ?`).bind(lineupId).run();
  const assignments = [];
  for (const [slot, playerName] of Object.entries(state)) {
    const parsed = parseSlot(slot);
    if (!parsed) continue;
    assignments.push({ slot, position: parsed.position, line_number: parsed.line_number, player_name: playerName || null });
  }
  if (assignments.length) {
    const stmt = db.prepare(`INSERT INTO player_assignments (lineup_id, slot, position, line_number, player_name) VALUES (?, ?, ?, ?, ?)`);
    await Promise.all(assignments.map(a => stmt.bind(lineupId, a.slot, a.position, a.line_number, a.player_name).run()));
  }
}

export async function upsertRoster(db, teamId, roster) {
  try { await db.prepare(`ALTER TABLE roster_players ADD COLUMN chiller_player_id TEXT`).run(); } catch(e) {}
  await db.prepare(`DELETE FROM roster_players WHERE team_id = ?`).bind(teamId).run();
  const players = (roster || []).filter(p => p.name);
  if (!players.length) return;
  const stmt = db.prepare(`INSERT INTO roster_players (team_id, num, name, is_sub, sort_order, chiller_player_id) VALUES (?, ?, ?, ?, ?, ?)`);
  await Promise.all(players.map((p, i) => stmt.bind(teamId, p.num||"", p.name, p.isSub?1:0, i, p.chillerPlayerId||null).run()));
}

export async function upsertPlayerProfile(db, teamId, playerName, profile) {
  try { await db.prepare(`ALTER TABLE player_profiles ADD COLUMN chiller_player_id TEXT`).run(); } catch(e) {}
  await db.prepare(
    `INSERT INTO player_profiles (team_id, player_name, email, phone, chiller_player_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(team_id, player_name) DO UPDATE SET
       email=COALESCE(excluded.email, email),
       phone=COALESCE(excluded.phone, phone),
       chiller_player_id=COALESCE(excluded.chiller_player_id, chiller_player_id)`
  ).bind(teamId, playerName, profile.email||null, profile.phone||null, profile.chillerPlayerId||null).run();
}

export async function ensureChatSchema(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS channel_reads (
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      last_read_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, channel_id)
    )`).run();
  } catch(e) {}
  const alters = [
    `ALTER TABLE chat_rooms ADD COLUMN type TEXT DEFAULT 'general'`,
    `ALTER TABLE chat_rooms ADD COLUMN division TEXT`,
    `ALTER TABLE chat_rooms ADD COLUMN game_date TEXT`,
    `ALTER TABLE chat_rooms ADD COLUMN opponent TEXT`,
    `ALTER TABLE chat_rooms ADD COLUMN archived INTEGER DEFAULT 0`,
    `ALTER TABLE chat_rooms ADD COLUMN dm_user1 TEXT`,
    `ALTER TABLE chat_rooms ADD COLUMN dm_user2 TEXT`,
    `ALTER TABLE chat_messages ADD COLUMN display_name TEXT`,
    `ALTER TABLE chat_messages ADD COLUMN team_id TEXT`,
    `ALTER TABLE chat_messages ADD COLUMN team_name TEXT`,
    `ALTER TABLE chat_messages ADD COLUMN primary_color TEXT`,
    `ALTER TABLE users ADD COLUMN avatar_url TEXT`,
    `ALTER TABLE chat_messages ADD COLUMN reply_to_id INTEGER`,
    `ALTER TABLE chat_messages ADD COLUMN reply_to_snippet TEXT`,
    `ALTER TABLE chat_messages ADD COLUMN edited INTEGER DEFAULT 0`,
    `ALTER TABLE chat_messages ADD COLUMN deleted INTEGER DEFAULT 0`,
  ];
  for (const sql of alters) {
    try { await db.prepare(sql).run(); } catch(e) {}
  }
}

function slugChannel(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fmtChannelDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch(e) { return dateStr; }
}

export async function ensureChannel(db, id, teamId, type, name, opts) {
  opts = opts || {};
  if (!teamId) return;
  await db.prepare(
    `INSERT OR IGNORE INTO chat_rooms (id, team_id, type, name, division, game_date, opponent, archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).bind(id, teamId, type, name, opts.division||null, opts.gameDate||null, opts.opponent||null, Date.now()).run();
}

export async function ensureGameChannels(db, teamId, schedule) {
  if (!schedule || !schedule.length) return;
  const today = new Date().toISOString().slice(0, 10);
  for (const g of schedule) {
    if (!g.date || g.date < today) continue;
    const slug = slugChannel(g.opponent || "tbd");
    const id = teamId + ":game:" + g.date + ":" + slug;
    const name = "vs " + (g.opponent || "TBD") + " \xB7 " + fmtChannelDate(g.date);
    await ensureChannel(db, id, teamId, "game", name, { gameDate: g.date, opponent: g.opponent || null });
  }
  try {
    await db.prepare(`UPDATE chat_rooms SET archived = 1 WHERE team_id = ? AND type = 'game' AND game_date < ? AND archived = 0`).bind(teamId, today).run();
  } catch(e) {}
}
