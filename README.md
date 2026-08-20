# Passcode entry

Next.js + TypeScript recreation of the four passcode-entry states from the
Greptile Take-home. 

## Run locally

Requires **Node 18.18+** (developed on 24.4). No other tooling, no environment
variables, no services.

```bash
git clone https://github.com/laurenjun/passcode-entry.git
cd passcode-entry
npm install
npm run dev
```

Then open <http://localhost:3000>.

| Script | |
| --- | --- |
| `npm run dev` | dev server on :3000 |
| `npm run build` | production build |
| `npm start` | serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

`/` is the only route: the live component, centered on the page. The field
autofocuses on load. The passcode is **1234** — type it and it submits on the
fourth digit; type anything else to see the rejection. Enter also submits.