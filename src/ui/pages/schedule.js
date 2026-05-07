import { fontFaceCSS, fabCSS } from '../css.js';
import { navFab, navFabJS, footer, formatDate, formatTime } from '../components.js';

export function schedulePage(config, teamId, session, myTeams) {
  var c = (config && config.primaryColor) || "#c0392b";
  var schedule = config.schedule || [];
  var standings = config.standings || [];

  var past = schedule.filter(function(g) { return g.isPast; });
  var upcoming = schedule.filter(function(g) { return !g.isPast; });

  var wins = past.filter(function(g) { return g.result === "W"; }).length;
  var losses = past.filter(function(g) { return g.result === "L"; }).length;
  var otl = past.filter(function(g) { return g.result === "OTL"; }).length;
  var ties = past.filter(function(g) { return g.result === "T"; }).length;
  var recordStr = wins + "-" + losses + (otl ? "-" + otl : "") + (ties ? "-" + ties + "T" : "");

  function resultBadge(result) {
    if (!result) return "";
    var bg = result === "W" ? "#e8f5e9" : result === "L" ? "#fce4ec" : result === "OTL" ? "#fff3e0" : "#f5f5f5";
    var col = result === "W" ? "#2e7d32" : result === "L" ? "#c62828" : result === "OTL" ? "#e65100" : "#666";
    return "<span class=\"result-badge\" style=\"background:" + bg + ";color:" + col + "\">" + result + "</span>";
  }

  function gameRow(g, isUpcoming) {
    var ha = g.isHome === true ? "H" : g.isHome === false ? "A" : "";
    var dateStr = formatDate(g.date);
    if (isUpcoming) {
      return "<div class=\"game-row upcoming\">"
        + "<span class=\"game-date\">" + dateStr + "</span>"
        + "<span class=\"game-ha " + (ha === "H" ? "home" : "away") + "\">" + ha + "</span>"
        + "<span class=\"game-opp\">vs. " + g.opponent + "</span>"
        + "<span class=\"game-meta\">" + formatTime(g.time) + " &middot; " + g.rink + "</span>"
        + "</div>";
    }
    var scoreLink = g.scoresheetUrl
      ? "<a href=\"" + g.scoresheetUrl + "\" target=\"_blank\" class=\"score-link\">" + g.score + "</a>"
      : "<span class=\"game-score\">" + g.score + "</span>";
    return "<div class=\"game-row\">"
      + "<span class=\"game-date\">" + dateStr + "</span>"
      + "<span class=\"game-ha " + (ha === "H" ? "home" : "away") + "\">" + ha + "</span>"
      + "<span class=\"game-opp\">vs. " + g.opponent + "</span>"
      + "<span class=\"game-score-wrap\">" + scoreLink + "</span>"
      + resultBadge(g.result)
      + "</div>";
  }

  function standingsTable() {
    if (!standings.length) return "";
    var ourName = (config.name || "").toUpperCase();
    var rows = standings.map(function(s) {
      var isOurs = s.name.toUpperCase() === ourName;
      var diff = s.gf - s.ga;
      var diffStr = diff > 0 ? "+" + diff : String(diff);
      return "<tr" + (isOurs ? " class=\"our-team\"" : "") + ">"
        + "<td class=\"name-col\">" + s.name + "</td>"
        + "<td>" + s.gp + "</td>"
        + "<td>" + s.w + "</td>"
        + "<td>" + s.l + "</td>"
        + (standings.some(function(x){return x.otl>0;}) ? "<td>" + s.otl + "</td>" : "")
        + (standings.some(function(x){return x.t>0;}) ? "<td>" + s.t + "</td>" : "")
        + "<td><strong>" + s.pts + "</strong></td>"
        + "<td>" + diffStr + "</td>"
        + "</tr>";
    });
    var hasOtl = standings.some(function(x){return x.otl>0;});
    var hasT = standings.some(function(x){return x.t>0;});
    return "<div class=\"section-label\">Standings</div>"
      + "<div class=\"standings-wrap\"><table class=\"standings-table\"><thead><tr>"
      + "<th class=\"name-col\">Team</th><th>GP</th><th>W</th><th>L</th>"
      + (hasOtl ? "<th>OTL</th>" : "")
      + (hasT ? "<th>T</th>" : "")
      + "<th>PTS</th><th>+/-</th>"
      + "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
  }

  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>" + config.name + " \u2014 Schedule</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;min-height:100vh}"
    + ".topbar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;max-width:860px;margin:0 auto}"
    + ".back{font-size:12px;color:" + c + ";text-decoration:none;text-transform:uppercase;letter-spacing:1px}"
    + ".wrap{max-width:860px;margin:0 auto;padding:0 16px 40px}"
    + "h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;margin-bottom:2px}"
    + ".sub{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}"
    + ".record{font-size:28px;font-weight:700;color:#1a1a1a;letter-spacing:2px;margin:16px 0 4px}"
    + ".record-sub{font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:24px}"
    + ".section-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#aaa;margin:20px 0 8px}"
    + ".game-row{display:flex;align-items:center;gap:10px;background:white;border-radius:4px;padding:11px 14px;margin-bottom:5px;box-shadow:0 1px 4px rgba(0,0,0,.05)}"
    + ".game-row.upcoming{border-left:3px solid " + c + "}"
    + ".game-date{font-size:12px;color:#888;white-space:nowrap;min-width:62px}"
    + ".game-ha{font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;letter-spacing:.5px;flex-shrink:0}"
    + ".game-ha.home{background:#e8f5e9;color:#2e7d32}"
    + ".game-ha.away{background:#f5f5f5;color:#888}"
    + ".game-opp{flex:1;font-size:13px;color:#1a1a1a;text-transform:uppercase;letter-spacing:.5px}"
    + ".game-meta{font-size:11px;color:#aaa;white-space:nowrap}"
    + ".game-score-wrap{font-size:13px;color:#1a1a1a;white-space:nowrap;min-width:50px;text-align:right}"
    + ".game-score{font-size:13px;color:#1a1a1a}"
    + ".score-link{font-size:13px;color:" + c + ";text-decoration:none;border-bottom:1px solid currentColor}"
    + ".score-link:hover{opacity:.75}"
    + ".result-badge{font-size:11px;font-weight:700;padding:3px 8px;border-radius:3px;letter-spacing:.5px;flex-shrink:0;min-width:36px;text-align:center}"
    + ".standings-wrap{overflow-x:auto;margin-bottom:8px}"
    + ".standings-table{width:100%;border-collapse:collapse;font-size:12px}"
    + ".standings-table th{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#aaa;font-weight:600;padding:6px 8px;text-align:center;border-bottom:1px solid #e8e5e0;white-space:nowrap}"
    + ".standings-table th.name-col{text-align:left}"
    + ".standings-table td{padding:7px 8px;text-align:center;color:#1a1a1a;border-bottom:1px solid #f0ede8}"
    + ".standings-table td.name-col{text-align:left;font-size:13px;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}"
    + ".standings-table tr.our-team td{font-weight:700;background:#fafafa}"
    + ".standings-table tr.our-team td.name-col{color:" + c + "}"
    + ".empty{text-align:center;padding:32px 0;color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px}"
    + ".sync-btn{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#888;background:none;border:1px solid #ddd;border-radius:4px;padding:5px 12px;cursor:pointer;margin-top:12px;margin-bottom:4px}"
    + ".sync-btn:hover{background:#f0ede8}"
    + ".footer{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:24px;padding-top:12px;border-top:1px solid #e8e5e0}"
    + ".footer-logo{height:36px;object-fit:contain;opacity:.7}"
    + fabCSS(config)
    + "</style></head><body>"
    + "<div class=\"topbar\"><a href=\"/" + teamId + "/\" class=\"back\">\u2190 Lineup</a>" + navFab(config, teamId, session, myTeams, "schedule") + "</div>"
    + "<div class=\"wrap\">"
    + "<h1>" + config.name + "</h1>"
    + "<p class=\"sub\">" + (config.division || "Season Schedule") + "</p>"
    + (past.length ? "<div class=\"record\">" + recordStr + "</div><div class=\"record-sub\">W\u2013L" + (otl ? "\u2013OTL" : "") + (ties ? "\u2013T" : "") + " &nbsp;&middot;&nbsp; " + past.length + " games played</div>" : "")
    + (config.chillerTeamId ? "<button class=\"sync-btn\" onclick=\"syncNow()\">&#8635; Sync from ChillerStats</button>" : "")
    + standingsTable()
    + (past.length ? "<div class=\"section-label\">Results</div>" + past.slice().reverse().map(function(g) { return gameRow(g, false); }).join("") : "")
    + (upcoming.length ? "<div class=\"section-label\">Upcoming</div>" + upcoming.map(function(g) { return gameRow(g, true); }).join("") : (past.length ? "<div class=\"empty\">No upcoming games scheduled</div>" : ""))
    + (!schedule.length ? "<div class=\"empty\">No schedule data. Try syncing from ChillerStats.</div>" : "")
    + footer(config, false, true)
    + "</div>"
    + navFabJS()
    + "<script>function syncNow(){var btn=document.querySelector('.sync-btn');if(btn){btn.disabled=true;btn.textContent='Syncing\u2026';}fetch('/" + teamId + "/sync',{method:'POST'}).then(function(r){if(r.ok){location.reload();}else{r.text().then(function(t){alert('Sync failed: '+t);if(btn){btn.disabled=false;btn.innerHTML='&#8635; Sync from ChillerStats';}});}}).catch(function(){alert('Sync failed.');if(btn){btn.disabled=false;btn.innerHTML='&#8635; Sync from ChillerStats';}});}<\/script>"
    + "</body></html>";
}
