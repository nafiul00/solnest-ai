"""
Revenue Engine HTTP Bridge

Thin Flask wrapper that exposes the Python revenue engine over HTTP.
The Node.js revenue-intel orchestrator calls this to get deterministic
pricing decisions from the battle-tested Python engine.

Usage:
    python serve.py                  # Starts on port 5050
    SERVE_PORT=8080 python serve.py  # Custom port
"""

import json
import os
import sys
from datetime import date
from pathlib import Path
from dotenv import load_dotenv

# Load .env from this file's own directory (plug & play — no CWD dependency)
load_dotenv(Path(__file__).parent / ".env")

# Add src/ to the Python path so we can import the engine modules
sys.path.insert(0, str(Path(__file__).parent / "src"))

from flask import Flask, request, jsonify
from models import PropertyData, BookingRecord, CompSetEntry, EventData
from revenue_agent import run_revenue_agent

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB limit


def _parse_date(s):
    """Parse ISO date string to date object."""
    if isinstance(s, date):
        return s
    return date.fromisoformat(s)


def _hydrate_property_data(payload):
    """Convert a JSON dict into a PropertyData dataclass instance."""
    calendar = [
        BookingRecord(
            date=_parse_date(d["date"]),
            is_booked=d["is_booked"],
            price=float(d["price"]),
            booked_on=_parse_date(d["booked_on"]) if d.get("booked_on") else None,
        )
        for d in payload["calendar"]
    ]

    last_year_calendar = [
        BookingRecord(
            date=_parse_date(d["date"]),
            is_booked=d["is_booked"],
            price=float(d["price"]),
            booked_on=_parse_date(d["booked_on"]) if d.get("booked_on") else None,
        )
        for d in payload.get("last_year_calendar", [])
    ]

    comp_set = [
        CompSetEntry(
            date=_parse_date(d["date"]),
            avg_price=float(d["avg_price"]),
            avg_occupancy=float(d["avg_occupancy"]),
            is_fully_booked=d.get("is_fully_booked", False),
        )
        for d in payload.get("comp_set", [])
    ]

    events = [
        EventData(
            date=_parse_date(d["date"]),
            name=d["name"],
            demand_level=d["demand_level"],
        )
        for d in payload.get("events", [])
    ]

    return PropertyData(
        property_id=payload["property_id"],
        base_price=float(payload["base_price"]),
        calendar=calendar,
        last_year_calendar=last_year_calendar if last_year_calendar else calendar,
        comp_set=comp_set,
        events=events,
        analysis_date=_parse_date(payload.get("analysis_date", date.today().isoformat())),
    )


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "engine": "revenue-agent-v2"})


@app.route("/analyze", methods=["POST"])
def analyze():
    """Run the revenue agent pipeline on the provided property data.

    Expects JSON body matching the PropertyData schema.
    Returns the structured JSON output from the revenue engine.
    """
    try:
        payload = request.get_json(silent=True)
        if payload is None:
            return jsonify({"status": "error", "error": "Invalid or empty JSON body"}), 400

        data = _hydrate_property_data(payload)
        result = run_revenue_agent(data)
        return jsonify(result)

    except KeyError as e:
        return jsonify({
            "status": "error",
            "error_type": "MISSING_FIELD",
            "error": f"Missing required field: {e}",
        }), 400
    except (ValueError, TypeError) as e:
        return jsonify({
            "status": "error",
            "error_type": "INVALID_DATA",
            "error": str(e),
        }), 400
    except Exception as e:
        app.logger.exception("Unhandled error in /analyze")
        return jsonify({
            "status": "error",
            "error_type": "INTERNAL_ERROR",
            "error": "Internal server error. Check server logs.",
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("SERVE_PORT", 5050))
    print(f"Revenue Engine HTTP Bridge starting on port {port}")
    # Bind to localhost only — Node.js orchestrator calls it locally
    # If you need remote access, set SERVE_HOST=0.0.0.0 in your environment
    host = os.environ.get("SERVE_HOST", "127.0.0.1")
    app.run(host=host, port=port, debug=False)
