import { fontFaceCSS, fabCSS } from '../css.js';
import { navFab, navFabJS, footer } from '../components.js';

export function rosterPage(config, teamId, managedRoster, session, myTeams, saved) {
  var c = (config && config.primaryColor) || "#c0392b";
  var players = managedRoster && managedRoster.length > 1 ? managedRoster.slice(1) : [];
  var regulars = players.filter(function(p){ return !p.isSub; });
  var subs = players.filter(function(p){ return p.isSub; });

  // Build lookup maps from config
  var statsMap = {};
  (config.playerStats || []).forEach(function(s) { statsMap[s.name] = s; });
  var availMap = {};
  (config.availability || []).forEach(function(a) { availMap[a.name] = a.status; });

  function availClass(name) {
    var s = availMap[name];
    if (s === "yes") return " avail-yes";
    if (s === "maybe") return " avail-maybe";
    if (s === "no") return " avail-no";
    return "";
  }

  function isHot(name) {
    var s = statsMap[name];
    return s && s.gp > 0 && s.pts / s.gp >= 1;
  }

  function statsLine(name) {
    var s = statsMap[name];
    if (!s || s.gp === 0) return "";
    var parts = [s.gp + " GP", s.g + "G", s.a + "A", s.pts + " PTS"];
    if (s.pim > 0) parts.push(s.pim + " PIM");
    return "<div class=\"player-stats\">" + parts.join(" &middot; ") + "</div>";
  }

  function playerRow(p, idx) {
    var realIdx = idx + 1;
    var escapedName = p.name.replace(/'/g, "\\'");
    return "<div class=\"roster-row" + (p.name ? availClass(p.name) : "") + "\" id=\"row-" + realIdx + "\">"
      + "<input type=\"text\" name=\"num_" + realIdx + "\" value=\"" + (p.num || "") + "\" placeholder=\"#\" class=\"num-input\" />"
      + "<div class=\"player-info\">"
      + "<div style=\"display:flex;align-items:center;gap:5px\">"
      + "<input type=\"text\" name=\"name_" + realIdx + "\" value=\"" + p.name + "\" placeholder=\"Player name\" class=\"name-input\" />"
      + (p.name && isHot(p.name) ? "<span title=\"1+ point per game\" style=\"font-size:16px;line-height:1\">&#x1F525;</span>" : "")
      + "</div>"
      + (p.name ? statsLine(p.name) : "")
      + "</div>"
      + "<div class=\"row-actions\">"
      + "<label class=\"sub-toggle\"><input type=\"checkbox\" name=\"sub_" + realIdx + "\" value=\"1\"" + (p.isSub ? " checked" : "") + "> Sub</label>"
      + (p.name ? "<button type=\"button\" onclick=\"openProfile('" + escapedName + "')\" class=\"profile-btn\" title=\"Player profile\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z\"/></svg></button>" : "")
      + "<button type=\"button\" onclick=\"removeRow(" + realIdx + ")\" class=\"remove-btn\">&times;</button>"
      + "</div>"
      + "</div>";
  }

  var regularRows = regulars.map(function(p, i){ return playerRow(p, i); }).join("");
  var subRows = subs.map(function(p, i){ return playerRow(p, regulars.length + i); }).join("");
  var allRows = regularRows
    + (subs.length ? "<div class=\"roster-section-divider\"><span>Subs</span></div>" + subRows : "");

  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>" + config.name + " \u2014 Roster</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;padding:0 0 72px;min-height:100vh}"
    + ".topbar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;max-width:860px;margin:0 auto}"
    + ".back{font-size:12px;color:" + c + ";text-decoration:none;text-transform:uppercase;letter-spacing:1px}"
    + ".wrap{max-width:860px;margin:0 auto;padding:0 16px 40px}"
    + "h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;margin-bottom:4px}"
    + ".sub{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:24px}"
    + ".section-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#aaa;margin:20px 0 8px}"
    + ".roster-section-divider{display:flex;align-items:center;gap:10px;margin:16px 0 8px}"
    + ".roster-section-divider::before,.roster-section-divider::after{content:'';flex:1;height:1px;background:#e8e5e0}"
    + ".roster-section-divider span{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#bbb;white-space:nowrap}"
    + ".roster-row{display:flex;align-items:center;gap:8px;background:white;border-radius:4px;padding:10px 12px;margin-bottom:6px;box-shadow:0 1px 4px rgba(0,0,0,.06);border-left:3px solid transparent}"
    + ".avail-yes{border-left-color:#2e7d32}"
    + ".avail-maybe{border-left-color:#e65100}"
    + ".avail-no{border-left-color:#c62828}"
    + ".num-input{width:48px;align-self:stretch;border:1px solid #e0ddd8;border-radius:3px;padding:6px;font-family:inherit;font-size:13px;text-align:center;text-transform:uppercase;flex-shrink:0}"
    + ".player-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}"
    + ".name-input{width:100%;border:1px solid #e0ddd8;border-radius:3px;padding:6px 8px;font-family:inherit;font-size:13px;text-transform:uppercase}"
    + ".player-stats{font-size:10px;color:#999;padding:1px 2px;letter-spacing:.3px;text-transform:uppercase}"
    + ".row-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}"
    + ".sub-toggle{display:flex;align-items:center;gap:5px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;cursor:pointer}"
    + ".sub-toggle input{width:14px;height:14px;cursor:pointer}"
    + ".remove-btn{background:none;border:none;color:#ccc;font-size:18px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0}"
    + ".remove-btn:hover{color:#c0392b}"
    + ".profile-btn{background:none;border:none;color:#bbb;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;display:flex;align-items:center}"
    + ".profile-btn:hover{color:#1a1a1a}"
    // Profile drawer
    + ".drawer-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:500}"
    + ".drawer-overlay.open{display:block}"
    + ".drawer{position:fixed;top:0;right:0;bottom:0;width:320px;max-width:100vw;background:white;box-shadow:-4px 0 24px rgba(0,0,0,.15);z-index:501;transform:translateX(100%);transition:transform .22s ease;display:flex;flex-direction:column}"
    + ".drawer.open{transform:translateX(0)}"
    + ".drawer-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #eee;flex-shrink:0}"
    + ".drawer-name{font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#1a1a1a}"
    + ".drawer-close{background:none;border:none;font-size:22px;color:#aaa;cursor:pointer;line-height:1;padding:0}"
    + ".drawer-close:hover{color:#1a1a1a}"
    + ".drawer-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:16px 18px;border-bottom:1px solid #eee}"
    + ".drawer-stat{display:flex;flex-direction:column;align-items:center;gap:2px}"
    + ".drawer-stat-val{font-size:18px;font-weight:700;color:#1a1a1a}"
    + ".drawer-stat-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#aaa}"
    + ".drawer-body{flex:1;overflow-y:auto;padding:20px 18px;display:flex;flex-direction:column;gap:16px}"
    + ".drawer-field{display:flex;flex-direction:column;gap:5px}"
    + ".drawer-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888}"
    + ".drawer-input{padding:9px 12px;border:2px solid #e0ddd8;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;outline:none;text-transform:none;letter-spacing:.5px}"
    + ".drawer-input:focus{border-color:" + c + "}"
    + ".drawer-save{margin:4px 18px 20px;padding:11px;background:" + c + ";color:white;border:none;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1px;cursor:pointer;flex-shrink:0}"
    + ".drawer-save:hover{opacity:.85}"
    + ".drawer-notice{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#27ae60;padding:0 18px;display:none}"
    + ".add-btn{display:block;width:100%;margin-top:10px;padding:10px;background:none;border:2px dashed #ddd;border-radius:4px;font-family:inherit;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#aaa;cursor:pointer}"
    + ".add-btn:hover{border-color:" + c + ";color:" + c + "}"
    + ".save-btn{width:100%;margin-top:20px;padding:12px;background:" + c + ";color:white;border:none;border-radius:4px;font-family:inherit;font-size:13px;text-transform:uppercase;letter-spacing:1px;cursor:pointer}"
    + ".roster-sticky-bar{position:fixed;bottom:0;left:0;right:0;background:white;border-top:1px solid #eee;padding:10px 16px;z-index:50;box-shadow:0 -2px 8px rgba(0,0,0,.07)}"
    + ".roster-sticky-inner{max-width:860px;margin:0 auto;display:flex;gap:10px}"
    + ".sticky-add-btn{flex:1;padding:10px;background:none;border:2px dashed #ddd;border-radius:4px;font-family:inherit;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#aaa;cursor:pointer}"
    + ".sticky-add-btn:hover{border-color:" + c + ";color:" + c + "}"
    + ".sticky-save-btn{flex:1;padding:10px;background:" + c + ";color:white;border:none;border-radius:4px;font-family:inherit;font-size:13px;text-transform:uppercase;letter-spacing:1px;cursor:pointer}"
    + ".sticky-save-btn:hover{opacity:.85}"
    + ".sync-btn{padding:8px 16px;background:" + c + ";border:none;border-radius:4px;font-family:inherit;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:white;cursor:pointer;white-space:nowrap;margin-top:4px}"
    + ".sync-btn:hover{opacity:.85}"
    + ".notice{background:#e8f5e9;color:#2e7d32;padding:10px 14px;border-radius:3px;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px}"
    + ".footer{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:24px;padding-top:12px;border-top:1px solid #e8e5e0}"
    + ".footer-logo{height:36px;object-fit:contain;opacity:.7}"
    + fabCSS(config)
    + "</style></head><body>"
    + "<div class=\"drawer-overlay\" id=\"drawer-overlay\" onclick=\"closeProfile()\"></div>"
    + "<div class=\"drawer\" id=\"profile-drawer\">"
    + "<div class=\"drawer-header\"><span class=\"drawer-name\" id=\"drawer-player-name\"></span><button class=\"drawer-close\" onclick=\"closeProfile()\">&#215;</button></div>"
    + "<div class=\"drawer-stats\" id=\"drawer-stats\" style=\"display:none\">"
    + "<div class=\"drawer-stat\"><span class=\"drawer-stat-val\" id=\"ds-gp\">-</span><span class=\"drawer-stat-lbl\">GP</span></div>"
    + "<div class=\"drawer-stat\"><span class=\"drawer-stat-val\" id=\"ds-g\">-</span><span class=\"drawer-stat-lbl\">G</span></div>"
    + "<div class=\"drawer-stat\"><span class=\"drawer-stat-val\" id=\"ds-a\">-</span><span class=\"drawer-stat-lbl\">A</span></div>"
    + "<div class=\"drawer-stat\"><span class=\"drawer-stat-val\" id=\"ds-pts\">-</span><span class=\"drawer-stat-lbl\">PTS</span></div>"
    + "<div class=\"drawer-stat\"><span class=\"drawer-stat-val\" id=\"ds-pim\">-</span><span class=\"drawer-stat-lbl\">PIM</span></div>"
    + "</div>"
    + "<div class=\"drawer-body\">"
    + "<div class=\"drawer-field\"><label class=\"drawer-label\">Email</label><input class=\"drawer-input\" id=\"drawer-email\" type=\"email\" placeholder=\"player@email.com\" autocomplete=\"off\" /></div>"
    + "<div class=\"drawer-field\"><label class=\"drawer-label\">Phone</label><input class=\"drawer-input\" id=\"drawer-phone\" type=\"tel\" placeholder=\"(555) 555-5555\" autocomplete=\"off\" /></div>"
    + "</div>"
    + "<div class=\"drawer-notice\" id=\"drawer-notice\">&#10003; Saved</div>"
    + "<button class=\"drawer-save\" onclick=\"saveProfile()\">Save Profile</button>"
    + "</div>"
    + "<div class=\"topbar\"><a href=\"/" + teamId + "/\" class=\"back\">\u2190 Lineup</a>" + navFab(config, teamId, session, myTeams, "roster") + "</div>"
    + "<div class=\"wrap\">"
    + "<div style=\"display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px\">"
    + "<div><h1>" + config.name + "</h1><p class=\"sub\">Manage Roster</p></div>"
    + (config.chillerTeamId ? "<button onclick=\"syncRoster()\" class=\"sync-btn\">&#8635; Sync</button>" : "")
    + "</div>"
    + (saved ? "<div class=\"notice\">&#10003; Roster saved</div>" : "")
    + (!managedRoster ? "<div style=\"text-align:center;padding:40px 0 32px\"><p style=\"color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px\">No roster loaded yet.</p><button onclick=\"syncRoster()\" class=\"save-btn\" style=\"width:auto;padding:12px 28px\">Sync from ChillerStats</button></div>" : "")
    + (managedRoster ? "<form method=\"POST\" action=\"/" + teamId + "/roster\" id=\"roster-form\">"
      + "<input type=\"hidden\" name=\"count\" id=\"count\" value=\"" + players.length + "\">"
      + "<div id=\"roster-rows\">" + allRows + "</div>"
      + "</form>" : "")
    + footer(config, false, true)
    + "</div>"
    + (managedRoster ? "<div class=\"roster-sticky-bar\"><div class=\"roster-sticky-inner\">"
      + "<button type=\"button\" class=\"sticky-add-btn\" onclick=\"addRow()\">+ Add Player</button>"
      + "<button type=\"submit\" form=\"roster-form\" class=\"sticky-save-btn\">Save Roster</button>"
      + "</div></div>" : "")
    + "<script>"
    + "var PLAYER_STATS=" + JSON.stringify(config.playerStats || []) + ";"
    + "var statsMap={}; PLAYER_STATS.forEach(function(s){statsMap[s.name]=s;});"
    + "var rowCount=" + players.length + ";"
    + "function syncRoster(){if(!confirm('Pull latest roster from ChillerStats? This will load the roster for the first time.'))return;fetch('/" + teamId + "/sync',{method:'POST'}).then(function(r){if(r.ok){location.reload();}else{r.text().then(function(t){alert('Sync failed: '+t);});}}).catch(function(){alert('Sync failed.');});}"
    + "function removeRow(idx){var r=document.getElementById('row-'+idx);if(r)r.remove();}"
    + "function addRow(){"
    + "rowCount++;"
    + "var div=document.createElement('div');div.className='roster-row';div.id='row-'+rowCount;"
    + "div.innerHTML='<input type=\"text\" name=\"num_'+rowCount+'\" placeholder=\"#\" class=\"num-input\">'"
    + "+'<div class=\"player-info\"><input type=\"text\" name=\"name_'+rowCount+'\" placeholder=\"Player name\" class=\"name-input\"></div>'"
    + "+'<div class=\"row-actions\"><label class=\"sub-toggle\"><input type=\"checkbox\" name=\"sub_'+rowCount+'\" value=\"1\"> Sub</label>'"
    + "+'<button type=\"button\" onclick=\"removeRow('+rowCount+')\" class=\"remove-btn\">&times;</button></div>';"
    + "document.getElementById('roster-rows').appendChild(div);"
    + "document.getElementById('count').value=rowCount;"
    + "}"
    + "document.getElementById('roster-form') && document.getElementById('roster-form').addEventListener('submit',function(){"
    + "document.getElementById('count').value=rowCount;"
    + "});"
    + "var currentProfileName=null;"
    + "function openProfile(name){"
    +   "currentProfileName=name;"
    +   "document.getElementById('drawer-player-name').textContent=name;"
    +   "document.getElementById('drawer-email').value='';"
    +   "document.getElementById('drawer-phone').value='';"
    +   "document.getElementById('drawer-notice').style.display='none';"
    // Stats in drawer
    +   "var s=statsMap[name];"
    +   "var ds=document.getElementById('drawer-stats');"
    +   "if(s){document.getElementById('ds-gp').textContent=s.gp||0;document.getElementById('ds-g').textContent=s.g||0;document.getElementById('ds-a').textContent=s.a||0;document.getElementById('ds-pts').textContent=s.pts||0;document.getElementById('ds-pim').textContent=s.pim||0;ds.style.display='grid';}else{ds.style.display='none';}"
    +   "document.getElementById('drawer-overlay').classList.add('open');"
    +   "document.getElementById('profile-drawer').classList.add('open');"
    +   "document.body.style.overflow='hidden';"
    +   "fetch('/" + teamId + "/roster/profile/'+encodeURIComponent(name))"
    +   ".then(function(r){return r.json();})"
    +   ".then(function(d){"
    +     "document.getElementById('drawer-email').value=d.email||'';"
    +     "document.getElementById('drawer-phone').value=d.phone||'';"
    +   "});"
    + "}"
    + "function closeProfile(){"
    +   "document.getElementById('drawer-overlay').classList.remove('open');"
    +   "document.getElementById('profile-drawer').classList.remove('open');"
    +   "document.body.style.overflow='';"
    +   "currentProfileName=null;"
    + "}"
    + "function saveProfile(){"
    +   "if(!currentProfileName)return;"
    +   "var email=document.getElementById('drawer-email').value.trim();"
    +   "var phone=document.getElementById('drawer-phone').value.trim();"
    +   "fetch('/" + teamId + "/roster/profile/'+encodeURIComponent(currentProfileName),{"
    +     "method:'POST',headers:{'Content-Type':'application/json'},"
    +     "body:JSON.stringify({email:email,phone:phone})"
    +   "}).then(function(r){"
    +     "if(r.ok){var n=document.getElementById('drawer-notice');n.style.display='block';setTimeout(function(){n.style.display='none';},2000);}"
    +   "});"
    + "}"
    + "</script>"
    + navFabJS()
    + "</body></html>";
}
