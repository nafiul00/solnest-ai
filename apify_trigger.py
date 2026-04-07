"""Trigger Apify Airbnb scrapers via API, fetch results, and merge into a report."""

import json
import os
import sys
import time
from datetime import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
BASE_URL = "https://api.apify.com/v2"
REQUEST_TIMEOUT = 30  # seconds for all HTTP calls
MAX_POLLS = 180       # 180 × 10s = 30 minutes max wait per run

ACTORS = {
    "rooms": "tri_angle~airbnb-rooms-urls-scraper",
    "reviews": "tri_angle~airbnb-reviews-scraper",
}

# Airbnb listing URLs — can also be set via LISTING_URLS env var (comma-separated)
_env_urls = os.getenv("LISTING_URLS", "")
LISTING_URLS = [u.strip() for u in _env_urls.split(",") if u.strip()] or [
    "https://www.airbnb.com/rooms/1492274390479279422",
]

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "apify_output")


def _auth_headers():
    return {"Authorization": f"Bearer {APIFY_TOKEN}"}


def trigger_actor(actor_id, name):
    """Trigger an actor run with listing URLs as input."""
    url = f"{BASE_URL}/acts/{actor_id}/runs"
    input_data = {
        "startUrls": [{"url": u} for u in LISTING_URLS],
    }
    resp = requests.post(url, headers=_auth_headers(), json=input_data, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    payload = resp.json()
    data = payload.get("data")
    if not data or "id" not in data:
        raise RuntimeError(f"[{name}] Unexpected response from Apify: {payload}")
    run_id = data["id"]
    print(f"[{name}] Started run: {run_id}")
    print(f"  Console: https://console.apify.com/actors/runs/{run_id}")
    return run_id


def wait_for_run(run_id, name, poll_interval=10):
    """Poll until the run finishes. Raises RuntimeError if MAX_POLLS exceeded."""
    url = f"{BASE_URL}/actor-runs/{run_id}"
    for attempt in range(MAX_POLLS):
        resp = requests.get(url, headers=_auth_headers(), timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        payload = resp.json()
        data = payload.get("data")
        if not data:
            raise RuntimeError(f"[{name}] Unexpected response: {payload}")
        status = data["status"]
        if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            print(f"[{name}] Finished with status: {status}")
            dataset_id = data.get("defaultDatasetId")
            return status, dataset_id
        print(f"[{name}] Status: {status} — waiting {poll_interval}s... ({attempt + 1}/{MAX_POLLS})")
        time.sleep(poll_interval)

    raise RuntimeError(f"[{name}] Run {run_id} did not finish within {MAX_POLLS * poll_interval}s")


def fetch_dataset(dataset_id, name):
    """Download all items from a dataset."""
    url = f"{BASE_URL}/datasets/{dataset_id}/items"
    resp = requests.get(
        url,
        headers=_auth_headers(),
        params={"format": "json"},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    items = resp.json()
    print(f"[{name}] Fetched {len(items)} items from dataset {dataset_id}")
    return items


def merge_results(rooms_data, reviews_data):
    """Merge room details with their reviews by listing ID."""
    # Build reviews lookup by listing ID
    reviews_by_listing = {}
    for review in reviews_data:
        listing_id = review.get("listingId") or review.get("listing_id") or review.get("roomId")
        if listing_id:
            listing_id = str(listing_id)
            if listing_id not in reviews_by_listing:
                reviews_by_listing[listing_id] = []
            reviews_by_listing[listing_id].append(review)

    # Merge into room data
    merged = []
    for room in rooms_data:
        room_id = str(room.get("id") or room.get("roomId") or room.get("listing_id", ""))
        room_copy = dict(room)
        room_copy["reviews"] = reviews_by_listing.get(room_id, [])
        room_copy["review_count"] = len(room_copy["reviews"])
        merged.append(room_copy)

    # Flag any reviews that didn't match a room
    matched_ids = {str(room.get("id") or room.get("roomId") or room.get("listing_id", "")) for room in rooms_data}
    unmatched_reviews = [r for lid, revs in reviews_by_listing.items() if lid not in matched_ids for r in revs]
    if unmatched_reviews:
        print(f"  Warning: {len(unmatched_reviews)} reviews didn't match any room listing")

    return merged


def save_results(data, filename):
    """Save data as JSON."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  Saved: {filepath}")
    return filepath


def main():
    if not APIFY_TOKEN:
        print("Error: APIFY_TOKEN not found in .env")
        sys.exit(1)

    if not LISTING_URLS:
        print("Error: LISTING_URLS is empty — add at least one Airbnb listing URL")
        sys.exit(1)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    print("Triggering Apify Airbnb scrapers...\n")

    # Start both runs in parallel
    runs = {}
    for name, actor_id in ACTORS.items():
        try:
            runs[name] = trigger_actor(actor_id, name)
        except Exception as exc:
            print(f"[!] Failed to trigger {name} actor: {exc}")
            sys.exit(1)

    print("\nWaiting for runs to complete...\n")

    # Wait for both and collect dataset IDs
    datasets = {}
    for name, run_id in runs.items():
        try:
            status, dataset_id = wait_for_run(run_id, name)
            if status == "SUCCEEDED" and dataset_id:
                datasets[name] = dataset_id
            else:
                print(f"  [!] {name} did not succeed (status: {status}) — skipping dataset fetch")
        except Exception as exc:
            print(f"  [!] Error waiting for {name} run: {exc}")

    # Fetch results
    print("\nFetching results...\n")
    rooms_data = fetch_dataset(datasets["rooms"], "rooms") if "rooms" in datasets else []
    reviews_data = fetch_dataset(datasets["reviews"], "reviews") if "reviews" in datasets else []

    # Save raw data
    if rooms_data:
        save_results(rooms_data, f"rooms_{timestamp}.json")
    if reviews_data:
        save_results(reviews_data, f"reviews_{timestamp}.json")

    # Merge and save combined report
    if rooms_data:
        merged = merge_results(rooms_data, reviews_data)
        save_results(merged, f"report_{timestamp}.json")

        print("\n--- Report Summary ---")
        for listing in merged:
            name = listing.get("title") or listing.get("name") or listing.get("id", "Unknown")
            rating = listing.get("rating") or listing.get("stars") or "N/A"
            print(f"  {name} | Rating: {rating} | Reviews: {listing['review_count']}")
    else:
        print("\nNo room data to build report from.")

    print("\nDone!")


if __name__ == "__main__":
    main()
