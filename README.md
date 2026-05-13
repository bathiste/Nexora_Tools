# Nexora Gotham Platform

Authorized penetration testing platform with Nexora-inspired cinematic dashboard.
Built with Node.js, TypeScript, Electron, and a modular API architecture.

---

## Features

- **Modern REST API** — Full HTTP API for load testing, asset scanning, CVE enrichment, and AI-assisted analysis
- **Real‑time Dashboard** — Nexora‑inspired interface with animated intro, custom titlebar, and responsive tool navigation
- **Proxy & UA Rotation** — SOCKS4 / SOCKS5 / HTTP / HTTPS proxy support with auto‑rotation and user‑agent cycling
- **Attack Engine** — Multi‑threaded HTTP(S) attack engine for authorized penetration testing
- **AI Assistant** — Ollama‑powered chat assistant for threat intelligence and payload guidance
- **CVE Scanner** — Full‑featured vulnerability scanner with PostgreSQL pipeline, PoC tracking, and Nuclei integration
- **Electron Shell** — Desktop application with frameless window, custom titlebar controls, and IPC integration

---

## Project Structure

```
palantir workstation/
├── dashboard/               # Static HTML dashboard pages
│   ├── shared.js            # Shell renderer, navigation, placeholder data
│   ├── shared.css           # Global styles / design system
│   ├── index.html           # Cinematic boot animation (1770 lines)
│   ├── dashboard.html       # Platform overview placeholder
│   ├── nmap.html            # Tool placeholder (shared template)
│   ├── metasploit.html      # Tool placeholder (shared template)
│   ├── burpsuite.html       # Tool placeholder (shared template)
│   ├── maltego.html         # Tool placeholder (shared template)
│   ├── ai.html              # Tool placeholder (shared template)
│   ├── recon.html           # Recon tool with full UI (644 lines)
│   ├── settings.html        # API key / tool configuration (788 lines)
│   └── threatmap.html       # Interactive global threat map (691 lines)
├── src/
│   ├── api.ts               # Express REST API (endpoints, middleware)
│   ├── utils.ts             # Shared utilities (sendError, loadProxies, loadUserAgents)
│   ├── attackEngine.ts      # Multi-threaded attack engine
│   ├── proxyManager.ts      # Proxy pool management
│   ├── userAgents.ts        # User-Agent rotation
│   ├── logger.ts            # Request / audit logging
│   ├── ai-assistant.ts      # Ollama AI assistant
│   ├── hybrid-encryption.ts # Encryption helpers
│   ├── secure-storage.ts    # Secure credential storage
│   ├── index.ts             # CLI entry point
│   ├── types.ts             # Shared TypeScript interfaces
│   └── scanner/             # CVE scanner pipeline
│       ├── pipeline.ts
│       └── types.ts
├── main.js                  # Electron main process
├── preload.js               # Electron preload script
├── data/
│   ├── proxies.txt          # Proxy list (one per line)
│   └── uas.txt              # Custom user agents (one per line)
└── package.json
```

---

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start API server
npm run api

# Or run in development mode with auto‑reload
npm run api:dev

# Launch Electron desktop app
npm start
```

---

## API Endpoints

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

### Proxy & User‑Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/proxies` | List available proxies |
| POST | `/validate-proxies` | Validate proxy file |
| GET | `/user-agents` | List available user agents |

### Attack Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/attacks` | Start new load test |
| GET | `/attacks` | List all active/stopped tests |
| GET | `/attacks/:id` | Get test details |
| DELETE | `/attacks/:id` | Stop a test |
| GET | `/attacks/:id/stats` | Get test statistics |

### AI Assistant

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ai/status` | Check Ollama availability |
| POST | `/ai/start` | Start Ollama server |
| POST | `/ai/install-model` | Install dolphin‑llama3 model |
| POST | `/ai/chat` | Send a chat message |
| GET | `/ai/history` | Get chat history |
| POST | `/ai/clear` | Clear chat history |

### CVE Scanner

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/scanner/scans` | Create a new scan |
| GET | `/scanner/scans` | List all scans |
| GET | `/scanner/scans/:id` | Get scan details |
| GET | `/scanner/scans/:id/progress` | Get scan progress |
| POST | `/scanner/scans/:id/cancel` | Cancel a scan |
| GET | `/scanner/scans/:id/results` | Get scan results |
| GET | `/scanner/scans/:id/subdomains` | Get discovered subdomains |
| GET | `/scanner/scans/:id/ports` | Get open ports |
| GET | `/scanner/targets` | List targets |
| POST | `/scanner/targets` | Add a target |
| GET | `/scanner/cves` | Search CVE database |
| GET | `/scanner/cves/:id` | Get CVE details with PoCs |
| GET | `/scanner/stats` | Scanner summary statistics |

### Start Attack Example

```bash
curl -X POST http://localhost:3000/attacks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{
    "target": "https://example.com",
    "duration": 60,
    "threads": 10,
    "authorization": {
      "clientId": "client-123",
      "authorizedBy": "John Doe"
    }
  }'
```

---

## Configuration

### Proxy List (`data/proxies.txt`)

```
socks5://127.0.0.1:1080
http://user:pass@proxy.example.com:8080
https://proxy.example.com:8080
socks4://192.168.1.1:4145
```

### User Agents (`data/uas.txt`)

Add one custom user‑agent per line. Built‑in defaults are automatically merged.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `PROXY_FILE` | `data/proxies.txt` | Proxy file path |
| `UA_FILE` | `data/uas.txt` | User‑agents file path |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `gotham` | PostgreSQL database |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |

### Database Setup

```bash
# Create the PostgreSQL database
.\create-db.ps1

# Or manually:
createdb gotham
psql -d gotham -f schema.sql
```

---

## Dashboard

Visit `http://localhost:3000` to see the cinematic intro sequence:

1. Logo appears centre-screen with animated rings
2. Grid pattern builds with squares and X marks
3. "GOTHAM" scrambles into view with blinking cells
4. Flicker transition to loading modules
5. Logo animates to upper-left corner
6. Platform title with underline, vertical separator
7. Side navigation with three categories: Main, Applications, Analytics

The dashboard is served as a static site from `/dashboard`. The shell (titlebar, window border, navigation) is generated by `shared.js:initShell()`. Placeholder tool pages share a single template via `initToolPage()`.

---

## Development

### Linter & TypeScript

```bash
npm run build     # Full TypeScript compilation
npm run start     # Compile & run API
npm run dev       # Run directly with ts-node
```

### Dependencies

- **express** / **cors** — HTTP server & middleware
- **pg** — PostgreSQL client (scanner pipeline)
- **electron** — Desktop application shell
- **socks‑proxy‑agent**, **http‑proxy‑agent**, **https‑proxy‑agent** — Proxy agents
- **puppeteer** — Headless browsing (screenshots)
- **commander** — CLI argument parsing

---

## Coding Conventions

- All HTTP error responses use the shared `sendError(res, error, fallback)` helper from `src/utils.ts` — this eliminates repetitive `error instanceof Error` checks.
- Proxy / user‑agent loading goes through `loadProxies()` / `loadUserAgents()` — never inline file I/O.
- The `ProxyManager.parseProxyString` is the single source of truth for proxy parsing; `src/api.ts` and `src/utils.ts` both delegate to it.
- Dashboard placeholder pages do **not** contain any inline content — all placeholder text lives in the `PLACEHOLDER_PAGES` lookup table inside `shared.js` and is rendered by `initToolPage()`.
- CSS is kept DRY: the `.overview .tool-item` class prefix was eliminated because those rules were identical to the base `.tool-item` block.

---

## License & Legal Notice

Copyright (c) 2026 Nexora Gotham Platform

This project is provided for educational, research, defensive security, and authorized penetration testing purposes only.

By using, copying, modifying, compiling, distributing, or executing this software, you agree to the following terms:

- You are solely responsible for complying with all applicable local, national, and international laws and regulations.
- Unauthorized access, disruption, denial-of-service activity, exploitation, surveillance, or interference against systems you do not own or explicitly control may violate criminal and civil law in your jurisdiction.
- The authors, contributors, maintainers, affiliates, and distributors of this project assume no liability for:
  - misuse or unlawful operation of the software,
  - damages resulting from execution or deployment,
  - data loss,
  - service interruption,
  - legal consequences,
  - third-party claims,
  - security incidents,
  - financial losses,
  - indirect or consequential damages of any kind.

This software is provided "AS IS", without warranty of any kind, express or implied, including but not limited to:
- merchantability,
- fitness for a particular purpose,
- non-infringement,
- operational reliability,
- security guarantees.

The user assumes all risk associated with use, modification, testing, networking activity, and deployment.

You are responsible for ensuring that all testing activity is:
- explicitly authorized,
- documented,
- contractually permitted where applicable,
- compliant with the laws of your country and the target jurisdiction.

The developers do not endorse or authorize illegal cyber activity.

If any portion of this license or disclaimer is found unenforceable under applicable law, the remaining sections shall remain in full effect.

Use of this software constitutes acceptance of these terms.
