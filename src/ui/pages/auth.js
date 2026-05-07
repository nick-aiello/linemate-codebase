import { LINEMATE_ALT_PNG } from '../../assets.js';
import { DIVISIONS } from '../../constants.js';
import { fontFaceCSS } from '../css.js';
import { darkenHex } from '../components.js';

export function loginPage(error) {
  var c = "#c0392b";
  var cd = darkenHex(c);
  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>Log In \u2014 Linemate</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;display:flex;align-items:center;justify-content:center;min-height:100vh}"
    + ".box{background:white;border-radius:8px;padding:40px;text-align:center;width:340px;box-shadow:0 2px 20px rgba(0,0,0,.1)}"
    + ".box h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;margin-bottom:6px}"
    + ".box p.sub{font-size:13px;color:#888;margin-bottom:24px;letter-spacing:1px;text-transform:uppercase}"
    + ".box input{width:100%;padding:10px 14px;border:2px solid #ddd;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:1px;outline:none;margin-bottom:12px;text-align:center}"
    + ".box input[type=password],.box input[type=email]{text-transform:none;letter-spacing:0;text-align:left}"
    + ".box input:focus{border-color:" + c + "}"
    + ".box button{width:100%;padding:12px;background:" + c + ";color:white;border:none;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:1px;cursor:pointer;margin-top:4px}"
    + ".box button:hover{background:" + cd + "}"
    + ".err{color:" + c + ";font-size:13px;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}"
    + ".foot{margin-top:20px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px}"
    + ".foot a{color:" + c + ";text-decoration:none}"
    + "</style></head><body>"
    + "<div class=\"box\">"
    + "<img src=\"data:image/png;base64," + LINEMATE_ALT_PNG + "\" alt=\"Linemate\" style=\"width:200px;margin-bottom:20px\" />"
    + "<p class=\"sub\">Sign in to continue</p>"
    + (error ? "<p class=\"err\">" + error + "</p>" : "")
    + "<form method=\"POST\" action=\"/login\">"
    + "<input type=\"text\" name=\"identifier\" placeholder=\"Username or Email\" autocomplete=\"username\" autofocus required />"
    + "<input type=\"password\" name=\"password\" placeholder=\"Password\" autocomplete=\"current-password\" required />"
    + "<button type=\"submit\">Log In</button>"
    + "</form>"
    + "<div class=\"foot\">Registering a team? <a href=\"/signup\">Sign up</a></div>"
    + "</div></body></html>";
}

export function signupPage(error, isTeamSignup, isAddingTeam) {
  var c = "#c0392b";
  var cd = darkenHex(c);
  var divisionOptions = DIVISIONS.map(function(d) { return "<option value=\"" + d + "\">" + d + "</option>"; }).join("");
  var teamFields = (isTeamSignup || isAddingTeam)
    ? "<input type=\"text\" name=\"contactName\" placeholder=\"Your Name\" autocomplete=\"name\" required />"
    + "<input type=\"text\" name=\"teamName\" placeholder=\"Team Name\" autocomplete=\"organization\" required />"
    + "<select name=\"division\" required style=\"width:100%;padding:10px 14px;border:2px solid #ddd;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1px;outline:none;margin-bottom:12px;background:white;text-align:center\"><option value=\"\">Select Division</option>" + divisionOptions + "</select>"
    + "<input type=\"url\" name=\"chillerUrl\" placeholder=\"ChillerStats URL\" autocomplete=\"off\" required />"
    + "<p style=\"font-size:11px;color:#aaa;text-transform:none;letter-spacing:0;margin:-6px 0 12px\">e.g. chillerstats.com/team/stats.cfm?TeamID=...</p>"
    : "<input type=\"text\" name=\"username\" placeholder=\"Username\" autocomplete=\"username\" required />";
  var title = isAddingTeam ? "Add a Team" : (isTeamSignup ? "Register Your Team" : "Create Admin Account");
  var sub = isAddingTeam ? "Add another team to your account" : (isTeamSignup ? "Linemate App" : "First user \u2014 you will be super admin");
  var btn = isAddingTeam ? "Add Team" : (isTeamSignup ? "Register Team" : "Create Account");
  var passwordFields = isAddingTeam ? "" : "<input type=\"email\" name=\"email\" placeholder=\"Email (optional)\" autocomplete=\"email\" />"
    + "<input type=\"password\" name=\"password\" placeholder=\"Password\" autocomplete=\"new-password\" required />"
    + "<input type=\"password\" name=\"confirm\" placeholder=\"Confirm Password\" autocomplete=\"new-password\" required />";
  var foot = isAddingTeam
    ? "<div class=\"foot\"><a href=\"/\">Back to my teams</a></div>"
    : "<div class=\"foot\">Already have an account? <a href=\"/login\">Log in</a></div>";
  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>Sign Up \u2014 Linemate</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;display:flex;align-items:center;justify-content:center;min-height:100vh}"
    + ".box{background:white;border-radius:8px;padding:40px;text-align:center;width:400px;box-shadow:0 2px 20px rgba(0,0,0,.1)}"
    + ".box h1{font-size:22px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;margin-bottom:6px}"
    + ".box p.sub{font-size:13px;color:#888;margin-bottom:24px;letter-spacing:1px;text-transform:uppercase}"
    + ".box input{width:100%;padding:10px 14px;border:2px solid #ddd;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:1px;outline:none;margin-bottom:12px;text-align:center}"
    + ".box input[type=url],.box input[type=password],.box input[type=email]{text-transform:none;letter-spacing:0;font-size:13px;text-align:left}"
    + ".box input:focus{border-color:" + c + "}"
    + ".box button{width:100%;padding:12px;background:" + c + ";color:white;border:none;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;font-size:15px;text-transform:uppercase;letter-spacing:1px;cursor:pointer;margin-top:4px}"
    + ".box button:hover{background:" + cd + "}"
    + ".err{color:" + c + ";font-size:13px;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}"
    + ".foot{margin-top:20px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px}"
    + ".foot a{color:" + c + ";text-decoration:none}"
    + "</style></head><body>"
    + "<div class=\"box\">"
    + "<img src=\"data:image/png;base64," + LINEMATE_ALT_PNG + "\" alt=\"Linemate\" style=\"width:180px;margin-bottom:16px\" />"
    + "<h1>" + title + "</h1>"
    + "<p class=\"sub\">" + sub + "</p>"
    + (error ? "<p class=\"err\">" + error + "</p>" : "")
    + "<form method=\"POST\" action=\"/signup\">"
    + teamFields
    + passwordFields
    + "<button type=\"submit\">" + btn + "</button>"
    + "</form>"
    + foot
    + "</div></body></html>";
}

export function teamPickerPage(session, teamConfigs) {
  var c = "#c0392b";
  var cards = teamConfigs.map(function(t) {
    var color = t.primaryColor || c;
    return "<a href=\"/" + t.slug + "/\" style=\"display:flex;align-items:center;gap:16px;background:white;border-radius:8px;box-shadow:0 2px 20px rgba(0,0,0,.1);padding:20px 24px;text-decoration:none;color:#1a1a1a\">"
      + "<span style=\"width:14px;height:14px;border-radius:50%;background:" + color + ";flex-shrink:0\"></span>"
      + "<div>"
      + "<div style=\"font-size:16px;text-transform:uppercase;letter-spacing:1px\">" + t.name + "</div>"
      + (t.division ? "<div style=\"font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:3px\">" + t.division + "</div>" : "")
      + "</div>"
      + "<span style=\"margin-left:auto;font-size:18px;color:#ccc\">&rsaquo;</span>"
      + "</a>";
  }).join("");
  return "<!DOCTYPE html><html lang=\"en\"><head>"
    + "<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
    + "<title>My Teams \u2014 Linemate</title>"
    + "<style>" + fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px 16px}"
    + ".wrap{width:100%;max-width:440px}"
    + ".top{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}"
    + "h1{font-size:20px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a}"
    + ".sub{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-top:3px}"
    + ".cards{display:flex;flex-direction:column;gap:12px}"
    + "a:hover{box-shadow:0 4px 24px rgba(0,0,0,.15)!important}"
    + ".logout-btn{background:none;border:none;cursor:pointer;font-family:'NHLChicago',Arial,sans-serif;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px}"
    + "</style></head><body>"
    + "<div class=\"wrap\">"
    + "<div class=\"top\"><div><h1>My Teams</h1><p class=\"sub\">" + session.username + "</p></div>"
    + "<form method=\"POST\" action=\"/logout\"><button type=\"submit\" class=\"logout-btn\">Log Out</button></form></div>"
    + "<div class=\"cards\">" + cards + "</div>"
    + "<div style=\"text-align:center;margin-top:20px\"><a href=\"/signup\" style=\"font-family:'NHLChicago',Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#c0392b;text-decoration:none\">+ Add a Team</a></div>"
    + "</div></body></html>";
}
