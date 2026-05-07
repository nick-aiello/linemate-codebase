import { sharedCSS, fabCSS } from '../css.js';
import { navFab, navFabJS, formatDate, footer } from '../components.js';

export function historyPage(entries, config, teamId, session, myTeams) {
  var c = config.primaryColor || "#c0392b";
  var hasEntries = entries.length > 0;

  // Build schedule lookup keyed by "date|OPPONENT" for server-side score/result rendering
  var schedMap = {};
  (config.schedule || []).forEach(function(s) {
    if (s.isPast && s.opponent && s.date) {
      schedMap[s.date + "|" + s.opponent.toUpperCase()] = s;
    }
  });

  function resultBadge(result) {
    if (!result) return "";
    var bg = result === "W" ? "#e8f5e9" : result === "L" ? "#fce4ec" : result === "OTL" ? "#fff3e0" : "#f5f5f5";
    var col = result === "W" ? "#2e7d32" : result === "L" ? "#c62828" : result === "OTL" ? "#e65100" : "#666";
    return "<span class=\"result-badge\" style=\"background:" + bg + ";color:" + col + "\">" + result + "</span>";
  }

  var rows = !hasEntries
    ? "<p style=\"color:#888;font-size:13px;text-transform:uppercase;letter-spacing:1px;text-align:center;padding:32px 0\">No lineups saved yet. Mark a lineup as Set to save it here.</p>"
    : entries.map(function(entry) {
        var m = entry.metadata || {};
        var ts = entry.name.split(":").pop();
        var dateStr = m.gamedate ? formatDate(m.gamedate) : "";
        var opp = m.opponent ? "vs. " + m.opponent : "Unknown opponent";
        var ha = m.homeaway ? " \u00b7 " + m.homeaway.charAt(0).toUpperCase() + m.homeaway.slice(1) : "";
        var schedEntry = m.gamedate && m.opponent ? schedMap[m.gamedate + "|" + (m.opponent || "").toUpperCase()] : null;
        var scoreHtml = schedEntry ? "<span class=\"history-score\">" + (schedEntry.score || "") + "</span>" + resultBadge(schedEntry.result) : "";
        var hasChiller = !!(config.chillerTeamId && schedEntry && schedEntry.scoresheetUrl);
        return "<div class=\"history-item\" id=\"entry-" + ts + "\" data-ts=\"" + ts + "\""
          + (hasChiller ? " data-recap=\"1\"" : "") + ">"
          + "<label class=\"history-check\"><input type=\"checkbox\" class=\"entry-cb\" value=\"" + ts + "\" onchange=\"updateBulkBar()\"></label>"
          + "<button class=\"history-row\" type=\"button\" onclick=\"previewEntry('" + ts + "')\" aria-label=\"Preview lineup\">"
          + "<div class=\"history-meta\">"
          + (dateStr ? "<span class=\"history-date\">" + dateStr + "</span>" : "")
          + "<span class=\"history-ha\">" + ha + "</span>"
          + scoreHtml
          + "</div>"
          + "<div class=\"history-opp\">" + opp + "</div>"
          + (hasChiller ? "<div class=\"history-goals\" id=\"goals-" + ts + "\"></div>" : "")
          + "</button>"
          + "<button class=\"delete-btn\" onclick=\"deleteEntry('" + ts + "')\" title=\"Delete\">&#128465;</button>"
          + "</div>";
      }).join("");

  var bulkBar = !hasEntries ? "" :
    "<div class=\"bulk-bar\" id=\"bulk-bar\">"
    + "<label class=\"bulk-select-all\"><input type=\"checkbox\" id=\"select-all\" onchange=\"toggleAll(this)\"> Select All</label>"
    + "<button class=\"bulk-delete-btn\" id=\"bulk-delete-btn\" onclick=\"bulkDelete()\" disabled>Delete Selected</button>"
    + "</div>";

  var modal =
    "<div class=\"modal-overlay\" id=\"modal\" onclick=\"closeModal(event)\">"
    + "<div class=\"modal-box\">"
    + "<div class=\"modal-header\">"
    + "<span class=\"modal-title\" id=\"modal-title\"></span>"
    + "<div class=\"modal-actions\">"
    + "<button class=\"modal-apply-btn\" id=\"modal-apply-btn\" onclick=\"applyLineup()\">Apply to Current Lineup</button>"
    + "<button class=\"modal-close-btn\" onclick=\"closeModal()\">&#215;</button>"
    + "</div>"
    + "</div>"
    + "<div class=\"modal-body\"><iframe id=\"modal-iframe\" src=\"\" frameborder=\"0\"></iframe></div>"
    + "</div>"
    + "</div>";

  var script = "<script>"
    + "var currentTs=null;"
    + "function previewEntry(ts){"
    +   "currentTs=ts;"
    +   "var entry=document.getElementById('entry-'+ts);"
    +   "var opp=entry.querySelector('.history-opp').textContent;"
    +   "var date=entry.querySelector('.history-date');"
    +   "document.getElementById('modal-title').textContent=(date?date.textContent+' \u00b7 ':'')+opp;"
    +   "document.getElementById('modal-iframe').src='/" + teamId + "/history/'+ts;"
    +   "document.getElementById('modal').classList.add('open');"
    +   "document.body.style.overflow='hidden';"
    + "}"
    + "function closeModal(e){"
    +   "if(e&&e.target!==document.getElementById('modal'))return;"
    +   "document.getElementById('modal').classList.remove('open');"
    +   "document.getElementById('modal-iframe').src='';"
    +   "document.body.style.overflow='';"
    +   "currentTs=null;"
    + "}"
    + "function applyLineup(){"
    +   "if(!currentTs)return;"
    +   "if(!confirm('Apply this lineup to the current lineup card? This will overwrite your current lineup.'))return;"
    +   "fetch('/" + teamId + "/history/'+currentTs+'/apply',{method:'POST'})"
    +   ".then(function(r){if(r.ok){window.location.href='/" + teamId + "/';}else{alert('Failed to apply lineup.');}});"
    + "}"
    + "function deleteEntry(ts){"
    +   "if(!confirm('Delete this lineup?'))return;"
    +   "fetch('/" + teamId + "/history/'+ts+'/delete',{method:'POST'}).then(function(r){"
    +     "if(r.ok){document.getElementById('entry-'+ts).remove();updateBulkBar();}"
    +   "});"
    + "}"
    + "function updateBulkBar(){"
    +   "var cbs=document.querySelectorAll('.entry-cb');"
    +   "var checked=document.querySelectorAll('.entry-cb:checked');"
    +   "var btn=document.getElementById('bulk-delete-btn');"
    +   "var all=document.getElementById('select-all');"
    +   "btn.disabled=checked.length===0;"
    +   "btn.textContent=checked.length>0?'Delete Selected ('+checked.length+')':'Delete Selected';"
    +   "all.indeterminate=checked.length>0&&checked.length<cbs.length;"
    +   "all.checked=cbs.length>0&&checked.length===cbs.length;"
    + "}"
    + "function toggleAll(cb){"
    +   "document.querySelectorAll('.entry-cb').forEach(function(c){c.checked=cb.checked;});"
    +   "updateBulkBar();"
    + "}"
    + "function bulkDelete(){"
    +   "var checked=Array.from(document.querySelectorAll('.entry-cb:checked')).map(function(c){return c.value;});"
    +   "if(!checked.length)return;"
    +   "if(!confirm('Delete '+checked.length+' lineup(s)?'))return;"
    +   "Promise.all(checked.map(function(ts){"
    +     "return fetch('/" + teamId + "/history/'+ts+'/delete',{method:'POST'});"
    +   "})).then(function(){"
    +     "checked.forEach(function(ts){var el=document.getElementById('entry-'+ts);if(el)el.remove();});"
    +     "updateBulkBar();"
    +   "});"
    + "}"
    // Lazy-load goal scorers for entries that have scoresheet data
    + "document.addEventListener('DOMContentLoaded',function(){"
    +   "var items=document.querySelectorAll('.history-item[data-recap]');"
    +   "items.forEach(function(item){"
    +     "var ts=item.getAttribute('data-ts');"
    +     "fetch('/" + teamId + "/history/'+ts+'/recap')"
    +     ".then(function(r){return r.ok?r.json():null;})"
    +     ".then(function(data){"
    +       "if(!data||!data.goals)return;"
    +       "var ourGoals=data.goals.filter(function(g){return g.isOurGoal;});"
    +       "if(!ourGoals.length)return;"
    +       "var scorers={};"
    +       "ourGoals.forEach(function(g){"
    +         "var last=g.scorer.split(/\\s+/).pop();"
    +         "scorers[last]=(scorers[last]||0)+1;"
    +       "});"
    +       "var parts=Object.keys(scorers).map(function(n){return scorers[n]>1?n+' ('+scorers[n]+')':n;});"
    +       "var el=document.getElementById('goals-'+ts);"
    +       "if(el)el.textContent=parts.join(', ');"
    +     "})"
    +     ".catch(function(){});"
    +   "});"
    + "});"
    + "<\/script>";

  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>" + config.name + " \u2014 History</title>"
    + "<style>" + sharedCSS(config)
    + "body{padding:0;min-height:100vh}"
    + ".topbar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;max-width:860px;margin:0 auto}"
    + ".back{font-size:12px;color:" + c + ";text-decoration:none;text-transform:uppercase;letter-spacing:1px}"
    + ".wrap{max-width:860px;margin:0 auto;padding:0 16px 40px}"
    + "h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;margin-bottom:2px}"
    + ".page-sub{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px}"
    // Bulk bar
    + ".bulk-bar{display:flex;align-items:center;gap:16px;margin-bottom:14px;padding:10px 14px;background:white;border-radius:6px;box-shadow:0 1px 6px rgba(0,0,0,.07)}"
    + ".bulk-select-all{display:flex;align-items:center;gap:6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#555;cursor:pointer;user-select:none}"
    + ".bulk-select-all input{cursor:pointer;width:14px;height:14px;accent-color:" + c + "}"
    + ".bulk-delete-btn{margin-left:auto;padding:5px 14px;background:#e74c3c;color:white;border:none;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;cursor:pointer}"
    + ".bulk-delete-btn:disabled{background:#ddd;color:#aaa;cursor:default}"
    // History items
    + ".history-item{display:flex;align-items:stretch;margin-bottom:8px;gap:0}"
    + ".history-check{display:flex;align-items:center;padding:0 10px 0 4px;cursor:pointer}"
    + ".history-check input{cursor:pointer;width:14px;height:14px;accent-color:" + c + "}"
    + ".history-row{flex:1;display:block;background:white;border-radius:4px 0 0 4px;padding:12px 18px;text-decoration:none;color:#1a1a1a;border-left:3px solid " + c + ";text-align:left;cursor:pointer;border-top:none;border-right:none;border-bottom:none;font-family:'NHLChicago',Arial,sans-serif}"
    + ".history-row:hover{background:#f5f2ec}"
    + ".history-meta{display:flex;gap:8px;align-items:center;margin-bottom:4px;flex-wrap:wrap}"
    + ".history-date{font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px}"
    + ".history-ha{font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px}"
    + ".history-score{font-size:12px;color:#555;letter-spacing:.5px;margin-left:auto}"
    + ".result-badge{font-size:10px;font-weight:700;padding:2px 7px;border-radius:3px;letter-spacing:.5px;flex-shrink:0}"
    + ".history-opp{font-size:15px;text-transform:uppercase;letter-spacing:1px}"
    + ".history-goals{font-size:11px;color:#888;margin-top:4px;letter-spacing:.3px}"
    + ".delete-btn{background:#f5f2ec;border:none;border-radius:0 4px 4px 0;padding:0 14px;cursor:pointer;color:#ccc;font-size:16px;flex-shrink:0}"
    + ".delete-btn:hover{background:#fdecea;color:#c0392b}"
    // Modal
    + ".modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;align-items:center;justify-content:center;padding:16px}"
    + ".modal-overlay.open{display:flex}"
    + ".modal-box{background:#f5f2ec;border-radius:8px;width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.3);overflow:hidden}"
    + ".modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:white;border-bottom:1px solid #eee;gap:12px;flex-shrink:0}"
    + ".modal-title{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#1a1a1a;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".modal-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}"
    + ".modal-apply-btn{padding:7px 16px;background:" + c + ";color:white;border:none;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;cursor:pointer;white-space:nowrap}"
    + ".modal-apply-btn:hover{opacity:.85}"
    + ".modal-close-btn{background:none;border:none;font-size:22px;cursor:pointer;color:#aaa;line-height:1;padding:0 2px}"
    + ".modal-close-btn:hover{color:#1a1a1a}"
    + ".modal-body{flex:1;overflow:hidden}"
    + ".modal-body iframe{width:100%;height:100%;min-height:500px;border:none;display:block}"
    + fabCSS(config)
    + "</style></head><body>"
    + modal
    + "<div class=\"topbar\"><a href=\"/" + teamId + "/\" class=\"back\">\u2190 Lineup</a>" + navFab(config, teamId, session, myTeams, "history") + "</div>"
    + "<div class=\"wrap\">"
    + "<h1>" + config.name + "</h1>"
    + "<p class=\"page-sub\">Lineup History</p>"
    + bulkBar
    + rows
    + footer(config, false, true)
    + "</div>"
    + script
    + navFabJS()
    + "</body></html>";
}
