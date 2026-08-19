"""
accounts.py
-----------
Thin wrapper around twscrape's API for managing Twitter/X accounts.

Account file format (accounts.txt): user:pass:email:email_pass
Lines starting with # are ignored.
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import List, Optional

import twscrape


def parse_account_line(line: str) -> Optional[twscrape.Account]:
    raw = line.strip()
    if not raw or raw.startswith("#"):
        return None
    parts = raw.split(":")
    if len(parts) < 2:
        raise ValueError(
            f"Invalid account line: '{raw}'. Expected 'user:pass[:email:email_pass]'"
        )
    user, pwd = parts[0], parts[1]
    email = parts[2] if len(parts) >= 3 else ""
    email_pwd = parts[3] if len(parts) >= 4 else ""
    return twscrape.Account(
        username=user,
        password=pwd,
        email=email or f"{user}@example.com",
        email_password=email_pwd or "",
    )


def load_accounts(path: str | Path = "accounts.txt") -> List[twscrape.Account]:
    p = Path(path)
    if not p.exists():
        return []
    accounts: List[twscrape.Account] = []
    for lineno, line in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
        try:
            acc = parse_account_line(line)
        except ValueError as exc:
            raise ValueError(f"accounts.txt:{lineno}: {exc}") from exc
        if acc is not None:
            accounts.append(acc)
    return accounts


async def add_accounts(
    api: twscrape.API,
    accounts: List[twscrape.Account],
) -> List[str]:
    """Add accounts to the twscrape pool. Returns list of added usernames."""
    added: List[str] = []
    for acc in accounts:
        try:
            await api.pool.add_account(acc.username, acc.password, acc.email, acc.email_password)
            added.append(acc.username)
        except Exception as exc:  # pragma: no cover - depends on twscrape internals
            print(f"[!] Failed to add {acc.username}: {exc}")
    return added


async def login_all(api: twscrape.API) -> None:
    """Log in every account in the pool."""
    await api.pool.login_all()


def get_api() -> twscrape.API:
    """Get a fresh twscrape API instance."""
    return twscrape.API()
