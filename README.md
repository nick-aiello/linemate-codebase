# Linemate

A hockey lineup card web app for CAHL recreational league teams. Built on Cloudflare Workers with KV storage — no framework, no database, no server to maintain.

## Features

- Build and edit game lineups with drag-and-drop player assignment
- Auto-fill next game details from ChillerStats schedule
- Mark lineup as Set to save a snapshot to Lineup History
- View, share, print, or export lineup as PNG
- Manage roster (sync from ChillerStats or edit manually)
- Team settings: colors, logo, jersey options, forward/defense line count
- Mobile-friendly with full-screen hamburger nav
- Multi-team support — one account can manage multiple teams
- Game Notes field for powerplay lines, lineup changes, etc.

## Tech Stack

- **Runtime:** Cloudflare Workers (edge, no server)
- **Storage:** Cloudflare KV (sessions, lineups, rosters, history, logos)
- **Language:** Vanilla JavaScript (ES modules), no frontend framework
- **Fonts:** NHLChicago (embedded as base64)
- **Data source:** ChillerStats (schedule, roster, stats via HTML scraping)

## Project Structure

```
src/
  worker.js          # Entry point
  constants.js       # Team configs, slot definitions, divisions
  assets.js          # Base64 encoded fonts and logos
  routes/
    index.js         # Request router
    auth.js          # Login, signup, logout
    admin.js         # Superadmin panel
    team.js          # All team routes (lineup, roster, history, brand, stats)
    assets.js        # Static asset serving
  db/
    teams.js         # Team config resolution
    users.js         # User auth and management
    sessions.js      # Session creation and lookup
    chillerstats.js  # ChillerStats HTML scraping
  ui/
    css.js           # Shared CSS functions
    components.js    # Reusable HTML components (header, grid, nav, footer)
    pages/
      edit.js        # Lineup card editor
      view.js        # Read-only lineup view (share/print/PNG)
      roster.js      # Roster management
      history.js     # Lineup history
      brand.js       # Team settings
      stats.js       # Schedule, standings, and player stats
      auth.js        # Login and signup pages
      admin.js       # Admin panel
```

## Local Development

Requires Node.js and Wrangler CLI.

```bash
# Install dependencies
npm install -g wrangler

# Start local dev server (uses real Cloudflare KV)
wrangler dev --config wrangler.dev.toml

# Open in browser
open http://localhost:8787
```

The `wrangler.dev.toml` config runs the worker locally while connecting to the real KV namespace, so your login and data work as expected.

## Deploy

```bash
wrangler deploy
```

Deploys to `linemate-app.com` via the Cloudflare Workers route defined in `wrangler.toml`.

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production — deploys to linemate-app.com |
| `feature/chillerstats` | In progress — Schedule & Stats page, player stats in dropdowns, division standings |

## Environment

Requires a Cloudflare account with:
- A Workers project bound to this repo
- A KV namespace (`LINEUP_KV`) with the ID set in `wrangler.toml`
- A custom domain pointed at the Worker (optional)
