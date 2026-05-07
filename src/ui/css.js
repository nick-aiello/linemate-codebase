import { FONT } from '../assets.js';

export function fontFaceCSS() {
  return "@font-face{font-family:'NHLChicago';src:url('data:font/truetype;base64," + FONT + "')format('truetype');}";
}

export function sharedCSS(config) {
  var c = (config && config.primaryColor) || "#c0392b";
  return fontFaceCSS()
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{font-family:'NHLChicago',Arial,sans-serif;background:#f5f2ec}"
    + ".card{background:#f5f2ec;padding:24px;max-width:860px;margin:0 auto}"
    + ".header{display:flex;align-items:flex-start;gap:20px;margin-bottom:20px}"
    + ".main-logo{width:175px;height:175px;flex-shrink:0;object-fit:contain}"
    + ".header-text{flex:1;text-align:center}"
    + ".team-title{font-size:30px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a}"
    + ".game-info{margin-top:8px}"
    + ".game-line{display:flex;align-items:center;justify-content:center;gap:4px;margin:4px 0;flex-wrap:nowrap}"
    + ".game-line span{font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#1a1a1a}"
    + ".grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px}"
    + ".grid-bottom{align-items:start}"
    + ".section{background:white;border-radius:4px;overflow:hidden}"
    + ".section-header{background:"+c+";padding:6px 12px;text-align:center}"
    + ".section-header span{color:white;font-size:12px;text-transform:uppercase;letter-spacing:2px}"
    + ".player-row{display:flex;align-items:center;padding:10px 12px;min-height:64px;border-bottom:1px solid #f0ede8}"
    + ".player-row:last-child{border-bottom:none}"
    + ".player-number{font-size:28px;color:#1a1a1a;min-width:38px;line-height:1}"
    + ".footer{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:16px;padding-top:12px;border-top:1px solid #e8e5e0}"
    + ".footer-logo{height:36px;object-fit:contain;opacity:.7}"
    + ".top-bar{display:flex;justify-content:space-between;align-items:center;max-width:860px;margin:0 auto 12px;padding:12px 24px 0}"
    + ".at-rink{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}"
    + "@media(max-width:599px){body{overflow-x:hidden}.card{padding:14px}.header{align-items:center}.main-logo{width:125px;height:125px}.player-row{flex-direction:column;align-items:flex-start;padding:6px 8px;min-height:70px;justify-content:center}.player-number{font-size:20px;min-width:unset;line-height:1.1}.section-header span{font-size:10px;letter-spacing:1px}.team-title{font-size:20px;letter-spacing:1px}.game-line{flex-wrap:wrap;justify-content:center}.game-line span{font-size:13px;letter-spacing:.5px}.grid{gap:6px}.section-header{padding:5px 8px}}"
    + "@media(min-width:600px){.game-line span{font-size:17px}.player-number{font-size:36px;min-width:52px}.section-header span{font-size:12px}}"
    + ".game-notes-wrap{background:white;border-radius:4px;padding:16px 18px;margin-top:10px}"
    + ".game-notes-label{display:flex;align-items:center;gap:6px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#aaa;margin-bottom:8px}"
    + ".game-notes-body{font-family:'NHLChicago',Arial,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;word-break:break-word}"
    + "textarea.game-notes-input{width:100%;border:none;outline:none;resize:none;font-family:'NHLChicago',Arial,sans-serif;font-size:13px;color:#1a1a1a;background:transparent;line-height:1.7;min-height:64px}"
    + "textarea.game-notes-input::placeholder{color:#ccc}"
    + "@media print{.top-bar{display:none!important}body{background:#f5f2ec}}";
}

function hexToFilter(hex) {
  if (!hex || hex.length < 7) hex = "#c0392b";
  var r = parseInt(hex.slice(1,3),16)/255;
  var g = parseInt(hex.slice(3,5),16)/255;
  var b = parseInt(hex.slice(5,7),16)/255;
  var max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  var h=0, s=0, l=(max+min)/2;
  if (d) {
    s = d / (l > 0.5 ? 2-max-min : max+min);
    if (max===r) h = ((g-b)/d + (g<b?6:0)) / 6;
    else if (max===g) h = ((b-r)/d + 2) / 6;
    else h = ((r-g)/d + 4) / 6;
  }
  h = Math.round(h*360);
  s = Math.round(s*100);
  l = Math.round(l*100);
  // sepia(1) from white ≈ hue 35°, sat 73%, lightness 56%
  var hRot = ((h - 35) + 360) % 360;
  var sat  = Math.max(0, Math.round(s / 73 * 100));
  var brt  = Math.max(0, Math.round(l / 56 * 100));
  return "invert(1)sepia(1)hue-rotate("+hRot+"deg)saturate("+sat+"%)brightness("+brt+"%)";
}

export function editCSS(config) {
  var c = (config && config.primaryColor) || "#c0392b";
  var cd = darkenHex(c);
  var cEnc = c.replace("#", "%23");
  var iconFilter = hexToFilter(c);
  return (sharedCSS(config)
    + ".game-info input,.game-info select{background:white;border:1px solid #e0ddd8;border-radius:4px;font-family:'NHLChicago',Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;font-size:14px;color:#1a1a1a;text-align:center;outline:none;cursor:pointer;-webkit-appearance:none;appearance:none}"
    + ".game-info input{padding:7px 8px 5px;line-height:1}"
    + ".game-info select{padding:0 18px 0 8px;height:32px;line-height:32px;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23c0392b'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 4px center}"
    + ".game-info input:focus,.game-info select:focus{border-color:#c0392b}"
    + ".game-info input[type=date]::-webkit-calendar-picker-indicator,.game-info input[type=time]::-webkit-calendar-picker-indicator{opacity:.8;cursor:pointer;filter:" + iconFilter + ";width:14px;height:14px;padding:0;margin:0 0 0 4px;display:block;position:relative;top:1px}"
    + ".vs-input{width:180px}.time-input{width:100px}.rink-select{min-width:90px}"
    + ".cs{width:100%}"
    + ".cs-btn{width:100%;background:transparent;border:none;font-family:'NHLChicago',Arial,sans-serif;font-size:12px;color:#1a1a1a;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;text-align:left;padding:2px 0;display:flex;align-items:center;justify-content:space-between;gap:4px;outline:none}"
    + ".cs-lbl{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".cs-arrow{display:inline-block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #c0392b;flex-shrink:0}"
    + "#pp-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;align-items:flex-end;justify-content:center}"
    + "#pp-overlay.open{display:flex}"
    + "#pp-panel{background:white;border-radius:12px 12px 0 0;width:100%;max-height:75vh;overflow-y:auto;overscroll-behavior:contain}"
    + "#pp-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #eee;position:sticky;top:0;background:white;z-index:1}"
    + "#pp-header span{font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#1a1a1a}"
    + ".pp-close{background:none;border:none;font-size:20px;cursor:pointer;color:#888;padding:0;line-height:1}"
    + ".pp-opt{padding:13px 20px;font-family:'NHLChicago',Arial,sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;border-bottom:1px solid #f5f2ec;color:#1a1a1a}"
    + ".pp-opt:not(.pp-used):active,.pp-opt:not(.pp-used):hover{background:#f5f2ec}"
    + ".pp-sel{color:#c0392b}"
    + ".pp-used{color:#ccc;cursor:default}"
    + ".pp-sep{padding:5px 20px;font-family:'NHLChicago',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#aaa;background:#f5f2ec}"
    + "@media(min-width:600px){"
    + "#pp-overlay{background:transparent;align-items:flex-start;justify-content:flex-start}"
    + "#pp-panel{border-radius:4px;width:auto;max-height:260px;position:fixed;box-shadow:0 4px 16px rgba(0,0,0,.18)}"
    + "#pp-header{display:none}"
    + ".pp-opt{padding:7px 12px;font-size:12px}}"
    + ".save-status{font-family:'NHLChicago',Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888}"
    + ".save-status.saved{color:#27ae60}.save-status.saving{color:#e67e22}"
    + ".fab{position:relative;z-index:100}"
    + ".fab-btn{background:none;color:#888;border:none;font-size:22px;cursor:pointer;padding:0 4px;line-height:1;display:flex;align-items:center}"
    + ".fab-btn:hover{color:#1a1a1a}"
    + ".fab-menu{display:none;position:absolute;top:calc(100% + 8px);right:0;background:white;border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,.15);min-width:210px;overflow:visible}"
    + ".fab-menu.open{display:block}"

    + ".fab-item{display:flex;align-items:center;width:100%;text-align:left;padding:13px 20px;font-family:'NHLChicago',Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;background:none;border:none;cursor:pointer;color:#1a1a1a;white-space:nowrap;text-decoration:none}"
    + ".fab-item:hover{background:#f5f2ec}"
    + ".fab-item.active{color:#c0392b}"
    + ".fab-item.danger{color:#c0392b}"
    + ".fab-item{border-bottom:1px solid #f0ede8}"
    + ".fab-divider{display:none}"
    + ".fab-section-label{font-family:'NHLChicago',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#aaa;padding:8px 20px 6px;background:#f5f2ec;border-bottom:1px solid #e8e5e0}"
    + ".fab-item-tip{position:relative;margin-left:auto;padding-left:10px;flex-shrink:0}"
    + ".fab-tip-icon{font-size:11px;color:#ccc;cursor:default;line-height:1}"
    + ".fab-tip-text{display:none;position:absolute;right:calc(100% + 8px);top:50%;transform:translateY(-50%);background:#1a1a1a;color:white;font-family:'NHLChicago',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:6px 10px;border-radius:4px;width:175px;line-height:1.6;pointer-events:none;white-space:normal;z-index:200}"
    + ".fab-item-tip:hover .fab-tip-text{display:block}"
    + ".fab-close{display:none;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #eee;position:sticky;top:0;background:white;z-index:1}"
    + ".fab-close-title{font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a}"
    + ".fab-close-btn{background:none;border:none;font-size:22px;cursor:pointer;color:#888;padding:0;line-height:1}"
    + ".fab-close-btn:hover{color:#1a1a1a}"
    + "@media(max-width:599px){.fab-menu.open{position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:0!important;min-width:unset!important;border-radius:0!important;overflow-y:auto!important;z-index:200!important;display:flex!important;flex-direction:column!important}.fab-close{display:flex!important}.fab-item{flex-direction:column!important;align-items:flex-start!important;padding:14px 24px!important;gap:2px!important;white-space:normal!important}.fab-section-label{padding:10px 24px!important}.fab-item-tip{margin-left:0!important;padding-left:0!important;position:static!important}.fab-tip-icon{display:none!important}.fab-tip-text{display:block!important;position:static!important;transform:none!important;background:none!important;color:#aaa!important;font-size:9px!important;padding:0!important;width:auto!important;border-radius:0!important;pointer-events:auto!important;z-index:auto!important}}"
    + ".next-game-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;background:white;border-radius:4px;padding:9px 14px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.06);border-left:3px solid #c0392b}"
    + ".next-game-text{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#555;flex:1;min-width:0}"
    + ".next-game-text strong{color:#1a1a1a;letter-spacing:.5px}"
    + ".next-game-load{background:#c0392b;color:white;border:none;border-radius:3px;padding:5px 12px;font-family:'NHLChicago',Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;cursor:pointer;white-space:nowrap;flex-shrink:0}"
    + ".next-game-load:hover{opacity:.85}"
    + ".set-bar{position:fixed;bottom:0;left:0;right:0;background:white;border-top:1px solid #eee;padding:10px 24px;z-index:50;box-shadow:0 -2px 8px rgba(0,0,0,.07)}"
    + ".set-bar-inner{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:12px}"
    + ".set-check{display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;user-select:none}"
    + ".check-box{width:18px;height:18px;border:2px solid #ccc;border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;transition:background .15s,border-color .15s;color:white}"
    + ".check-box.checked{background:#27ae60;border-color:#27ae60}"
    + ".set-label{font-family:'NHLChicago',Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#1a1a1a}"
    + ".set-count{font-family:'NHLChicago',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#aaa}"
    + ".set-count.complete{color:#27ae60}"
    + ".set-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}"
    + ".clear-bar-btn{background:none;border:none;font-family:'NHLChicago',Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#bbb;cursor:pointer;white-space:nowrap;padding:4px 0}"
    + ".clear-bar-btn:hover{color:#c0392b}"
    + ".info-wrap{position:relative;display:inline-flex;align-items:center}"
    + ".info-icon{font-size:12px;color:#ccc;cursor:default;line-height:1;margin-left:4px}"
    + ".info-tip{display:none;position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#1a1a1a;color:white;font-family:'NHLChicago',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:7px 10px;border-radius:4px;width:190px;line-height:1.6;pointer-events:none;text-align:center}"
    + ".info-wrap:hover .info-tip{display:block}"
    + "@media(min-width:600px){.game-info input,.game-info select{font-size:17px}.game-info select{height:36px;line-height:36px}.vs-input{width:220px}.time-input{width:145px}.rink-select{min-width:90px}.cs-btn{font-size:16px}}")
    .replace(new RegExp("#c0392b", "g"), c)
    .replace(new RegExp("%23c0392b", "g"), cEnc)
    .replace(new RegExp("#a93226", "g"), cd);
}

export function fabCSS(config) {
  var c = (config && config.primaryColor) || "#c0392b";
  return ".fab{position:relative;z-index:100}"
    + ".fab-btn{background:none;color:#888;border:none;font-size:22px;cursor:pointer;padding:0 4px;line-height:1;display:flex;align-items:center}"
    + ".fab-btn:hover{color:#1a1a1a}"
    + ".fab-menu{display:none;position:absolute;top:calc(100% + 8px);right:0;background:white;border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,.15);min-width:210px;overflow:visible}"
    + ".fab-menu.open{display:block}"

    + ".fab-item{display:flex;align-items:center;width:100%;text-align:left;padding:13px 20px;font-family:'NHLChicago',Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:1px;background:none;border:none;cursor:pointer;color:#1a1a1a;white-space:nowrap;text-decoration:none}"
    + ".fab-item:hover{background:#f5f2ec}"
    + ".fab-item.active{color:" + c + "}"
    + ".fab-item.danger{color:#c0392b}"
    + ".fab-item{border-bottom:1px solid #f0ede8}"
    + ".fab-divider{display:none}"
    + ".fab-section-label{font-family:'NHLChicago',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#aaa;padding:8px 20px 6px;background:#f5f2ec;border-bottom:1px solid #e8e5e0}"
    + ".fab-item-tip{position:relative;margin-left:auto;padding-left:10px;flex-shrink:0}"
    + ".fab-tip-icon{font-size:11px;color:#ccc;cursor:default;line-height:1}"
    + ".fab-tip-text{display:none;position:absolute;right:calc(100% + 8px);top:50%;transform:translateY(-50%);background:#1a1a1a;color:white;font-family:'NHLChicago',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:6px 10px;border-radius:4px;width:175px;line-height:1.6;pointer-events:none;white-space:normal;z-index:200}"
    + ".fab-item-tip:hover .fab-tip-text{display:block}"
    + ".fab-close{display:none;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #eee;position:sticky;top:0;background:white;z-index:1}"
    + ".fab-close-title{font-family:'NHLChicago',Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a}"
    + ".fab-close-btn{background:none;border:none;font-size:22px;cursor:pointer;color:#888;padding:0;line-height:1}"
    + ".fab-close-btn:hover{color:#1a1a1a}"
    + "@media(max-width:599px){.fab-menu.open{position:fixed!important;top:0!important;right:0!important;bottom:0!important;left:0!important;min-width:unset!important;border-radius:0!important;overflow-y:auto!important;z-index:200!important;display:flex!important;flex-direction:column!important}.fab-close{display:flex!important}.fab-item{flex-direction:column!important;align-items:flex-start!important;padding:14px 24px!important;gap:2px!important;white-space:normal!important}.fab-section-label{padding:10px 24px!important}.fab-item-tip{margin-left:0!important;padding-left:0!important;position:static!important}.fab-tip-icon{display:none!important}.fab-tip-text{display:block!important;position:static!important;transform:none!important;background:none!important;color:#aaa!important;font-size:9px!important;padding:0!important;width:auto!important;border-radius:0!important;pointer-events:auto!important;z-index:auto!important}}"
    + ".fab-sync-row{display:flex;align-items:center;gap:6px;padding:6px 14px;border-bottom:1px solid #e8e5e0;background:white;justify-content:flex-start}"
    + ".fab-sync-row.stale{background:#fff8f0}"
    + ".fab-sync-dot{width:7px;height:7px;border-radius:50%;background:#27ae60;flex-shrink:0}"
    + ".fab-sync-row.stale .fab-sync-dot{background:#e65100}"
    + ".fab-sync-label{font-family:'NHLChicago',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#999;flex:1}"
    + ".fab-sync-row.stale .fab-sync-label{color:#e65100}"
    + ".fab-sync-btn{background:none;border:1px solid #e65100;border-radius:3px;font-family:'NHLChicago',Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#e65100;cursor:pointer;padding:2px 8px;white-space:nowrap;flex-shrink:0}"
    + ".fab-sync-btn:hover{background:#e65100;color:white}";
}

// darkenHex is also needed in editCSS, so export it here
export function darkenHex(hex) {
  var r = Math.max(0, Math.round(parseInt(hex.slice(1,3),16) * 0.82));
  var g = Math.max(0, Math.round(parseInt(hex.slice(3,5),16) * 0.82));
  var b = Math.max(0, Math.round(parseInt(hex.slice(5,7),16) * 0.82));
  return "#" + [r,g,b].map(function(v){return v.toString(16).padStart(2,"0");}).join("");
}
