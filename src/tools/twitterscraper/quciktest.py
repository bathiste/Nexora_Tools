"""
example.py
----------
Programmatic usage of the TwitterScraper class.

Run with:
    python example.py
"""
import asyncio

from scraper import ScraperConfig, TwitterScraper, print_table


async def main():
    # 1. Build the scraper
    cfg = ScraperConfig(
        proxies_file="proxies.txt",     # path to your proxy list
        proxy_rotate=True,              # rotate proxies between calls
        prefer_proto="socks5",          # try SOCKS5 first if available
    )
    scraper = TwitterScraper(cfg)

    # 2. Add accounts (one-time) and log them in
    # await scraper.add_accounts_from_file("accounts.txt")
    # await scraper.login_all()

    # 3. Use any of the methods below — they all go through the configured proxy.
    #    Each call may rotate the proxy, unless proxy_rotate=False.

    print("=== Search ===")
    tweets = await scraper.search("python programming", limit=10)
    print_table(tweets)

    print("\n=== Tweet details ===")
    if tweets:
        first = tweets[0]
        details = await scraper.tweet_details(first.id)
        print_table(details)

    print("\n=== User by login ===")
    user = await scraper.user_by_login("elonmusk")
    print_table(user)

    print("\n=== User tweets ===")
    if user is not None:
        user_tweets = await scraper.user_tweets(user.id, limit=10)
        print_table(user_tweets)

    print("\n=== Trends (sport) ===")
    trends = await scraper.trends("sport")
    print_table(trends)


if __name__ == "__main__":
    asyncio.run(main())
