"""Instagram profile scrape + content optimization analysis.

Usage:
    python instagram_scrape_and_analyze.py <username1> [username2] [username3] ...

Examples:
    python instagram_scrape_and_analyze.py ryan_le5
    python instagram_scrape_and_analyze.py ryan_le5 solneststays
"""

import json
import os
import sys
import time
from datetime import datetime

import anthropic
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"), override=True)

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
BASE_URL = "https://api.apify.com/v2"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "instagram_output")


def scrape_profile(username):
    """Trigger Apify Instagram Profile Scraper and return results."""
    actor_id = "apify~instagram-profile-scraper"
    url = f"{BASE_URL}/acts/{actor_id}/runs"
    input_data = {
        "usernames": [username],
        "resultsLimit": 200,
    }
    print(f"Triggering Instagram scraper for @{username}...")
    resp = requests.post(url, params={"token": APIFY_TOKEN}, json=input_data)
    resp.raise_for_status()
    data = resp.json()["data"]
    run_id = data["id"]
    print(f"  Run started: {run_id}")
    print(f"  Console: https://console.apify.com/actors/runs/{run_id}")

    # Poll until done
    while True:
        resp = requests.get(
            f"{BASE_URL}/actor-runs/{run_id}", params={"token": APIFY_TOKEN}
        )
        resp.raise_for_status()
        run_data = resp.json()["data"]
        status = run_data["status"]
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            print(f"  Run finished: {status}")
            break
        print(f"  Status: {status} — waiting 10s...")
        time.sleep(10)

    if status != "SUCCEEDED":
        raise RuntimeError(f"Apify run failed with status: {status}")

    # Fetch dataset
    dataset_id = run_data["defaultDatasetId"]
    resp = requests.get(
        f"{BASE_URL}/datasets/{dataset_id}/items",
        params={"token": APIFY_TOKEN, "format": "json"},
    )
    resp.raise_for_status()
    items = resp.json()
    print(f"  Fetched {len(items)} items from dataset")
    return items


def save_json(data, filename):
    """Save data as JSON to output directory."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  Saved: {filepath}")
    return filepath


def analyze_with_claude(username, profile_data):
    """Send scraped data to Claude for content optimization analysis."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Prepare a summary of the data to fit in context
    profile_summary = json.dumps(profile_data, indent=2, ensure_ascii=False)

    # Truncate if massive (Claude can handle ~100k tokens but be reasonable)
    if len(profile_summary) > 300_000:
        profile_summary = profile_summary[:300_000] + "\n... (truncated)"

    prompt = f"""Analyze this Instagram profile data for @{username} and provide actionable content optimization recommendations.

Here is the full scraped profile data (posts, captions, hashtags, engagement metrics, timestamps, media types):

{profile_summary}

Please provide a thorough analysis covering:

1. **Profile Overview** — follower count, post count, bio assessment, overall engagement rate
2. **Top Performing Posts** — which posts got the most engagement and why (identify patterns)
3. **Lowest Performing Posts** — what's underperforming and why
4. **Content Type Analysis** — breakdown of reels vs images vs carousels, which type performs best
5. **Caption & Hashtag Analysis** — what caption styles/lengths work, which hashtags drive engagement
6. **Posting Pattern Analysis** — when posts go up (day of week, time), correlation with performance
7. **Specific Recommendations**:
   - Posts to consider archiving (low engagement, off-brand)
   - Content types to double down on
   - Caption/hashtag strategy improvements
   - Optimal posting schedule based on the data
   - Bio optimization suggestions
8. **Quick Wins** — 3-5 things that can be done immediately to improve the profile"""

    print("Sending data to Claude for analysis...")
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}],
    )

    analysis = response.content[0].text
    print("  Analysis complete.")
    return analysis


def process_account(username):
    """Scrape and analyze a single Instagram account."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Step 1: Scrape
    profile_data = scrape_profile(username)

    # Step 2: Save raw data
    save_json(profile_data, f"{username}_profile_{timestamp}.json")
    save_json(profile_data, f"{username}_profile.json")

    # Step 3: Analyze
    analysis = analyze_with_claude(username, profile_data)

    # Step 4: Save analysis
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    analysis_path = os.path.join(OUTPUT_DIR, f"{username}_analysis.md")
    with open(analysis_path, "w", encoding="utf-8") as f:
        f.write(f"# Instagram Content Optimization — @{username}\n")
        f.write(f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n\n")
        f.write(analysis)
    print(f"  Saved analysis: {analysis_path}")
    return analysis_path


def main():
    if not APIFY_TOKEN:
        print("Error: APIFY_TOKEN not found in .env")
        return
    if not ANTHROPIC_API_KEY:
        print("Error: ANTHROPIC_API_KEY not found in .env")
        print("  Add it to your .env file: ANTHROPIC_API_KEY=sk-ant-...")
        return

    usernames = sys.argv[1:]
    if not usernames:
        print("Usage: python instagram_scrape_and_analyze.py <username1> [username2] ...")
        print("Example: python instagram_scrape_and_analyze.py ryan_le5 solneststays")
        return

    for username in usernames:
        username = username.lstrip("@")
        print(f"\n{'='*60}")
        print(f"Processing @{username}")
        print(f"{'='*60}")
        process_account(username)

    print(f"\nDone! Check instagram_output/ for results.")


if __name__ == "__main__":
    main()
