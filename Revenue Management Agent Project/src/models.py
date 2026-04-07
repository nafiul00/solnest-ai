"""
Revenue Agent v2 — Data Models
All shared dataclasses and types used across the system.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Literal
from datetime import date


# ─── Input Data Models ─────────────────────────────────────────────────────────

@dataclass
class BookingRecord:
    """Represents a single day in the property calendar."""
    date: date
    is_booked: bool
    price: float
    booked_on: Optional[date] = None  # Date the booking was made (for velocity calc)


@dataclass
class CompSetEntry:
    """Competitor set data for a single date."""
    date: date
    avg_price: float
    avg_occupancy: float  # 0.0 – 1.0
    is_fully_booked: bool = False


@dataclass
class EventData:
    """Local event that affects demand."""
    date: date
    name: str
    demand_level: Literal["low", "medium", "high"]  # maps to +15%, +25%, +40%


@dataclass
class PropertyData:
    """Full input payload for a single property."""
    property_id: str
    base_price: float
    calendar: List[BookingRecord]          # next 30 days
    last_year_calendar: List[BookingRecord]  # same window last year (pacing)
    comp_set: List[CompSetEntry]
    events: List[EventData] = field(default_factory=list)
    analysis_date: date = field(default_factory=date.today)


# ─── Signal Models ─────────────────────────────────────────────────────────────

@dataclass
class BookingSignal:
    signal_type: Literal["fast_booking", "no_booking", "normal"]
    affected_dates: List[date]
    description: str


@dataclass
class InventorySignal:
    signal_type: Literal["orphan_day", "long_gap", "weekday_gap"]
    affected_dates: List[date]
    gap_length: int
    description: str


@dataclass
class PacingSignal:
    signal_type: Literal["ahead", "behind", "on_track"]
    current_occupancy: float   # 0.0 – 1.0
    last_year_occupancy: float  # 0.0 – 1.0
    delta_percent: float
    description: str


@dataclass
class MarketSignal:
    signal_type: Literal["underpriced", "overpriced", "aligned"]
    affected_dates: List[date]
    our_avg_price: float
    comp_avg_price: float
    description: str


@dataclass
class SignalBundle:
    """Aggregated signals for a property."""
    booking: Optional[BookingSignal] = None
    inventory: List[InventorySignal] = field(default_factory=list)
    pacing: Optional[PacingSignal] = None
    market: Optional[MarketSignal] = None


# ─── Decision Models ───────────────────────────────────────────────────────────

@dataclass
class PricingDecision:
    """A single pricing action for a specific date."""
    date: str                              # ISO format YYYY-MM-DD
    old_price: float
    new_price: float
    change_percent: str                    # e.g. "-15.0%"
    reason: str
    confidence: Literal["high", "medium", "low"]
    rule_applied: str                      # e.g. "orphan_day", "lead_time_7"


# ─── Revenue Models ────────────────────────────────────────────────────────────

@dataclass
class RevenueMetrics:
    """Core revenue KPIs."""
    total_revenue: float
    bookings: int
    available_days: int
    adr: float          # Average Daily Rate
    occupancy: float    # 0.0 – 1.0
    rev_par: float      # Revenue Per Available Room


# ─── Validation Models ─────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str] = field(default_factory=list)


# ─── Output Models ─────────────────────────────────────────────────────────────

@dataclass
class SummaryBlock:
    pacing_status: str       # e.g. "behind -12% vs LY"
    market_position: str     # e.g. "above comp set by 8%"
    risk_level: Literal["low", "medium", "high"]


@dataclass
class AgentOutput:
    """Final structured output from the Revenue Agent."""
    property_id: str
    date_range: str
    issues_detected: List[str]
    decisions: List[PricingDecision]
    summary: SummaryBlock
    next_actions: List[str]
    metrics: Optional[RevenueMetrics] = None
    status: str = "ok"
    error_type: Optional[str] = None
