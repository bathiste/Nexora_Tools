# Pentest Beam API

REST API for authorized penetration testing and load testing.

## Quick Start

```bash
npm install
npm run api:dev
```

Server runs on `http://localhost:3000` by default. Set `PORT` env var to change.

## Authentication

All endpoints except `/health` require an API key header:
```
X-API-Key: your-api-key-here
```

## Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### Get Proxies
```
GET /proxies
```

Response:
```json
{
  "count": 50,
  "active": 48,
  "source": "data/proxies.txt"
}
```

### Get User Agents
```
GET /user-agents
```

### Start Attack
```
POST /attacks
```

Request body:
```json
{
  "target": "https://example.com",
  "duration": 60,
  "threads": 10,
  "rateLimit": 0,
  "method": "GET",
  "headers": {
    "Accept": "text/html"
  },
  "payload": "optional body for POST",
  "authorization": {
    "clientId": "client-123",
    "authorizedBy": "John Doe",
    "scope": "load-testing",
    "validUntil": "2024-01-16T10:00:00Z"
  }
}
```

Response:
```json
{
  "attackId": "attack-1705312800000-abc123",
  "status": "started",
  "config": {
    "target": "https://example.com",
    "duration": 60,
    "threads": 10,
    "method": "GET"
  },
  "authorization": {
    "clientId": "client-123",
    "authorizedBy": "John Doe"
  }
}
```

### List Attacks
```
GET /attacks
```

Response:
```json
{
  "attacks": [
    {
      "attackId": "attack-1705312800000-abc123",
      "status": "running",
      "target": "https://example.com",
      "startTime": "2024-01-15T10:00:00.000Z",
      "stats": {
        "totalRequests": 1500,
        "successfulRequests": 1480,
        "failedRequests": 20
      }
    }
  ],
  "count": 1
}
```

### Get Attack Details
```
GET /attacks/:attackId
```

### Get Attack Statistics
```
GET /attacks/:attackId/stats
```

Response:
```json
{
  "attackId": "attack-1705312800000-abc123",
  "status": "running",
  "stats": {
    "totalRequests": 1500,
    "successfulRequests": 1480,
    "failedRequests": 20,
    "bytesSent": 45000,
    "bytesReceived": 1250000,
    "startTime": "2024-01-15T10:00:00.000Z",
    "duration": 45.5,
    "rps": 32.97
  }
}
```

### Stop Attack
```
DELETE /attacks/:attackId
```

Response:
```json
{
  "attackId": "attack-1705312800000-abc123",
  "status": "stopped",
  "finalStats": {
    "totalRequests": 2000,
    "successfulRequests": 1950,
    "failedRequests": 50
  }
}
```

### Validate Proxies
```
POST /validate-proxies
```

Request body:
```json
{
  "proxyFile": "data/proxies.txt",
  "testUrl": "http://httpbin.org/ip"
}
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `PROXY_FILE` - Default proxy file path (default: data/proxies.txt)
- `UA_FILE` - Default user agents file path (default: data/uas.txt)

## Data Files

### Proxy Format
Place proxies in `data/proxies.txt`:
```
# Comments supported
socks5://127.0.0.1:1080
http://user:pass@proxy.example.com:8080
https://proxy.example.com:8080
```

### User Agent Format
Place user agents in `data/uas.txt` - one per line.
