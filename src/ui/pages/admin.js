import { TEAM_CONFIGS, DIVISIONS } from '../../constants.js';
import { fontFaceCSS } from '../css.js';
import { getUserTeamIds } from '../../db/users.js';

export function adminDashboardPage(session, stats, kvTeams) {
  var c = "#c0392b";
  var cards = [
    { href: "/admin/teams", label: "Teams", desc: "Manage registered & built-in teams", count: stats.teams },
    { href: "/admin/users", label: "Users", desc: "Manage user accounts & roles", count: stats.users },
  ];
  var cardHtml = cards.map(function(card) {
    return "<a href=\"" + card.href + "\" style=\"display:block;background:white;border-radius:8px;box-shadow:0 2px 20px rgba(0,0,0,.1);padding:28px;text-decoration:none;color:inherit;transition:box-shadow .15s\">"
      + "<div style=\"display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px\">"
      + "<span style=\"font-size:18px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a\">" + card.label + "</span>"
      + "<span style=\"font-size:28px;font-weight:bold;color:" + c + "\">" + card.count + "</span>"
      + "</div>"
      + "<span style=\"font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px\">" + card.desc + "</span>"
      + "</a>";
  }).join("");
  var builtInLinks = Object.keys(TEAM_CONFIGS).map(function(slug) {
    var t = TEAM_CONFIGS[slug];
    return "<a href=\"/" + slug + "/\" style=\"display:inline-flex;align-items:center;gap:8px;background:white;border-radius:6px;padding:10px 16px;text-decoration:none;color:#1a1a1a;font-size:13px;text-transform:uppercase;letter-spacing:1px;box-shadow:0 1px 8px rgba(0,0,0,.08)\">"
      + "<span style=\"width:10px;height:10px;border-radius:50%;background:" + (t.primaryColor || c) + ";display:inline-block\"></span>"
      + (t.name || slug)
      + "</a>";
  }).join("");
  var kvLinks = (kvTeams || []).sort(function(a,b){return a.name.localeCompare(b.name);}).map(function(t) {
    return "<a href=\"/" + t.slug + "/\" style=\"display:inline-flex;align-items:center;gap:8px;background:white;border-radius:6px;padding:10px 16px;text-decoration:none;color:#1a1a1a;font-size:13px;text-transform:uppercase;letter-spacing:1px;box-shadow:0 1px 8px rgba(0,0,0,.08)\">"
      + "<span style=\"width:10px;height:10px;border-radius:50%;background:" + (t.primaryColor || c) + ";display:inline-block\"></span>"
      + t.name
      + "</a>";
  }).join("");
  var teamLinks = builtInLinks + kvLinks;
  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>Admin \u2014 Linemate</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;padding:32px 16px}"
    + ".wrap{max-width:700px;margin:0 auto}"
    + ".top{display:flex;justify-content:space-between;align-items:center;margin-bottom:36px}"
    + "h1{font-size:26px;text-transform:uppercase;letter-spacing:3px;color:#1a1a1a}"
    + ".sub{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:4px}"
    + ".grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:32px}@media(max-width:600px){.grid{grid-template-columns:1fr}}"
    + ".section-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#aaa;margin-bottom:12px}"
    + ".team-links{display:flex;flex-wrap:wrap;gap:10px}"
    + ".logout-btn{background:none;border:none;cursor:pointer;font-family:'NHLChicago',Arial,sans-serif;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px}"
    + "</style></head><body>"
    + "<div class=\"wrap\">"
    + "<div class=\"top\">"
    + "<div><h1>Linemate Admin</h1><p class=\"sub\">" + session.username + " &bull; " + ({"superadmin":"Super Admin","admin":"Admin","team_manager":"Team Manager","team_member":"Member"}[session.role]||session.role) + "</p></div>"
    + "<form method=\"POST\" action=\"/logout\"><button type=\"submit\" class=\"logout-btn\">Log Out</button></form>"
    + "</div>"
    + "<div class=\"grid\">" + cardHtml + "</div>"
    + "<p class=\"section-label\">Quick access &mdash; Teams</p>"
    + "<div class=\"team-links\">" + teamLinks + "</div>"
    + "</div></body></html>";
}

export function adminTeamsPage(kvTeams, builtInDivisions, session) {
  var c = "#c0392b";
  builtInDivisions = builtInDivisions || {};
  var hardcoded = Object.keys(TEAM_CONFIGS).map(function(slug) {
    var t = TEAM_CONFIGS[slug];
    var currentDiv = builtInDivisions[slug] || null;
    var divSelect = "<form method=\"POST\" action=\"/admin/teams/" + slug + "/update\" style=\"display:flex;gap:6px;align-items:center\">"
      + "<select name=\"division\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:11px;padding:3px 6px;border:1px solid #ddd;border-radius:4px;background:white\"><option value=\"\">No division</option>" + DIVISIONS.map(function(d){return "<option value=\""+d+"\""+(currentDiv===d?" selected":"")+">"+d+"</option>";}).join("") + "</select>"
      + "<button type=\"submit\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:11px;padding:3px 8px;background:#1a1a1a;color:white;border:none;border-radius:4px;cursor:pointer\">Save</button>"
      + "</form>";
    return "<tr>"
      + "<td style=\"padding:10px 8px;font-weight:bold\">" + (t.name || slug) + "</td>"
      + "<td style=\"padding:10px 8px;font-size:12px;color:#888\">" + slug + "</td>"
      + "<td style=\"padding:10px 8px;font-size:12px\">" + divSelect + "</td>"
      + "<td style=\"padding:10px 8px;font-size:12px\">" + (t.chillerTeamId ? "<span style=\"color:#27ae60\">Yes</span>" : "<span style=\"color:#aaa\">No</span>") + "</td>"
      + "<td style=\"padding:10px 8px\"><span style=\"font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px\">Built-in</span></td>"
      + "<td style=\"padding:10px 8px\"><a href=\"/" + slug + "/\" style=\"color:" + c + ";font-size:12px;text-transform:uppercase;letter-spacing:1px;text-decoration:none\">Open</a></td>"
      + "</tr>";
  }).join("");
  var kvRows = kvTeams.length === 0 ? "" : kvTeams.sort(function(a,b){return a.name.localeCompare(b.name);}).map(function(t) {
    return "<tr>"
      + "<td style=\"padding:10px 8px;font-weight:bold\">" + t.name + "</td>"
      + "<td style=\"padding:10px 8px;font-size:12px;color:#888\">" + t.slug + "</td>"
      + "<td style=\"padding:10px 8px;font-size:12px\">"
      + "<form method=\"POST\" action=\"/admin/teams/" + t.slug + "/update\" style=\"display:flex;gap:6px;align-items:center\">"
      + "<select name=\"division\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:11px;padding:3px 6px;border:1px solid #ddd;border-radius:4px;background:white\"><option value=\"\">No division</option>" + DIVISIONS.map(function(d){return "<option value=\""+d+"\""+(t.division===d?" selected":"")+">"+d+"</option>";}).join("") + "</select>"
      + "<button type=\"submit\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:11px;padding:3px 8px;background:#1a1a1a;color:white;border:none;border-radius:4px;cursor:pointer\">Save</button>"
      + "</form>"
      + "</td>"
      + "<td style=\"padding:10px 8px;font-size:12px;color:#888\">" + (t.contactName ? t.contactName + "<br><span style=\"color:#aaa\">" + t.contactEmail + "</span>" : t.contactEmail || "&mdash;") + "</td>"
      + "<td style=\"padding:10px 8px;font-size:12px\">" + (t.chillerTeamId ? "<span style=\"color:#27ae60\">Yes</span>" : "<span style=\"color:#aaa\">No</span>") + "</td>"
      + "<td style=\"padding:10px 8px;font-size:12px;color:#888\">" + new Date(t.createdAt).toLocaleDateString() + "</td>"
      + "<td style=\"padding:10px 8px;display:flex;gap:8px;align-items:center\">"
      + "<a href=\"/" + t.slug + "/\" style=\"color:" + c + ";font-size:12px;text-transform:uppercase;letter-spacing:1px;text-decoration:none\">Open</a>"
      + "<a href=\"/admin/teams/" + t.slug + "/edit\" style=\"color:#1a1a1a;font-size:12px;text-transform:uppercase;letter-spacing:1px;text-decoration:none\">Edit</a>"
      + "<form method=\"POST\" action=\"/admin/teams/" + t.slug + "/delete\" style=\"display:inline\"><button type=\"submit\" onclick=\"return confirm('Delete team " + t.name + " and all its data? This cannot be undone.')\" style=\"background:#e74c3c;color:white;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-family:'NHLChicago',Arial,sans-serif;font-size:12px\">Delete</button></form>"
      + "</td>"
      + "</tr>";
  }).join("");
  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>Teams \u2014 Linemate Admin</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;padding:32px 16px}"
    + ".wrap{max-width:960px;margin:0 auto}"
    + ".nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}"
    + ".nav-links{display:flex;gap:16px;align-items:center}"
    + ".nav-link{font-size:13px;color:" + c + ";text-decoration:none;text-transform:uppercase;letter-spacing:1px}"
    + "h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;margin-bottom:4px}"
    + ".sub{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:28px}"
    + ".section-label{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:28px 0 10px}"
    + ".table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:8px}table{width:100%;background:white;border-radius:8px;box-shadow:0 2px 20px rgba(0,0,0,.1);border-collapse:collapse;overflow:hidden}"
    + "thead{background:" + c + ";color:white}"
    + "th{padding:12px 8px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:normal}"
    + "tbody tr{border-bottom:1px solid #f0f0f0}"
    + "tbody tr:last-child{border-bottom:none}"
    + ".logout-btn{background:none;border:none;cursor:pointer;font-family:'NHLChicago',Arial,sans-serif;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px}"
    + "</style></head><body>"
    + "<div class=\"wrap\">"
    + "<div class=\"nav\"><div class=\"nav-links\"><a href=\"/admin\" class=\"nav-link\">\u2190 Admin</a><a href=\"/admin/users\" class=\"nav-link\">Users</a></div>"
    + "<form method=\"POST\" action=\"/logout\"><button type=\"submit\" class=\"logout-btn\">Log Out</button></form></div>"
    + "<h1>Team Management</h1>"
    + "<p class=\"sub\">Logged in as " + session.username + " &bull; " + ({"superadmin":"Super Admin","admin":"Admin","team_manager":"Team Manager","team_member":"Member"}[session.role]||session.role) + "</p>"
    + "<p class=\"section-label\">Registered Teams</p>"
    + "<div class=\"table-wrap\"><table><thead><tr><th>Team Name</th><th>Slug / URL</th><th>Division</th><th>Contact</th><th>ChillerStats</th><th>Registered</th><th></th></tr></thead>"
    + "<tbody>" + (kvRows || "<tr><td colspan=\"6\" style=\"text-align:center;padding:24px;color:#888;font-size:13px\">No self-registered teams yet. Share /signup to get teams on board.</td></tr>") + "</tbody></table></div>"
    + "<p class=\"section-label\">Built-in Teams</p>"
    + "<div class=\"table-wrap\"><table><thead><tr><th>Team Name</th><th>Slug / URL</th><th>Division</th><th>ChillerStats</th><th>Type</th><th></th></tr></thead>"
    + "<tbody>" + (hardcoded || "<tr><td colspan=\"6\" style=\"text-align:center;padding:24px;color:#888;font-size:13px\">None</td></tr>") + "</tbody></table></div>"
    + "</div></body></html>";
}

export function adminTeamEditPage(team) {
  var c = "#c0392b";
  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>Edit " + team.name + " \u2014 Linemate Admin</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;padding:32px 16px}"
    + ".wrap{max-width:560px;margin:0 auto}"
    + ".nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}"
    + ".nav-link{font-size:13px;color:" + c + ";text-decoration:none;text-transform:uppercase;letter-spacing:1px}"
    + "h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;margin-bottom:4px}"
    + ".sub{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:28px}"
    + ".card{background:white;border-radius:8px;box-shadow:0 2px 20px rgba(0,0,0,.1);padding:28px}"
    + ".field{display:flex;flex-direction:column;gap:4px;margin-bottom:18px}"
    + "label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888}"
    + "input{padding:9px 12px;border:2px solid #ddd;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;outline:none;width:100%}"
    + "input:focus{border-color:" + c + "}"
    + ".hint{font-size:11px;color:#aaa;margin-top:2px}"
    + ".actions{display:flex;gap:10px;margin-top:8px}"
    + ".btn-save{padding:10px 24px;background:" + c + ";color:white;border:none;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1px;cursor:pointer}"
    + ".btn-cancel{padding:10px 24px;background:none;border:2px solid #ddd;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1px;cursor:pointer;color:#888;text-decoration:none;display:inline-flex;align-items:center}"
    + ".logout-btn{background:none;border:none;cursor:pointer;font-family:'NHLChicago',Arial,sans-serif;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px}"
    + "</style></head><body>"
    + "<div class=\"wrap\">"
    + "<div class=\"nav\"><a href=\"/admin/teams\" class=\"nav-link\">\u2190 Teams</a>"
    + "<form method=\"POST\" action=\"/logout\"><button type=\"submit\" class=\"logout-btn\">Log Out</button></form></div>"
    + "<h1>Edit Team</h1>"
    + "<p class=\"sub\">Slug: " + team.slug + "</p>"
    + "<div class=\"card\">"
    + "<form method=\"POST\" action=\"/admin/teams/" + team.slug + "/edit\">"
    + "<div class=\"field\"><label>Team Name</label><input type=\"text\" name=\"name\" value=\"" + (team.name || "") + "\" required /></div>"
    + "<div class=\"field\"><label>Contact Name</label><input type=\"text\" name=\"contactName\" value=\"" + (team.contactName || "") + "\" /></div>"
    + "<div class=\"field\"><label>Contact Email</label><input type=\"email\" name=\"contactEmail\" value=\"" + (team.contactEmail || "") + "\" /></div>"
    + "<div class=\"field\"><label>ChillerStats Team ID</label><input type=\"text\" name=\"chillerTeamId\" value=\"" + (team.chillerTeamId || "") + "\" />"
    + "<span class=\"hint\">UUID from chillerstats.com/team/stats.cfm?TeamID=...</span></div>"
    + "<div class=\"actions\"><button type=\"submit\" class=\"btn-save\">Save</button><a href=\"/admin/teams\" class=\"btn-cancel\">Cancel</a></div>"
    + "</form></div>"
    + "</div></body></html>";
}

export function adminUsersPage(users, allTeamIds, session, createError) {
  var c = "#c0392b";

  // Renders an ACF-style team picker: chips for selected teams, dropdown to add more
  function teamPicker(pickerId, selectedIds) {
    var selected = selectedIds || [];
    var chipsHtml = selected.map(function(tid) {
      return "<span class=\"tp-chip\" data-id=\"" + tid + "\">" + tid + "<button type=\"button\" class=\"tp-chip-remove\" onclick=\"tpRemove(this)\" aria-label=\"Remove\">&#215;</button><input type=\"hidden\" name=\"teamId\" value=\"" + tid + "\"></span>";
    }).join("");
    var dropItems = allTeamIds.map(function(tid) {
      return "<div class=\"tp-opt\" data-id=\"" + tid + "\" onclick=\"tpAdd(this)\">" + tid + "</div>";
    }).join("");
    return "<div class=\"tp\" id=\"tp-" + pickerId + "\">"
      + "<div class=\"tp-chips\" id=\"tp-chips-" + pickerId + "\">" + chipsHtml + "<input class=\"tp-search\" type=\"text\" placeholder=\"Add team\u2026\" autocomplete=\"off\" oninput=\"tpFilter(this)\" onfocus=\"tpOpen(this)\" onblur=\"tpBlur(this)\" /></div>"
      + "<div class=\"tp-drop\" id=\"tp-drop-" + pickerId + "\">" + dropItems + "</div>"
      + "</div>";
  }

  var createForm = "<div style=\"background:white;border-radius:8px;box-shadow:0 2px 20px rgba(0,0,0,.1);padding:24px;margin-bottom:28px\">"
    + "<h2 style=\"font-size:15px;text-transform:uppercase;letter-spacing:1px;color:#1a1a1a;margin-bottom:16px\">Create User</h2>"
    + (createError ? "<p style=\"color:" + c + ";font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px\">" + createError + "</p>" : "")
    + "<form method=\"POST\" action=\"/admin/users/create\" class=\"create-form-row\" style=\"display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end\">"
    + "<div style=\"display:flex;flex-direction:column;gap:4px\"><label style=\"font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888\">Username</label><input type=\"text\" name=\"username\" required style=\"padding:8px 12px;border:2px solid #ddd;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;width:160px;outline:none\" /></div>"
    + "<div style=\"display:flex;flex-direction:column;gap:4px\"><label style=\"font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888\">Email (optional)</label><input type=\"email\" name=\"email\" style=\"padding:8px 12px;border:2px solid #ddd;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;width:200px;outline:none\" /></div>"
    + "<div style=\"display:flex;flex-direction:column;gap:4px\"><label style=\"font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888\">Password</label><input type=\"password\" name=\"password\" required style=\"padding:8px 12px;border:2px solid #ddd;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;width:160px;outline:none\" /></div>"
    + "<div style=\"display:flex;flex-direction:column;gap:4px\"><label style=\"font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888\">Role</label><select name=\"role\" style=\"padding:8px 12px;border:2px solid #ddd;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;background:white;outline:none\"><option value=\"team_manager\">Team Manager</option><option value=\"team_member\">Member</option><option value=\"admin\">Admin</option><option value=\"superadmin\">Super Admin</option></select></div>"
    + "<div style=\"display:flex;flex-direction:column;gap:4px\"><label style=\"font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888\">Teams</label>" + teamPicker("new", []) + "</div>"
    + "<button type=\"submit\" style=\"padding:9px 20px;background:" + c + ";color:white;border:none;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1px;cursor:pointer\">Create</button>"
    + "</form></div>";

  var rows = users.length === 0
    ? "<tr><td colspan=\"7\" style=\"text-align:center;padding:24px;color:#888;font-size:13px\">No users yet.</td></tr>"
    : users.sort(function(a, b) { return a.username.localeCompare(b.username); }).map(function(u) {
        var uTeamIds = getUserTeamIds(u);
        var roleLabels = {"superadmin":"Super Admin","admin":"Admin","team_manager":"Team Manager","team_member":"Member"};
        var roleOptions = ["superadmin","admin","team_manager","team_member"].map(function(r) {
          return "<option value=\"" + r + "\"" + (u.role === r ? " selected" : "") + ">" + (roleLabels[r]||r) + "</option>";
        }).join("");
        var isSelf = u.id === session.userId;
        var summaryRow = "<tr class=\"u-row\">"
          + "<td style=\"padding:10px 8px;font-size:13px\">" + u.username + (isSelf ? " <span style=\"font-size:11px;color:#aaa\">(you)</span>" : "") + "</td>"
          + "<td style=\"padding:10px 8px;color:#888;font-size:12px\">" + (u.email || "<span style=\"color:#e65100\">—</span>") + "</td>"
          + "<td style=\"padding:10px 8px;font-size:12px;color:#555\">" + (roleLabels[u.role]||u.role) + "</td>"
          + "<td style=\"padding:10px 8px;font-size:12px;color:#888\">" + (uTeamIds.length ? uTeamIds.join(", ") : "—") + "</td>"
          + "<td style=\"padding:10px 8px;font-size:12px\">"
          + (u.chillerCookie
            ? "<span style=\"color:#27ae60\">\u2713</span>"
            : "<span style=\"color:#ddd\">\u2014</span>")
          + "</td>"
          + "<td style=\"padding:10px 8px\">"
          + "<button onclick=\"toggleEdit('" + u.id + "')\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:11px;padding:4px 10px;background:none;border:1px solid #ddd;border-radius:4px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;color:#555\">Edit</button>"
          + "</td></tr>";
        var editRow = "<tr id=\"edit-" + u.id + "\" style=\"display:none;background:#fafafa\">"
          + "<td colspan=\"6\" style=\"padding:16px 12px;border-top:2px solid #f0ede8\">"
          + "<form method=\"POST\" action=\"/admin/users/" + u.id + "/role\">"
          + "<div style=\"display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end\">"
          + "<div style=\"display:flex;flex-direction:column;gap:4px\"><label style=\"font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#aaa\">Email</label><input type=\"email\" name=\"email\" value=\"" + (u.email || "") + "\" placeholder=\"email@example.com\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:12px;padding:6px 8px;border:1px solid #ddd;border-radius:4px;width:210px;outline:none\" /></div>"
          + "<div style=\"display:flex;flex-direction:column;gap:4px\"><label style=\"font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#aaa\">Role</label><select name=\"role\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:12px;padding:6px 8px;border:1px solid #ddd;border-radius:4px;background:white\">" + roleOptions + "</select></div>"
          + "<div style=\"display:flex;flex-direction:column;gap:4px\"><label style=\"font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#aaa\">Teams</label>" + teamPicker(u.id, uTeamIds) + "</div>"
          + "<button type=\"submit\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:11px;padding:7px 14px;background:#1a1a1a;color:white;border:none;border-radius:4px;cursor:pointer;text-transform:uppercase;letter-spacing:1px\">Save</button>"
          + "</div></form>"
          + "<div style=\"display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #eee;align-items:center\">"
          + (u.chillerCookie ? "<form method=\"POST\" action=\"/admin/users/" + u.id + "/clear-chiller\"><button type=\"submit\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:11px;padding:4px 10px;border:1px solid #e74c3c;border-radius:4px;background:none;cursor:pointer;color:#e74c3c;text-transform:uppercase;letter-spacing:.5px\">Clear Chiller Cookie</button></form>" : "")
          + (isSelf ? "" : "<form method=\"POST\" action=\"/admin/users/" + u.id + "/delete\"><button type=\"submit\" onclick=\"return confirm('Delete " + u.username + "?')\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:11px;padding:4px 10px;border:none;border-radius:4px;background:#e74c3c;cursor:pointer;color:white;text-transform:uppercase;letter-spacing:.5px\">Delete User</button></form>")
          + "</div>"
          + "</td></tr>";
        return summaryRow + editRow;
      }).join("");

  var tpScript = "<script>"
    + "function toggleEdit(id){var r=document.getElementById('edit-'+id);r.style.display=r.style.display==='none'?'table-row':'none';}"
    + "function tpGetPicker(el){return el.closest('.tp');}"
    + "function tpGetId(picker){return picker.id.replace('tp-','');}"
    + "function tpSelectedIds(picker){return Array.from(picker.querySelectorAll('.tp-chip')).map(function(c){return c.dataset.id;});}"
    + "function tpOpen(input){var drop=input.closest('.tp').querySelector('.tp-drop');drop.classList.add('open');tpFilterDrop(input.closest('.tp'),input.value);}"
    + "function tpBlur(input){setTimeout(function(){var drop=input.closest('.tp').querySelector('.tp-drop');drop.classList.remove('open');},180);}"
    + "function tpFilter(input){tpFilterDrop(input.closest('.tp'),input.value);}"
    + "function tpFilterDrop(picker,q){var sel=tpSelectedIds(picker);picker.querySelectorAll('.tp-opt').forEach(function(o){var match=!q||o.dataset.id.includes(q.toLowerCase());var taken=sel.includes(o.dataset.id);o.style.display=(match&&!taken)?'':'none';});}"
    + "function tpAdd(opt){var picker=opt.closest('.tp');var id=opt.dataset.id;var chips=picker.querySelector('.tp-chips');var search=picker.querySelector('.tp-search');var chip=document.createElement('span');chip.className='tp-chip';chip.dataset.id=id;chip.innerHTML=id+'<button type=\"button\" class=\"tp-chip-remove\" onclick=\"tpRemove(this)\" aria-label=\"Remove\">&#215;</button><input type=\"hidden\" name=\"teamId\" value=\"'+id+'\">';chips.insertBefore(chip,search);search.value='';tpFilterDrop(picker,'');}"
    + "function tpRemove(btn){var chip=btn.closest('.tp-chip');var picker=chip.closest('.tp');chip.remove();var search=picker.querySelector('.tp-search');tpFilterDrop(picker,search.value);}"
    + "<\/script>";

  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>Users \u2014 Linemate Admin</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;padding:32px 16px}"
    + ".wrap{max-width:860px;margin:0 auto}"
    + ".nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}"
    + ".nav-links{display:flex;gap:16px;align-items:center}"
    + ".nav-link{font-size:13px;color:" + c + ";text-decoration:none;text-transform:uppercase;letter-spacing:1px}"
    + "h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;margin-bottom:4px}"
    + ".sub{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:28px}"
    + ".table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}table{width:100%;background:white;border-radius:8px;box-shadow:0 2px 20px rgba(0,0,0,.1);border-collapse:collapse;overflow:hidden}"
    + "thead{background:" + c + ";color:white}"
    + "th{padding:12px 8px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:normal}"
    + "tbody tr{border-bottom:1px solid #f0f0f0}"
    + "tbody tr:last-child{border-bottom:none}"
    + ".logout-btn{background:none;border:none;cursor:pointer;font-family:'NHLChicago',Arial,sans-serif;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px}"
    + "@media(max-width:600px){.create-form-row{flex-direction:column!important}.create-form-row input,.create-form-row select{width:100%!important}}"
    // Team picker styles
    + ".tp{position:relative;width:260px}"
    + ".tp-chips{display:flex;flex-wrap:wrap;gap:4px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;background:white;cursor:text;min-height:32px;align-items:center}"
    + ".tp-chip{display:inline-flex;align-items:center;gap:4px;background:#eef0f2;border-radius:3px;padding:2px 6px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#333;white-space:nowrap}"
    + ".tp-chip-remove{background:none;border:none;cursor:pointer;color:#999;font-size:13px;line-height:1;padding:0;display:flex;align-items:center}"
    + ".tp-chip-remove:hover{color:#e74c3c}"
    + ".tp-search{border:none;outline:none;font-family:'NHLChicago',Arial,sans-serif;font-size:12px;min-width:80px;flex:1;padding:2px 2px;background:transparent;text-transform:uppercase;letter-spacing:.5px}"
    + ".tp-drop{display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #ddd;border-radius:4px;box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:100;max-height:180px;overflow-y:auto;margin-top:2px}"
    + ".tp-drop.open{display:block}"
    + ".tp-opt{padding:6px 10px;font-size:12px;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;color:#333}"
    + ".tp-opt:hover{background:#f5f2ec;color:" + c + "}"
    + "</style></head><body>"
    + "<div class=\"wrap\">"
    + "<div class=\"nav\"><div class=\"nav-links\"><a href=\"/admin\" class=\"nav-link\">\u2190 Admin</a><a href=\"/admin/teams\" class=\"nav-link\">Teams</a></div>"
    + "<form method=\"POST\" action=\"/logout\"><button type=\"submit\" class=\"logout-btn\">Log Out</button></form></div>"
    + "<h1>User Management</h1>"
    + "<p class=\"sub\">Logged in as " + session.username + " &bull; " + ({"superadmin":"Super Admin","admin":"Admin","team_manager":"Team Manager","team_member":"Member"}[session.role]||session.role) + "</p>"
    + createForm
    + "<div class=\"table-wrap\"><table><thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Teams</th><th>Chiller</th><th></th></tr></thead>"
    + "<tbody>" + rows + "</tbody></table></div>"
    + "</div>"
    + tpScript
    + "</body></html>";
}
