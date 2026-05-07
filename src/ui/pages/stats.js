import { fontFaceCSS, fabCSS } from '../css.js';
import { navFab, navFabJS, footer, formatDate, formatTime } from '../components.js';

export function statsPage(config, teamId, session, myTeams) {
  var c = (config && config.primaryColor) || "#c0392b";
  var playerStats = (config.playerStats || []).slice().sort(function(a, b) { return b.pts - a.pts || b.g - a.g; });

  function statRow(p, rank) {
    var isHot = p.gp > 0 && p.pts / p.gp >= 1;
    var ppg = p.gp > 0 ? (p.pts / p.gp).toFixed(2) : "—";
    return "<tr>"
      + "<td class=\"rank-col\">" + rank + "</td>"
      + "<td class=\"name-col\">" + (p.num ? "<span class=\"jersey-num\">" + p.num + "</span>" : "") + p.name + (isHot ? " <span title=\"1+ point per game\" style=\"font-size:13px\">&#x1F525;</span>" : "") + "</td>"
      + "<td>" + p.gp + "</td>"
      + "<td>" + p.g + "</td>"
      + "<td>" + p.a + "</td>"
      + "<td class=\"pts-col\">" + p.pts + "</td>"
      + "<td class=\"hide-mobile\">" + ppg + "</td>"
      + "<td class=\"hide-mobile\">" + p.pim + "</td>"
      + "</tr>";
  }

  var statsRows = playerStats.length
    ? playerStats.map(function(p, i) { return statRow(p, i + 1); }).join("")
    : "<tr><td colspan=\"8\" class=\"empty-cell\">No stats yet. Sync from ChillerStats to load.</td></tr>";

  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>" + config.name + " \u2014 Stats</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;min-height:100vh}"
    + ".topbar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;max-width:860px;margin:0 auto}"
    + ".back{font-size:12px;color:" + c + ";text-decoration:none;text-transform:uppercase;letter-spacing:1px}"
    + ".wrap{max-width:860px;margin:0 auto;padding:0 16px 40px}"
    + "h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;margin-bottom:2px}"
    + ".sub{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px}"
    + ".section-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#aaa;margin:20px 0 8px}"
    + ".table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}"
    + "table{width:100%;background:white;border-radius:6px;box-shadow:0 1px 8px rgba(0,0,0,.07);border-collapse:collapse;overflow:hidden}"
    + "thead{background:" + c + ";color:white}"
    + "th{padding:10px 8px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:normal}"
    + "th.name-col{text-align:left}"
    + "tbody tr{border-bottom:1px solid #f5f2ec}"
    + "tbody tr:last-child{border-bottom:none}"
    + "tbody tr:hover{background:#faf8f5}"
    + "td{padding:10px 8px;text-align:center;font-size:13px;color:#1a1a1a}"
    + "td.name-col{text-align:left;font-size:13px;text-transform:uppercase;letter-spacing:.4px}"
    + "td.rank-col{font-size:11px;color:#bbb;width:28px}"
    + "td.pts-col{font-weight:700;color:" + c + "}"
    + ".jersey-num{display:inline-block;font-size:11px;color:#aaa;min-width:22px;margin-right:4px}"
    + ".empty-cell{text-align:center;padding:28px;color:#aaa;font-size:12px;text-transform:uppercase;letter-spacing:1px}"
    + ".footer{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:24px;padding-top:12px;border-top:1px solid #e8e5e0}"
    + ".footer-logo{height:36px;object-fit:contain;opacity:.7}"
    + "@media(max-width:599px){.hide-mobile{display:none}}"
    + fabCSS(config)
    + "</style></head><body>"
    + "<div class=\"topbar\"><a href=\"/" + teamId + "/\" class=\"back\">\u2190 Lineup</a>" + navFab(config, teamId, session, myTeams, "stats") + "</div>"
    + "<div class=\"wrap\">"
    + "<h1>" + config.name + "</h1>"
    + "<p class=\"sub\">Player Stats</p>"
    + "<div class=\"section-label\">Season Stats</div>"
    + "<div class=\"table-wrap\"><table>"
    + "<thead><tr><th class=\"rank-col\">#</th><th class=\"name-col\">Player</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th class=\"hide-mobile\">P/GP</th><th class=\"hide-mobile\">PIM</th></tr></thead>"
    + "<tbody>" + statsRows + "</tbody>"
    + "</table></div>"
    + footer(config, false, true)
    + "</div>"
    + navFabJS()
    + "</body></html>";
}
