# Gotham Render - Pentest Beam

Authorized penetration testing platform with Nexora-style dashboard.

## Features

- **Proxy Support:** SOCKS4, SOCKS5, HTTP, HTTPS with authentication
- **User Agent Rotation:** Auto-rotates through custom user agent lists
- **REST API:** Full HTTP API for integration with larger applications
- **Real-time Dashboard:** Nexora-inspired interface with cinematic intro
- **Audit Logging:** Complete request logging with proxy/UA tracking

## Quick Start

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start API server
npm run api

# Or run in development mode
npm run api:dev
```

## Dashboard

Visit `http://localhost:3000` to see the cinematic intro sequence:

1. Logo appears center screen
2. Modules load sequentially
3. At 3rd module, "GOTHAM RENDER" scrambles into view with blinking squares
4. Logo animates to corner
5. Diagonal wipe transition to dashboard

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/proxies` | List available proxies |
| GET | `/user-agents` | List user agents |
| POST | `/attacks` | Start new load test |
| GET | `/attacks` | List all tests |
| GET | `/attacks/:id` | Get test details |
| GET | `/attacks/:id/stats` | Get test statistics |
| DELETE | `/attacks/:id` | Stop test |

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

## Configuration

Place your proxies in `data/proxies.txt`:
```
socks5://127.0.0.1:1080
http://user:pass@proxy.example.com:8080
https://proxy.example.com:8080
```

Place user agents in `data/uas.txt` - one per line.

## Environment Variables

- `PORT` - Server port (default: 3000)
- `PROXY_FILE` - Proxy file path
- `UA_FILE` - User agents file path

## CLI Mode

The tool also supports CLI operation:

```bash
npm run dev -- attack \
  -t https://example.com \
  -d 60 \
  --threads 10 \
  --client-id client-123 \
  --authorized-by "John Doe"
```
