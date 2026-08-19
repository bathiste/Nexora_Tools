"""
proxy.py
--------
Parses and validates proxy configurations supporting HTTP, HTTPS, SOCKS4, and SOCKS5.

Each line in proxies.txt follows the format:
    protocol://[user:pass@]host:port

Where protocol is one of: http, https, socks4, socks5
"""
from __future__ import annotations

import re
import random
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse


SUPPORTED_PROTOCOLS = ("http", "https", "socks4", "socks5")

# Regex for the proxy URL format
_PROXY_RE = re.compile(
    r"^(?P<proto>https?|socks[45])://(?:(?P<user>[^:@]+):(?P<pass>[^@]+)@)?(?P<host>[^:/]+):(?P<port>\d{1,5})/?$",
    re.IGNORECASE,
)


@dataclass
class Proxy:
    """Represents a single proxy configuration."""

    proto: str
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None

    def to_url(self) -> str:
        """Return the proxy URL in httpx-compatible form."""
        auth = ""
        if self.username and self.password:
            auth = f"{self.username}:{self.password}@"
        return f"{self.proto}://{auth}{self.host}:{self.port}"

    def to_httpx_proxy(self) -> str:
        """Return a URL suitable for httpx.AsyncClient(proxy=...)."""
        # httpx accepts the same URL form
        return self.to_url()

    def is_socks(self) -> bool:
        return self.proto.lower() in ("socks4", "socks5")

    def is_http(self) -> bool:
        return self.proto.lower() in ("http", "https")

    def __str__(self) -> str:
        # Avoid leaking credentials in logs
        auth = ""
        if self.username:
            auth = f"{self.username}:***@"
        return f"{self.proto}://{auth}{self.host}:{self.port}"


class ProxyError(ValueError):
    """Raised when a proxy line is malformed."""


def parse_proxy_line(line: str) -> Optional[Proxy]:
    """
    Parse a single proxy line. Returns None for blank/comment lines,
    raises ProxyError for malformed lines.
    """
    raw = line.strip()
    if not raw or raw.startswith("#"):
        return None

    m = _PROXY_RE.match(raw)
    if not m:
        raise ProxyError(
            f"Invalid proxy format: '{raw}'. "
            f"Expected protocol://[user:pass@]host:port where protocol is one of {SUPPORTED_PROTOCOLS}"
        )

    proto = m.group("proto").lower()
    if proto not in SUPPORTED_PROTOCOLS:
        raise ProxyError(f"Unsupported proxy protocol: {proto}")

    return Proxy(
        proto=proto,
        host=m.group("host"),
        port=int(m.group("port")),
        username=m.group("user"),
        password=m.group("pass"),
    )


def load_proxies(path: str | Path = "proxies.txt") -> List[Proxy]:
    """Load and validate every proxy in the given file."""
    p = Path(path)
    if not p.exists():
        return []

    proxies: List[Proxy] = []
    for lineno, line in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
        try:
            proxy = parse_proxy_line(line)
        except ProxyError as exc:
            raise ProxyError(f"proxies.txt:{lineno}: {exc}") from exc
        if proxy is not None:
            proxies.append(proxy)
    return proxies


def pick_proxy(
    proxies: List[Proxy],
    *,
    proto: Optional[str] = None,
    prefer: Optional[str] = None,
) -> Optional[Proxy]:
    """
    Pick a proxy from the pool. If `proto` is given, restricts the choice
    to that protocol. If `prefer` is given, tries that protocol first.
    Returns None if the pool is empty.
    """
    if not proxies:
        return None

    pool = proxies
    if proto:
        pool = [p for p in proxies if p.proto.lower() == proto.lower()]
    elif prefer:
        pref = [p for p in proxies if p.proto.lower() == prefer.lower()]
        rest = [p for p in proxies if p.proto.lower() != prefer.lower()]
        pool = pref + rest

    if not pool:
        return None
    return random.choice(pool)


def proxies_to_httpx(proxies: List[Proxy]) -> dict:
    """
    Build an httpx mounts dict from a list of proxies.
    Returns a dict suitable for httpx.AsyncClient(mounts=...).
    """
    if not proxies:
        return {}

    mounts: dict = {}
    for proxy in proxies:
        url = proxy.to_url()
        mounts.setdefault(f"{proxy.proto}://", httpx_Proxy(url))
    return mounts


# Lazy import to avoid an import cycle / heavy dep at module import time
def httpx_Proxy(url: str):
    from httpx import Proxy
    return Proxy(url)
