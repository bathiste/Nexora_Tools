# 🐦 Twitter Scraper with Proxy Support

A drop-in scraper built on top of [`twscrape`](https://github.com/AltamarLTD/twscrape) that adds **HTTP / HTTPS / SOCKS4 / SOCKS5 proxy** support, account pooling, and a CLI that mirrors the standard `twscrape` command set.

---

## Features

- ✅ All 20 official `twscrape` commands (`search`, `tweet_details`, `user_tweets`, `community_*`, `trends`, …)
- ✅ Proxy rotation: **HTTP, HTTPS, SOCKS4, SOCKS5** (authenticated and non-authenticated)
- ✅ Per-protocol preference (`--prefer socks5`)
- ✅ Configurable pool of accounts loaded from `accounts.txt`
- ✅ Pretty-printed tables (via `rich`) **or** raw JSON (`--json`)
- ✅ Programmatic API for use inside your own code

---

## Installation

```bash
pip install -r requirements.txt
```

> **Note:** `httpx[socks]` is required for SOCKS4/SOCKS5 proxy support.

---

## Quick start

### 1. Configure proxies — `proxies.txt`

One proxy per line, format: `protocol://[user:pass@]host:port`

```text
# HTTP
http://user:pass@127.0.0.1:8080

# HTTPS
https://user:pass@127.0.0.1:8443

# SOCKS4
socks4://127.0.0.1:1080

# SOCKS5
socks5://user:pass@127.0.0.1:1080
```

Lines starting with `#` are ignored. Leave the file empty to disable proxies (direct connection).

### 2. Add accounts — `accounts.txt`

```text
# format: user:password[:email:email_password]
alice:mypassword123:alice@gmail.com:email-password-here
bob:anothersecret456:bob@protonmail.com:
```

### 3. Run the scraper

```bash
# Add accounts to the pool (one-time)
python twscrape_cli.py add_accounts accounts.txt

# Log them in
python twscrape_cli.py login_all

# Search
python twscrape_cli.py search "QUERY" --limit=20

# Look up a user
python twscrape_cli.py user_by_login elonmusk

# Get a user's tweets
python twscrape_cli.py user_tweets 44196397 --limit=20

# JSON output
python twscrape_cli.py search "QUERY" --json
```

---

## All commands

| Command                              | Example                                                          |
| ------------------------------------ | ---------------------------------------------------------------- |
| `search`                             | `python twscrape_cli.py search "QUERY" --limit=20`               |
| `tweet_details`                      | `python twscrape_cli.py tweet_details 1234567890`                |
| `tweet_replies`                      | `python twscrape_cli.py tweet_replies 1234567890 --limit=20`     |
| `tweet_thread`                       | `python twscrape_cli.py tweet_thread 1234567890 --limit=20`      |
| `retweeters`                         | `python twscrape_cli.py retweeters 1234567890 --limit=20`        |
| `user_by_login`                      | `python twscrape_cli.py user_by_login elonmusk`                  |
| `user_about`                         | `python twscrape_cli.py user_about elonmusk`                     |
| `user_media`                         | `python twscrape_cli.py user_media 44196397 --limit=20`          |
| `following`                          | `python twscrape_cli.py following 44196397 --limit=20`           |
| `followers`                          | `python twscrape_cli.py followers 44196397 --limit=20`           |
| `verified_followers`                 | `python twscrape_cli.py verified_followers 44196397 --limit=20`  |
| `subscriptions`                      | `python twscrape_cli.py subscriptions 44196397 --limit=20`        |
| `user_tweets`                        | `python twscrape_cli.py user_tweets 44196397 --limit=20`         |
| `user_tweets_and_replies`            | `python twscrape_cli.py user_tweets_and_replies 44196397`        |
| `list_timeline`                      | `python twscrape_cli.py list_timeline 12345 --limit=20`          |
| `list_members`                       | `python twscrape_cli.py list_members 12345 --limit=20`           |
| `community_info`                     | `python twscrape_cli.py community_info 12345`                    |
| `community_members`                  | `python twscrape_cli.py community_members 12345 --limit=20`      |
| `community_moderators`               | `python twscrape_cli.py community_moderators 12345 --limit=20`   |
| `community_tweets`                   | `python twscrape_cli.py community_tweets 12345 --limit=20`       |
| `trends`                             | `python twscrape_cli.py trends sport`                            |

### Global options

```
--limit N          Max number of results (default 20)
--json             Print raw JSON instead of a table
--proxy-file PATH  Path to proxies.txt (default: proxies.txt)
--no-rotate        Disable proxy rotation between calls
--prefer PROTO     Prefer this protocol when rotating: http|https|socks4|socks5
```

---

## Programmatic usage

See [`example.py`](./example.py):

```python
import asyncio
from scraper import ScraperConfig, TwitterScraper, print_table

async def main():
    cfg = ScraperConfig(
        proxies_file="proxies.txt",
        proxy_rotate=True,
        prefer_proto="socks5",
    )
    scraper = TwitterScraper(cfg)

    tweets = await scraper.search("python programming", limit=10)
    print_table(tweets)

    user = await scraper.user_by_login("elonmusk")
    more = await scraper.user_tweets(user.id, limit=20)
    print_table(more)

asyncio.run(main())
```

---

## File overview

| File               | Purpose                                                       |
| ------------------ | ------------------------------------------------------------- |
| `proxy.py`         | Parse and validate `proxies.txt` (HTTP/HTTPS/SOCKS4/SOCKS5)   |
| `accounts.py`      | Load accounts from `accounts.txt` and add to the twscrape pool |
| `scraper.py`       | High-level `TwitterScraper` class that wires up proxies        |
| `twscrape_cli.py`  | Click-based CLI with all 20 commands                          |
| `example.py`       | Programmatic usage example                                    |
| `proxies.txt`      | Your proxy list                                               |
| `accounts.txt`     | Your account list                                             |
| `requirements.txt` | Python dependencies                                           |

---

## Troubleshooting

- **`httpx.ProxyError: ...` with SOCKS proxies** → make sure you installed `httpx[socks]` (`pip install httpx[socks]`).
- **`ProxyError: Invalid proxy format`** → verify each line is `protocol://[user:pass@]host:port` and that the protocol is one of `http`, `https`, `socks4`, `socks5`.
- **No results** → the twscrape account pool is empty. Run `python twscrape_cli.py add_accounts accounts.txt && python twscrape_cli.py login_all` first.
- **Rate-limited / suspended** → add more accounts or proxies, or enable rotation with `--prefer socks5`.
