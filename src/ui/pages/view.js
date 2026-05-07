import { sharedCSS } from '../css.js';
import { header, grid, footer } from '../components.js';

export function viewPage(state, config) {
  var s = state || {};
  var isSet = s.isSet || false;
  var teamId = config._teamId || "";
  var badge = isSet
    ? "<div style=\"background:#27ae60;color:white;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1px;padding:6px 14px;border-radius:2px\">&#10003; Lineup Set</div>"
    : "<div style=\"background:#e67e22;color:white;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1px;padding:6px 14px;border-radius:2px\">&#8987; Pending</div>";
  var c = (config && config.primaryColor) || "#c0392b";

  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>" + config.name + " \u2014 Lineup</title>"
    + "<style>" + sharedCSS(config)
    + ".view-topbar{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;max-width:860px;margin:0 auto}"
    + ".view-team-name{font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#888}"
    + ".view-edit-link{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:" + c + ";text-decoration:none}"
    + ".view-edit-link:hover{opacity:.75}"
    + "</style>"
    + "</head><body>"
    + "<div class=\"view-topbar\">"
    + "<span class=\"view-team-name\">" + config.name + "</span>"
    + "<div style=\"display:flex;align-items:center;gap:16px\">"
    + badge
    + (teamId ? "<a href=\"/" + teamId + "/\" class=\"view-edit-link\">Edit \u2192</a>" : "")
    + "</div>"
    + "</div>"
    + "<div class=\"card\">" + header(s,"view",config) + grid(s,"view",config)
    + (s.notes ? "<div class=\"game-notes-wrap\"><div class=\"game-notes-label\">Game Notes</div><div class=\"game-notes-body\">" + s.notes.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") + "</div></div>" : "")
    + footer(config) + "</div>"
    + "</body></html>";
}
