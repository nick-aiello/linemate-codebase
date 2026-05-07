import { MAIN, SONS, CAHL } from './assets.js';

export const SLOTS = ["lw1","lw2","lw3","c1","c2","c3","rw1","rw2","rw3","ld1","ld2","rd1","rd2","g1"];
export const SLOTS_3D = ["lw1","lw2","lw3","c1","c2","c3","rw1","rw2","rw3","ld1","ld2","ld3","rd1","rd2","rd3","g1"];

export function buildSlots(fwdLines, defLines) {
  var slots = [];
  for (var i = 1; i <= fwdLines; i++) slots.push("lw" + i);
  for (var i = 1; i <= fwdLines; i++) slots.push("c" + i);
  for (var i = 1; i <= fwdLines; i++) slots.push("rw" + i);
  for (var i = 1; i <= defLines; i++) slots.push("ld" + i);
  for (var i = 1; i <= defLines; i++) slots.push("rd" + i);
  slots.push("g1");
  return slots;
}
export const TEAM_CONFIGS = {
  "native-sons": {
    primaryColor: "#c0392b",
    chillerTeamId: "F04EE3C5-EF0A-031F-822E0A2CC1D35F98",
    name: "Native Sons Hockey",
    opponents: [],   // auto-populated by /sync
    rinks: [],       // auto-populated by /sync
    roster: [["", ""]],  // auto-populated by /sync
    defaults: {},
    logoMain: MAIN,
    logoMainAlt: "Native Sons",
    logoFooter: [{src: SONS, alt: "Sons"}, {src: CAHL, alt: "CAHL"}],
  },
  "lumberquacks": {
    primaryColor: "#2e7d32",
    primaryColorDark: "#1b5e20",
    chillerTeamId: "F06B68DB-A941-506F-63DA9E730DE3BE38",
    name: "Lumberquacks Hockey",
    opponents: [],   // auto-populated by /sync
    rinks: [],       // auto-populated by /sync
    roster: [["", ""]],  // auto-populated by /sync
    defaults: {},
    logoMain: null,
    logoMainAlt: "Lumberquacks",
    logoFooter: [{src: CAHL, alt: "CAHL"}],
  },
  // Add more teams here:
  // "team-slug": {
  //   primaryColor: "#c0392b",     // accent color (hex) — used for headers, buttons, dropdowns
  //   primaryColorDark: "#a93226", // darker shade for hover states
  //   chillerTeamId: "XXXX-...",   // from chillerstats.com URL ?TeamID=
  //   name: "Team Name",           // overridden by /sync if chillerTeamId set
  //   opponents: [],               // overridden by /sync
  //   rinks: [],                   // overridden by /sync
  //   roster: [["", ""]],          // overridden by /sync
  //   defaults: {},
  //   logoMain: MAIN,              // base64 constant OR "https://..." URL
  //   logoMainAlt: "Team",
  //   logoFooter: [{src: CAHL, alt: "League"}],  // src: base64 constant OR "https://..." URL
  //   threeDefLines: true,         // set to true for teams with 3 defensive lines
  // }
};

export const DIVISIONS = [
  "Sunday B East","Sunday B West",
  "Sunday C East","Sunday C West",
  "Sunday C North A","Sunday C North B",
  "Sunday C South A","Sunday C South B","Sunday C South C",
  "NTPRD Chiller Sunday D league",
  "Monday D - East","Monday D - West A","Monday D - West B",
  "Tue NTPRD Chiller B","Tuesday B West A","Tuesday B West B",
  "Wednesday B East","Wednesday B West A","Wednesday B West B",
  "Women's league","Daytime League",
  "Thur NTPRD Chiller C","Thursday C East","Thursday C West","Thursday C North","Thursday C South",
  "Friday B",
];

export const CAHL_RINKS = [
  "North",
  "Dublin",
  "Easton",
  "Fairgrounds",
  "Chiller Ice Works",
  "OhioHealth Ice Haus",
];

export const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};
