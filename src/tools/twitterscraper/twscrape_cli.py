"""
twscrape_cli.py
---------------
Command-line interface mirroring the original `twscrape` CLI, plus the
HTTP/HTTPS/SOCKS4/SOCKS5 proxy support.

Usage examples
--------------
    twscrape search "QUERY" --limit=20
    twscrape tweet_details TWEET_ID
    twscrape tweet_replies TWEET_ID --limit=20
    twscrape tweet_thread TWEET_ID --limit=20
    twscrape retweeters TWEET_ID --limit=20
    twscrape user_by_login USERNAME
    twscrape user_about USERNAME
    twscrape user_media USER_ID --limit=20
    twscrape following USER_ID --limit=20
    twscrape followers USER_ID --limit=20
    twscrape verified_followers USER_ID --limit=20
    twscrape subscriptions USER_ID --limit=20
    twscrape user_tweets USER_ID --limit=20
    twscrape user_tweets_and_replies USER_ID --limit=20
    twscrape list_timeline LIST_ID --limit=20
    twscrape list_members LIST_ID --limit=20
    twscrape community_info COMMUNITY_ID
    twscrape community_members COMMUNITY_ID --limit=20
    twscrape community_moderators COMMUNITY_ID --limit=20
    twscrape community_tweets COMMUNITY_ID --limit=20
    twscrape trends sport

Account management:
    twscrape add_accounts accounts.txt
    twscrape login_all
    twscrape accounts_stats
"""
from __future__ import annotations

import asyncio
import sys
from typing import List, Optional

import click

from scraper import ScraperConfig, TwitterScraper, print_json, print_table, run


# ----------------------- shared options -----------------------

def common_options(fn):
    """Options shared by every data-retrieval command."""
    fn = click.option(
        "--limit", default=20, show_default=True, type=int,
        help="Maximum number of results to return (where applicable).",
    )(fn)
    fn = click.option(
        "--json", "as_json", is_flag=True, default=False,
        help="Print raw JSON instead of a formatted table.",
    )(fn)
    fn = click.option(
        "--proxy-file", default="proxies.txt", show_default=True,
        help="Path to the proxy configuration file.",
    )(fn)
    fn = click.option(
        "--no-rotate", is_flag=True, default=False,
        help="Don't rotate proxies between calls.",
    )(fn)
    fn = click.option(
        "--prefer", default=None,
        type=click.Choice(["http", "https", "socks4", "socks5"], case_sensitive=False),
        help="Prefer this proxy protocol when rotating.",
    )(fn)
    return fn


def build_scraper(proxy_file: str, no_rotate: bool, prefer: Optional[str]) -> TwitterScraper:
    """Build a TwitterScraper from CLI options.

    `no_rotate=True` (set by the --no-rotate flag) disables proxy rotation.
    """
    cfg = ScraperConfig(
        proxies_file=proxy_file,
        proxy_rotate=not no_rotate,
        prefer_proto=prefer,
    )
    return TwitterScraper(cfg)


# ----------------------- main group -----------------------

@click.group(help="Twitter/X scraper with HTTP/HTTPS/SOCKS4/SOCKS5 proxy support.")
@click.option(
    "--proxy-file", default="proxies.txt", show_default=True,
    help="Default proxies.txt path used by every command.",
)
@click.pass_context
def cli(ctx: click.Context, proxy_file: str):
    ctx.ensure_object(dict)
    ctx.obj["proxy_file"] = proxy_file


# ----------------------- account commands -----------------------

@cli.command("add_accounts", help="Add accounts from a file to the pool.")
@click.argument("file", default="accounts.txt")
def cmd_add_accounts(file: str):
    scraper = build_scraper("proxies.txt", no_rotate=False, prefer=None)
    added = run(scraper.add_accounts_from_file(file))
    if added:
        click.echo(f"[+] Added {len(added)} account(s): {', '.join(added)}")
    else:
        click.echo("[!] No accounts added. Check the file format: user:pass[:email:email_pass]")


@cli.command("login_all", help="Log in every account currently in the pool.")
def cmd_login_all():
    scraper = build_scraper("proxies.txt", no_rotate=False, prefer=None)
    run(scraper.login_all())
    click.echo("[+] Login complete")


@cli.command("accounts_stats", help="Show the pool's account health stats.")
def cmd_accounts_stats():
    scraper = build_scraper("proxies.txt", no_rotate=False, prefer=None)
    stats = run(scraper.accounts_stats())
    print_json(stats)


# ----------------------- data commands -----------------------

@cli.command("search", help="Search for tweets matching a query.")
@click.argument("query")
@common_options
def cmd_search(query: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.search(query, limit=limit))
    _print(result, as_json)


@cli.command("tweet_details", help="Fetch a single tweet by ID.")
@click.argument("tweet_id")
@common_options
def cmd_tweet_details(tweet_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.tweet_details(tweet_id))
    _print(result, as_json)


@cli.command("tweet_replies", help="Fetch replies of a tweet.")
@click.argument("tweet_id")
@common_options
def cmd_tweet_replies(tweet_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.tweet_replies(tweet_id, limit=limit))
    _print(result, as_json)


@cli.command("tweet_thread", help="Fetch the full thread of a tweet.")
@click.argument("tweet_id")
@common_options
def cmd_tweet_thread(tweet_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.tweet_thread(tweet_id, limit=limit))
    _print(result, as_json)


@cli.command("retweeters", help="Fetch users who retweeted a tweet.")
@click.argument("tweet_id")
@common_options
def cmd_retweeters(tweet_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.retweeters(tweet_id, limit=limit))
    _print(result, as_json)


@cli.command("user_by_login", help="Look up a user by their @username.")
@click.argument("username")
@common_options
def cmd_user_by_login(username: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.user_by_login(username))
    _print(result, as_json)


@cli.command("user_about", help="Fetch the 'about' info of a user.")
@click.argument("username")
@common_options
def cmd_user_about(username: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.user_about(username))
    _print(result, as_json)


@cli.command("user_media", help="Fetch a user's media timeline.")
@click.argument("user_id")
@common_options
def cmd_user_media(user_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.user_media(user_id, limit=limit))
    _print(result, as_json)


@cli.command("following", help="Fetch the accounts a user follows.")
@click.argument("user_id")
@common_options
def cmd_following(user_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.following(user_id, limit=limit))
    _print(result, as_json)


@cli.command("followers", help="Fetch a user's followers.")
@click.argument("user_id")
@common_options
def cmd_followers(user_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.followers(user_id, limit=limit))
    _print(result, as_json)


@cli.command("verified_followers", help="Fetch a user's verified followers.")
@click.argument("user_id")
@common_options
def cmd_verified_followers(user_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.verified_followers(user_id, limit=limit))
    _print(result, as_json)


@cli.command("subscriptions", help="Fetch the accounts a user subscribes to.")
@click.argument("user_id")
@common_options
def cmd_subscriptions(user_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.subscriptions(user_id, limit=limit))
    _print(result, as_json)


@cli.command("user_tweets", help="Fetch a user's tweets (no replies).")
@click.argument("user_id")
@common_options
def cmd_user_tweets(user_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.user_tweets(user_id, limit=limit))
    _print(result, as_json)


@cli.command("user_tweets_and_replies", help="Fetch a user's tweets including replies.")
@click.argument("user_id")
@common_options
def cmd_user_tweets_and_replies(user_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.user_tweets_and_replies(user_id, limit=limit))
    _print(result, as_json)


@cli.command("list_timeline", help="Fetch a list's timeline.")
@click.argument("list_id")
@common_options
def cmd_list_timeline(list_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.list_timeline(list_id, limit=limit))
    _print(result, as_json)


@cli.command("list_members", help="Fetch members of a list.")
@click.argument("list_id")
@common_options
def cmd_list_members(list_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.list_members(list_id, limit=limit))
    _print(result, as_json)


@cli.command("community_info", help="Fetch info about a community.")
@click.argument("community_id")
@common_options
def cmd_community_info(community_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.community_info(community_id))
    _print(result, as_json)


@cli.command("community_members", help="Fetch members of a community.")
@click.argument("community_id")
@common_options
def cmd_community_members(community_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.community_members(community_id, limit=limit))
    _print(result, as_json)


@cli.command("community_moderators", help="Fetch moderators of a community.")
@click.argument("community_id")
@common_options
def cmd_community_moderators(community_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.community_moderators(community_id, limit=limit))
    _print(result, as_json)


@cli.command("community_tweets", help="Fetch the timeline of a community.")
@click.argument("community_id")
@common_options
def cmd_community_tweets(community_id: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.community_tweets(community_id, limit=limit))
    _print(result, as_json)


@cli.command("trends", help="Fetch trending topics for a category.")
@click.argument("category", default="sport")
@common_options
def cmd_trends(category: str, limit: int, as_json: bool, proxy_file: str, no_rotate: bool, prefer: Optional[str]):
    s = build_scraper(proxy_file, no_rotate, prefer)
    result = run(s.trends(category))
    _print(result, as_json)


# ----------------------- helpers -----------------------

def _print(result, as_json: bool) -> None:
    if as_json:
        print_json(result)
    else:
        print_table(result)


if __name__ == "__main__":
    cli(obj={})
