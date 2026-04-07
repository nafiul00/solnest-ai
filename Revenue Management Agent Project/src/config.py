"""
Revenue Agent v2 — Centralized Configuration
All tunable pricing thresholds, bands, and business rules in one place.
"""

from typing import Final


# ── Lead-Time Pricing Bands ──────────────────────────────────────────────────
# days_out range -> price adjustment multiplier

LEAD_TIME_BANDS: Final[dict] = {
    "0-6":   {"min_days": 0,  "max_days": 6,  "pct": -0.20, "confidence": "high"},
    "7-13":  {"min_days": 7,  "max_days": 13, "pct": -0.15, "confidence": "high"},
    "14-29": {"min_days": 14, "max_days": 29, "pct": -0.05, "confidence": "medium"},
    "30-59": {"min_days": 30, "max_days": 59, "pct":  0.00, "confidence": "medium"},
    "60-89": {"min_days": 60, "max_days": 89, "pct":  0.05, "confidence": "medium"},
    "90+":   {"min_days": 90, "max_days": None, "pct": 0.10, "confidence": "medium"},
}

# ── Gap / Inventory Pricing ───────────────────────────────────────────────────

GAP_DISCOUNTS: Final[dict] = {
    "orphan_day":  -0.20,   # Single unbooked day between two bookings
    "long_gap":    -0.125,  # 5+ consecutive unbooked days in 14-day window
    "weekday_gap": -0.10,   # Unbooked Mon-Thu while weekends booked
}

# ── Event / Demand Surge ──────────────────────────────────────────────────────

EVENT_PREMIUMS: Final[dict] = {
    "low":    0.15,
    "medium": 0.25,
    "high":   0.40,
}

# ── Booking Velocity ──────────────────────────────────────────────────────────

VELOCITY_ADJUSTMENTS: Final[dict] = {
    "fast_booking": 0.10,   # Demand is high — raise prices
    "no_booking":  -0.10,   # Demand is absent — reduce prices
}

# ── Comp-Set Alignment ────────────────────────────────────────────────────────

COMP_SET_ADJUSTMENT: Final[float] = 0.08   # +/- 8% toward market rate
COMP_SET_POSITION_THRESHOLD: Final[float] = 8.0  # % gap before "above/below" label

# ── Pacing ────────────────────────────────────────────────────────────────────

PACING_BEHIND_THRESHOLD: Final[float] = -5.0   # delta_pct below this → "behind"
PACING_AHEAD_THRESHOLD: Final[float] = 5.0     # delta_pct above this → "ahead"
PACING_ADJUSTMENT_PCT: Final[float] = -0.05    # -5% nudge when pacing behind

# ── Inventory Signal Windows ──────────────────────────────────────────────────

SIGNAL_BOOKING_WINDOW_DAYS: Final[int] = 14    # Look-ahead for no_booking detection
SIGNAL_FAST_BOOKING_HOURS: Final[int] = 24     # "within 24h" threshold in days (<=1)
SIGNAL_NO_BOOKING_MIN_RUN: Final[int] = 7      # Consecutive unbooked days = no_booking
SIGNAL_LONG_GAP_MIN_RUN: Final[int] = 5        # Consecutive unbooked = long_gap
SIGNAL_LONG_GAP_WINDOW_DAYS: Final[int] = 14   # Window for long_gap detection

# ── Market Thresholds ─────────────────────────────────────────────────────────

MARKET_UNDERPRICED_OCC_THRESHOLD: Final[float] = 0.70   # comp_occ above this → underpriced concern
MARKET_OVERPRICED_OCC_THRESHOLD: Final[float] = 0.50    # our_occ below this → overpriced concern

# ── Validation Limits ─────────────────────────────────────────────────────────

VALIDATION_MAX_PRICE_MULTIPLIER: Final[float] = 2.0     # new_price <= 2x old_price
VALIDATION_MIN_PRICE_FRACTION: Final[float] = 0.50      # new_price >= 50% of old_price
VALIDATION_MAX_OCCUPANCY: Final[float] = 1.0
VALIDATION_MIN_OCCUPANCY: Final[float] = 0.0

# ── Risk Classification ───────────────────────────────────────────────────────

RISK_HIGH_ISSUE_COUNT: Final[int] = 5   # >= this many issues → high risk
RISK_MEDIUM_POSITION_THRESHOLD: Final[float] = 5.0  # % market deviation

# ── Discount Rules (Pricing Agent) ───────────────────────────────────────────

DISCOUNT_LAST_MINUTE_WINDOW_DAYS: Final[int] = 14
DISCOUNT_LAST_MINUTE_PCT: Final[str] = "15%"
DISCOUNT_ORPHAN_DAY_PCT: Final[str] = "20%"
DISCOUNT_LENGTH_OF_STAY_PCT: Final[str] = "10%"
DISCOUNT_LENGTH_OF_STAY_MIN_NIGHTS: Final[int] = 5
DISCOUNT_GAP_FILL_PCT: Final[str] = "12%"

# ── Calendar Defaults ─────────────────────────────────────────────────────────

CALENDAR_DEFAULT_DAYS_AHEAD: Final[int] = 30
CALENDAR_MIN_DAYS: Final[int] = 30
CALENDAR_MAX_DAYS: Final[int] = 90
