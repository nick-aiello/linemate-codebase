import { LINEMATE_ALT_PNG } from '../assets.js';
import { SLOTS, SLOTS_3D } from '../constants.js';
import { fontFaceCSS, sharedCSS, fabCSS, darkenHex } from './css.js';

export { darkenHex };

export function defaultJerseys() {
  return [
    {id:"home", label:"Black", color:"#1a1a1a"},
    {id:"away", label:"White", color:"#1a1a1a"},
  ];
}

export function logoSrc(src) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("/")) return src;
  return "data:image/png;base64," + src;
}

export function rosterNum(name, roster) {
  var p = roster.find(function(r){return r[1]===name;});
  return p ? p[0] : "";
}

export function makeOptions(items, selected) {
  return (items || []).map(function(t){
    return "<option value=\"" + t + "\"" + (t===selected?" selected":"") + ">" + t + "</option>";
  }).join("");
}

export function jerseyOpts(selected, jerseys) {
  return (jerseys || defaultJerseys()).map(function(j){
    return "<option value=\"" + j.id + "\"" + (j.id===selected?" selected":"") + ">" + j.label + "</option>";
  }).join("");
}

export function rosterOpts(selected, roster, managedRoster, availability, playerStats) {
  var availMap = {};
  if (availability && availability.length) {
    availability.forEach(function(a) { availMap[a.name] = a.status; });
  }
  var hotMap = {};
  if (playerStats && playerStats.length) {
    playerStats.forEach(function(s) { if (s.gp > 0 && s.pts / s.gp >= 1) hotMap[s.name] = true; });
  }
  function availPrefix(name) {
    var s = availMap[name];
    if (s === "yes") return "\u2713 ";
    if (s === "no") return "\u2717 ";
    if (s === "maybe") return "? ";
    return "";
  }
  function label(name, isSel) {
    return (isSel ? "" : availPrefix(name)) + (hotMap[name] ? "\uD83D\uDD25 " : "") + name;
  }
  if (managedRoster && managedRoster.length > 1) {
    var regulars = managedRoster.filter(function(p){ return p.name && !p.isSub; });
    var subs = managedRoster.filter(function(p){ return p.name && p.isSub; });
    var blankOpt = "<option value=\"\"></option>";
    var regOpts = regulars.map(function(p){
      var isSel = p.name===selected;
      return "<option value=\"" + p.name + "\"" + (isSel?" selected":"") + ">" + label(p.name, isSel) + "</option>";
    }).join("");
    var subOpts = subs.map(function(p){
      var isSel = p.name===selected;
      return "<option value=\"" + p.name + "\"" + (isSel?" selected":"") + ">" + label(p.name, isSel) + "</option>";
    }).join("");
    var subGroup = subs.length ? "<optgroup label=\"── Subs ──\" style=\"color:#aaa\">" + subOpts + "</optgroup>" : "";
    return blankOpt + regOpts + subGroup;
  }
  return roster.map(function(r){
    var isSel = r[1]===selected;
    return "<option value=\"" + r[1] + "\"" + (isSel?" selected":"") + ">" + label(r[1], isSel) + "</option>";
  }).join("");
}

export function selectRow(slot, state, config) {
  var name = (state && state[slot] !== undefined) ? state[slot] : (config.defaults[slot] || "");
  var num = rosterNum(name, config.roster);
  return "<div class=\"player-row\">"
    + "<span class=\"player-number\" id=\"" + slot + "-num\">" + num + "</span>"
    + "<div class=\"cs\" id=\"" + slot + "-sel\" data-value=\"" + name + "\">"
    + "<button class=\"cs-btn\" type=\"button\" onclick=\"openPicker('" + slot + "')\">"
    + "<span class=\"cs-lbl\" id=\"" + slot + "-lbl\">" + name + "</span>"
    + "<span class=\"cs-arrow\"></span>"
    + "</button></div></div>";
}

export function viewRow(slot, state, config) {
  var name = (state && state[slot] !== undefined) ? state[slot] : (config.defaults[slot] || "");
  var num = rosterNum(name, config.roster);
  if (!name) return "<div class=\"player-row\" style=\"min-height:64px\"></div>";
  var dot = "";
  if (config.availability && config.availability.length) {
    var av = config.availability.find(function(x){return x.name===name;});
    if (av) {
      var dc = av.status==="yes"?"#27ae60":av.status==="no"?"#c62828":av.status==="maybe"?"#e65100":"";
      if (dc) dot = "<span style=\"display:inline-block;width:6px;height:6px;border-radius:50%;background:"+dc+";margin-left:6px;flex-shrink:0\"></span>";
    }
  }
  return "<div class=\"player-row\" style=\"align-items:center\"><span class=\"player-number\">" + num + "</span>"
    + "<span style=\"font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#1a1a1a\">" + name + "</span>" + dot + "</div>";
}

function readableColor(hex) {
  if (!hex || hex.length < 7) return "#1a1a1a";
  var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (0.299*r + 0.587*g + 0.114*b) > 180 ? "#1a1a1a" : hex;
}

export function header(state, mode, config) {
  var s = state || {};
  var opponent = s.opponent || "";
  var gamedate = s.gamedate || "";
  var gametime = s.gametime || "17:30";
  var rink = s.rink || "North";
  var jersey = s.jersey || "home";
  var homeaway = s.homeaway || "";
  var jerseys = config.jerseys || defaultJerseys();
  var jerseyObj = jerseys.find(function(j){return j.id===jersey;}) || jerseys[0] || {label:jersey,color:"#1a1a1a"};
  var jerseyLabel = jerseyObj.label;
  var jerseyColor = jerseyObj.color;
  var jerseyTextColor = readableColor(jerseyColor);

  if (mode === "view") {
    return "<div class=\"header\">"
      + "<img class=\"main-logo\" src=\"" + logoSrc(config.logoMain) + "\" alt=\"" + config.logoMainAlt + "\">"
      + "<div class=\"header-text\"><div class=\"team-title\">" + config.name + "</div>"
      + "<div class=\"game-info\">"
      + "<div class=\"game-line\"><span>vs.</span><span>" + opponent + "</span></div>"
      + "<div class=\"game-line\"><span>" + formatDate(gamedate) + "</span><span>&nbsp;&middot;&nbsp;</span><span>" + formatTime(gametime) + "</span><span>&nbsp;@&nbsp;</span><span>" + rink + "</span></div>"
      + "<div class=\"game-line\">"
      + "<span>Jersey:</span><span style=\"color:" + jerseyTextColor + "\">" + jerseyLabel + "</span>"
      + (homeaway ? "<span>(" + homeaway.toUpperCase() + ")</span>" : "")
      + "</div>"
      + "</div></div></div>";
  } else {
    return "<div class=\"header\">"
      + "<img class=\"main-logo\" src=\"" + logoSrc(config.logoMain) + "\" alt=\"" + config.logoMainAlt + "\">"
      + "<div class=\"header-text\"><div class=\"team-title\">" + config.name + "</div>"
      + "<div class=\"game-info\">"
      + "<div class=\"game-line\"><span>vs.</span>"
      + "<select class=\"vs-input\" id=\"opponent\" onchange=\"scheduleAutoSave()\">"
      + makeOptions(config.opponents, opponent) + "</select></div>"
      + "<div class=\"game-line\">"
      + "<input type=\"date\" id=\"gamedate\" value=\"" + gamedate + "\" oninput=\"scheduleAutoSave()\" />"
      + "<input class=\"time-input\" type=\"time\" id=\"gametime\" value=\"" + gametime + "\" step=\"600\" oninput=\"snapTime(this);scheduleAutoSave()\" />"
      + "<span class=\"at-rink\"><span>@</span><select class=\"rink-select\" id=\"rink\" onchange=\"sizeRinkSelect(this);scheduleAutoSave()\">" + makeOptions(config.rinks, rink) + "</select></span>"
      + "</div>"
      + "<div class=\"game-line\">"
      + "<span>Jersey:</span>"
      + "<select id=\"jersey-color\" onchange=\"updateJerseyColor();scheduleAutoSave()\" style=\"color:" + jerseyTextColor + "\">" + jerseyOpts(jersey, jerseys) + "</select>"
      + "<select id=\"home-away\" onchange=\"scheduleAutoSave()\">"
      + "<option value=\"\"" + (!homeaway ? " selected" : "") + ">H/A</option>"
      + "<option value=\"home\"" + (homeaway === "home" ? " selected" : "") + ">Home</option>"
      + "<option value=\"away\"" + (homeaway === "away" ? " selected" : "") + ">Away</option>"
      + "</select>"
      + "</div></div></div></div>";
  }
}

export function grid(state, mode, config) {
  var fn = mode === "view" ? viewRow : selectRow;
  var fwd = config.fwdLines || 3;
  var def = config.defLines || (config.threeDefLines ? 3 : 2);
  function rows(prefix) {
    var r = "";
    for (var i = 1; i <= (prefix === "ld" || prefix === "rd" ? def : fwd); i++) r += fn(prefix + i, state, config);
    return r;
  }
  return "<div class=\"grid\">"
    + "<div class=\"section\" data-prefix=\"lw\"><div class=\"section-header\"><span>Left Wing</span></div>" + rows("lw") + "</div>"
    + "<div class=\"section\" data-prefix=\"c\"><div class=\"section-header\"><span>Center</span></div>" + rows("c") + "</div>"
    + "<div class=\"section\" data-prefix=\"rw\"><div class=\"section-header\"><span>Right Wing</span></div>" + rows("rw") + "</div>"
    + "</div>"
    + "<div class=\"grid grid-bottom\">"
    + "<div class=\"section\" data-prefix=\"ld\"><div class=\"section-header\"><span>Left Defense</span></div>" + rows("ld") + "</div>"
    + "<div class=\"section\" data-prefix=\"rd\"><div class=\"section-header\"><span>Right Defense</span></div>" + rows("rd") + "</div>"
    + "<div class=\"section\" data-prefix=\"g\"><div class=\"section-header\"><span>Goaltender</span></div>" + fn("g1",state,config) + "</div>"
    + "</div>";
}

export function footer(config, editMode, useTeamLogo) {
  var centerText = config.division
    ? "<span style=\"font-size:10px;color:#bbb;text-transform:uppercase;letter-spacing:1.5px;white-space:nowrap\">" + config.name + " &bull; " + config.division + "</span>"
    : "<span style=\"font-size:10px;color:#bbb;text-transform:uppercase;letter-spacing:1.5px\">" + config.name + "</span>";
  var rightLogo = (useTeamLogo && config.logoMain)
    ? "<img class=\"footer-logo\" src=\"" + logoSrc(config.logoMain) + "\" alt=\"" + (config.logoMainAlt || "") + "\">"
    : "<img class=\"footer-logo\" src=\"data:image/png;base64," + config._cahlSrc + "\" alt=\"CAHL\">";
  return "<div class=\"footer\">"
    + "<img class=\"footer-logo\" src=\"/linemate-alt-logo.png\" alt=\"Linemate\">"
    + centerText
    + rightLogo
    + "</div>";
}

export function formatTime(t) {
  if (!t) return t;
  var parts = t.split(":");
  if (parts.length < 2) return t;
  var h = parseInt(parts[0], 10);
  var m = parts[1];
  var ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return h + ":" + m + " " + ampm;
}

export function formatDate(d) {
  if (!d) return d;
  var parts = d.split("-");
  if (parts.length < 3) return d;
  return parts[1] + "/" + parts[2] + "/" + parts[0];
}

export function navFab(config, teamId, session, myTeams, activePage) {
  function tip(text) {
    return "<span class=\"fab-item-tip\"><span class=\"fab-tip-icon\">&#9432;</span><span class=\"fab-tip-text\">" + text + "</span></span>";
  }

  var syncLabel = "";
  if (config.chillerTeamId) {
    if (config.syncedAt) {
      var mins = Math.floor((Date.now() - config.syncedAt) / 60000);
      var syncAgo = mins < 1 ? "just now" : mins < 60 ? mins + "m ago" : Math.floor(mins / 60) + "h ago";
      var isStale = mins > 120;
      syncLabel = "<div class=\"fab-sync-row" + (isStale ? " stale" : "") + "\">"
        + "<span class=\"fab-sync-dot\"></span>"
        + "<span class=\"fab-sync-label\">" + (isStale ? "Synced " + syncAgo : "Synced " + syncAgo) + "</span>"
        + (isStale ? "<button class=\"fab-sync-btn\" onclick=\"syncRoster()\">Sync now</button>" : "")
        + "</div>";
    } else {
      syncLabel = "<div class=\"fab-sync-row stale\">"
        + "<span class=\"fab-sync-dot\"></span>"
        + "<span class=\"fab-sync-label\">Never synced</span>"
        + "<button class=\"fab-sync-btn\" onclick=\"syncRoster()\">Sync now</button>"
        + "</div>";
    }
  }

  var html = "<div class=\"fab\"><button class=\"fab-btn\" onclick=\"toggleFab()\">&#9776;</button>"
    + "<div class=\"fab-menu\" id=\"fab-menu\">"
    + "<div class=\"fab-close\"><span class=\"fab-close-title\">Menu</span><button class=\"fab-close-btn\" onclick=\"toggleFab()\">&#215;</button></div>"
    + syncLabel;
  if (myTeams && myTeams.length > 1) {
    html += "<div class=\"fab-section-label\">My Teams</div>"
      + myTeams.map(function(t) { return "<a class=\"fab-item" + (t.slug === teamId ? " active" : "") + "\" href=\"/" + t.slug + "/\">" + t.name + tip("Switch to the " + t.name + " lineup card") + "</a>"; }).join("")
      + "<div class=\"fab-divider\"></div>";
  }
  html += "<div class=\"fab-section-label\">Roster &amp; History</div>"
    + "<a class=\"fab-item\" href=\"/" + teamId + "/\">Lineup Card" + tip("Build and edit your current game lineup") + "</a>"
    + "<a class=\"fab-item" + (activePage === "history" ? " active" : "") + "\" href=\"/" + teamId + "/history\">Lineup History" + tip("View past lineups you've marked as Set") + "</a>"
    + "<a class=\"fab-item" + (activePage === "roster" ? " active" : "") + "\" href=\"/" + teamId + "/roster\">Manage Roster" + tip("Add, remove, or update your team's players") + "</a>"
    + "<a class=\"fab-item" + (activePage === "schedule" ? " active" : "") + "\" href=\"/" + teamId + "/schedule\">Season Schedule" + tip("View full season schedule, results, and record") + "</a>"
    + (config.playerStats && config.playerStats.length ? "<a class=\"fab-item" + (activePage === "stats" ? " active" : "") + "\" href=\"/" + teamId + "/stats\">Player Stats" + tip("View season stats leaderboard") + "</a>" : "")
    + "<div class=\"fab-divider\"></div>"
    + "<div class=\"fab-section-label\">Account</div>"
    + "<a class=\"fab-item" + (activePage === "brand" ? " active" : "") + "\" href=\"/" + teamId + "/brand\">Team Settings" + tip("Update team colors, logo, and lineup options") + "</a>"
    + "<a class=\"fab-item\" href=\"/signup\">Add a Team" + tip("Create a new team on Linemate") + "</a>"
    + (myTeams && myTeams.length > 1 ? "<a class=\"fab-item\" href=\"/teams\">My Teams" + tip("See all teams you have access to") + "</a>" : "")
    + (session && session.role === "superadmin" ? "<a class=\"fab-item\" href=\"/admin\">Admin</a>" : "")
    + "<div class=\"fab-divider\"></div>"
    + "<button class=\"fab-item danger\" onclick=\"logout()\">Log Out" + tip("Sign out of your account") + "</button>"
    + "</div></div>";
  return html;
}

export function navFabJS() {
  return "<script>function toggleFab(){var m=document.getElementById('fab-menu');m.classList.toggle('open');document.body.style.overflow=m.classList.contains('open')&&window.innerWidth<=599?'hidden':'';}document.addEventListener('click',function(e){var fab=document.querySelector('.fab');if(fab&&!fab.contains(e.target)){document.getElementById('fab-menu').classList.remove('open');document.body.style.overflow='';}});function logout(){fetch('/logout',{method:'POST'}).then(function(){window.location.href='/login';});}<\/script>";
}
