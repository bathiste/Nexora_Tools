"""
scraper.py
----------
High-level scraper that wires up twscrape with HTTP/HTTPS/SOCKS4/SOCKS5 proxy support
and exposes every twscrape command as a thin async function.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, List, Optional

import twscrape
from twscrape import API

from proxy import Proxy, load_proxies, pick_proxy


log = logging.getLogger("twitterscraper")


@dataclass
class ScraperConfig:
    proxies_file: str = "proxies.txt"
    proxy_rotate: bool = True
    prefer_proto: Optional[str] = None  # "http", "https", "socks4", "socks5"


class TwitterScraper:
    """
    Wrapper around twscrape.API that injects proxy support.

    Each call can rotate the proxy (if multiple are configured) or stick to one.
    If no proxies are configured, calls go direct.
    """

    def __init__(self, config: Optional[ScraperConfig] = None):
        self.config = config or ScraperConfig()
        self.api: API = twscrape.API()
        self.proxies: List[Proxy] = load_proxies(self.config.proxies_file)
        self._current_proxy: Optional[Proxy] = None

        if self.proxies:
            log.info(f"Loaded {len(self.proxies)} proxy/proxies from {self.config.proxies_file}")
            for p in self.proxies:
                log.info(f"  - {p}")
        else:
            log.info("No proxies configured — using direct connections")

    # ----- proxy plumbing --------------------------------------------------

    def next_proxy(self) -> Optional[Proxy]:
        """Pick the next proxy, rotating if enabled."""
        if not self.proxies:
            return None
        if self.config.proxy_rotate or self._current_proxy is None:
            self._current_proxy = pick_proxy(self.proxies, prefer=self.config.prefer_proto)
        return self._current_proxy

    async def _with_proxy(self, coro_factory):
        """
        Run an async operation with a configured proxy.
        `coro_factory` is a callable that takes a twscrape.API and returns a coroutine.
        """
        proxy = self.next_proxy()
        if proxy is None:
            return await coro_factory(self.api)

        # twscrape.API accepts a proxy URL string directly
        url = proxy.to_url()
        api = twscrape.API(proxy=url)
        try:
            return await coro_factory(api)
        finally:
            pass  # twscrape manages its own connections

    # ----- account helpers -------------------------------------------------

    async def add_accounts_from_file(self, path: str = "accounts.txt") -> List[str]:
        from accounts import load_accounts, add_accounts as _add
        accounts = load_accounts(path)
        if not accounts:
            log.warning(f"No accounts found in {path}")
            return []
        return await _add(self.api, accounts)

    async def login_all(self) -> None:
        await self.api.pool.login_all()

    async def accounts_stats(self):
        return await self.api.pool.accounts_stats()

    # ----- search ----------------------------------------------------------

    async def search(self, query: str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.search(query, limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    # ----- tweets ----------------------------------------------------------

    async def tweet_details(self, tweet_id: int | str) -> Any:
        async def op(api: API):
            return await api.tweet_details(int(tweet_id))
        return await self._with_proxy(op)

    async def tweet_replies(self, tweet_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.tweet_replies(int(tweet_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def tweet_thread(self, tweet_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.tweet_thread(int(tweet_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def retweeters(self, tweet_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.retweeters(int(tweet_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    # ----- users -----------------------------------------------------------

    async def user_by_login(self, username: str) -> Any:
        async def op(api: API):
            return await api.user_by_login(username)
        return await self._with_proxy(op)

    async def user_about(self, username: str) -> Any:
        # twscrape exposes about info via user object; some versions have a
        # dedicated endpoint. We attempt both, falling back gracefully.
        async def op(api: API):
            try:
                fn = api.user_about  # type: ignore[attr-defined]
                return await fn(username)
            except AttributeError:
                user = await api.user_by_login(username)
                return getattr(user, "raw", None) or user
        return await self._with_proxy(op)

    async def user_media(self, user_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.user_media(int(user_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def following(self, user_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.following(int(user_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def followers(self, user_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.followers(int(user_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def verified_followers(self, user_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.verified_followers(int(user_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def subscriptions(self, user_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.subscriptions(int(user_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def user_tweets(self, user_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.user_tweets(int(user_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def user_tweets_and_replies(self, user_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.user_tweets_and_replies(int(user_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    # ----- lists -----------------------------------------------------------

    async def list_timeline(self, list_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.list_timeline(int(list_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def list_members(self, list_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.list_members(int(list_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    # ----- communities -----------------------------------------------------

    async def community_info(self, community_id: int | str) -> Any:
        async def op(api: API):
            return await api.community_info(int(community_id))
        return await self._with_proxy(op)

    async def community_members(self, community_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.community_members(int(community_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def community_moderators(self, community_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.community_moderators(int(community_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    async def community_tweets(self, community_id: int | str, limit: int = 20) -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.community_tweets(int(community_id), limit=limit):
                out.append(item)
            return out
        return await self._with_proxy(op)

    # ----- trends ----------------------------------------------------------

    async def trends(self, category: str = "sport") -> List[Any]:
        async def op(api: API):
            out: List[Any] = []
            async for item in api.trends(category):
                out.append(item)
            return out
        return await self._with_proxy(op)


# ----- helpers ------------------------------------------------------------

def to_jsonable(obj: Any) -> Any:
    """Best-effort conversion of twscrape models to plain dicts/lists."""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (list, tuple, set)):
        return [to_jsonable(x) for x in obj]
    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}
    if hasattr(obj, "__dict__"):
        d = {k: to_jsonable(v) for k, v in vars(obj).items() if not k.startswith("_")}
        # also include the doc/raw payload if present
        if hasattr(obj, "raw") and isinstance(obj.raw, dict):
            d.setdefault("raw", obj.raw)
        return d
    return str(obj)


def print_json(obj: Any) -> None:
    import json
    print(json.dumps(to_jsonable(obj), indent=2, default=str, ensure_ascii=False))


def print_table(obj: Any) -> None:
    """Pretty-print a list of tweets or users using rich if available."""
    try:
        from rich.console import Console
        from rich.table import Table
    except Exception:
        print_json(obj)
        return

    console = Console()
    if isinstance(obj, list) and obj and hasattr(obj[0], "id") and hasattr(obj[0], "user"):
        # Tweets
        t = Table(show_header=True, header_style="bold magenta")
        t.add_column("ID", style="dim", overflow="fold")
        t.add_column("User", style="cyan")
        t.add_column("Date", style="green")
        t.add_column("Text", style="white", overflow="fold")
        for tw in obj:
            user = getattr(tw, "user", None)
            uname = getattr(user, "username", "?") if user else "?"
            t.add_row(
                str(getattr(tw, "id", "")),
                f"@{uname}",
                str(getattr(tw, "date", "")),
                (getattr(tw, "rawContent", "") or "")[:200],
            )
        console.print(t)
    elif isinstance(obj, list) and obj and hasattr(obj[0], "username") and hasattr(obj[0], "id"):
        # Users
        t = Table(show_header=True, header_style="bold magenta")
        t.add_column("ID", style="dim")
        t.add_column("Username", style="cyan")
        t.add_column("Name", style="white")
        t.add_column("Followers", style="green", justify="right")
        for u in obj:
            t.add_row(
                str(getattr(u, "id", "")),
                f"@{getattr(u, 'username', '?')}",
                getattr(u, "displayname", "") or "",
                str(getattr(u, "followersCount", "")),
            )
        console.print(t)
    else:
        console.print_json(data=to_jsonable(obj))


def run(coro):
    """Run an async coroutine using the current event loop policy."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)
