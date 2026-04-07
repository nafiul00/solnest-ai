"""
Pytest configuration and shared fixtures for the Revenue Agent test suite.
"""

import sys
import os
from datetime import date, timedelta

import pytest

# Ensure src/ is on the path for all test modules
SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC_DIR))

from models import (
    BookingRecord,
    CompSetEntry,
    EventData,
    PropertyData,
    PricingDecision,
    RevenueMetrics,
)


# ── Date fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def today() -> date:
    return date.today()


@pytest.fixture
def analysis_date() -> date:
    return date.today()


# ── Calendar builders ─────────────────────────────────────────────────────────

@pytest.fixture
def make_calendar():
    """Factory: make_calendar(start, [(price, is_booked), ...]) -> List[BookingRecord]"""
    def _make(start: date, price_booked_pairs: list) -> list:
        return [
            BookingRecord(
                date=start + timedelta(days=i),
                is_booked=booked,
                price=price,
                booked_on=(start - timedelta(days=10)) if booked else None,
            )
            for i, (price, booked) in enumerate(price_booked_pairs)
        ]
    return _make


@pytest.fixture
def make_property(today):
    """Factory: make_property(**overrides) -> PropertyData"""
    def _make(
        property_id: str = "PROP-TEST-001",
        base_price: float = 200.0,
        days: int = 30,
        booked_pattern: list = None,
        last_year_pattern: list = None,
        comp_price: float = None,
        comp_occ: float = 0.75,
        events: list = None,
    ) -> PropertyData:
        if booked_pattern is None:
            booked_pattern = [False] * days

        calendar = [
            BookingRecord(
                date=today + timedelta(days=i),
                is_booked=booked_pattern[i],
                price=base_price,
                booked_on=(today - timedelta(days=10)) if booked_pattern[i] else None,
            )
            for i in range(days)
        ]

        if last_year_pattern is None:
            last_year_pattern = [False] * days
        last_year_calendar = [
            BookingRecord(
                date=today + timedelta(days=i),
                is_booked=last_year_pattern[i],
                price=base_price * 0.9,
                booked_on=(today - timedelta(days=375)) if last_year_pattern[i] else None,
            )
            for i in range(days)
        ]

        comp_set = []
        if comp_price is not None:
            comp_set = [
                CompSetEntry(
                    date=today + timedelta(days=i),
                    avg_price=comp_price,
                    avg_occupancy=comp_occ,
                )
                for i in range(days)
            ]

        return PropertyData(
            property_id=property_id,
            base_price=base_price,
            calendar=calendar,
            last_year_calendar=last_year_calendar,
            comp_set=comp_set,
            events=events or [],
            analysis_date=today,
        )
    return _make


# ── Revenue metric builder ────────────────────────────────────────────────────

@pytest.fixture
def make_metrics():
    """Factory: make_metrics(**overrides) -> RevenueMetrics"""
    def _make(
        adr: float = 200.0,
        occupancy: float = 0.5,
        total_revenue: float = 1000.0,
        bookings: int = 5,
        available_days: int = 10,
    ) -> RevenueMetrics:
        rev_par = round(adr * occupancy, 2)
        return RevenueMetrics(
            total_revenue=total_revenue,
            bookings=bookings,
            available_days=available_days,
            adr=adr,
            occupancy=occupancy,
            rev_par=rev_par,
        )
    return _make


# ── Pricing decision builder ──────────────────────────────────────────────────

@pytest.fixture
def make_decision():
    """Factory: make_decision(date_str, old_price, new_price) -> PricingDecision"""
    def _make(date_str: str, old: float, new: float) -> PricingDecision:
        pct = ((new - old) / old * 100) if old != 0 else 0.0
        sign = "+" if pct >= 0 else ""
        return PricingDecision(
            date=date_str,
            old_price=old,
            new_price=new,
            change_percent=f"{sign}{pct:.1f}%",
            reason="test fixture",
            confidence="high",
            rule_applied="test",
        )
    return _make
