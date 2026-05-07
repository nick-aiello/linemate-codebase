import { LINEMATE_LOGO_SVG, LINEMATE_ALT_PNG } from '../assets.js';

export async function handleAssetRoutes(request, env, url) {
  if (url.pathname === "/linemate-logo.svg") {
    return new Response(LINEMATE_LOGO_SVG, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
  }
  if (url.pathname === "/linemate-alt-logo.png") {
    return new Response(Uint8Array.from(atob(LINEMATE_ALT_PNG), c => c.charCodeAt(0)), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
  }
  return null;
}
