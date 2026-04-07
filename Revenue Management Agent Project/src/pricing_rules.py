"""
Pricing Rules Engine
Translates detected signals into concrete pricing decisions with
adjustment percentages, confidence levels, and audit-ready reasoning.
"""

import logging
from datetime import date
from typing import List, Optional

from models import (
    BookingRecord,
    BookingSignal,
    EventData,
    InventorySignal,
    MarketSignal,
    PricingDecision,
)

logger = logging.getLogger(__name__)


class PricingRulesEngine:
    """Applies rule-based pricing adjustments driven by signal output."""

    # ── Lead-Time Rule ────────────────────────────────────────────────────

    def apply_lead_time_rule(
        self, record: BookingRecord, analysis_date: date
    ) -> Optional[PricingDecision]:
        """Adjust price based on how far out the date is from today.

        Bands:
            90+ days  : +10%
            60-89     : +5%
            30-59     : no change (return None)
            14-29     : -5%
            7-13      : -15%
            0-6       : -20%

        Args:
            record: The booking record to evaluate.
            analysis_date: The analysis reference date (today).

        Returns:
            PricingDecision or None if no adjustment is needed.
        """
        if record.is_booked:
            return None

        days_out = (record.date - analysis_date).days
        if days_out < 0:
            return None

        if days_out >= 90:
            pct = 0.10
            band = "90+"
            confidence = "medium"
        elif days_out >= 60:
            pct = 0.05
            band = "60-89"
            confidence = "medium"
        elif days_out >= 30:
            # No change in this band
            return None
        elif days_out >= 14:
            pct = -0.05
            band = "14-29"
            confidence = "medium"
        elif days_out >= 7:
            pct = -0.15
            band = "7-13"
            confidence = "high"
        else:
            pct = -0.20
            band = "0-6"
            confidence = "high"

        new_price = round(record.price * (1 + pct), 2)

        logger.debug(
            "lead_time rule: %s band, days_out=%d, %.0f -> %.0f",
            band, days_out, record.price, new_price,
        )

        return PricingDecision(
            date=record.date.isoformat(),
            old_price=record.price,
            new_price=new_price,
            change_percent=self.calculate_change_percent(record.price, new_price),
            reason=f"Lead-time adjustment for {band}-day band ({days_out} days out).",
            confidence=confidence,
            rule_applied=f"lead_time_{band}",
        )

    # ── Gap Rule ──────────────────────────────────────────────────────────

    def apply_gap_rule(
        self,
        record: BookingRecord,
        calendar: List[BookingRecord],
        signal: InventorySignal,
    ) -> Optional[PricingDecision]:
        """Discount orphan days, long gaps, and weekday gaps to fill inventory.

        Args:
            record: The booking record to evaluate.
            calendar: Full calendar (unused directly but available for context).
            signal: The inventory signal describing the gap type.

        Returns:
            PricingDecision or None if the record is not in the signal's dates.
        """
        if record.is_booked:
            return None
        if record.date not in signal.affected_dates:
            return None

        pct_map = {
            "orphan_day": -0.20,
            "long_gap": -0.125,
            "weekday_gap": -0.10,
        }
        pct = pct_map.get(signal.signal_type)
        if pct is None:
            return None

        new_price = round(record.price * (1 + pct), 2)

        logger.debug(
            "gap rule: %s on %s, %.0f -> %.0f",
            signal.signal_type, record.date.isoformat(), record.price, new_price,
        )

        return PricingDecision(
            date=record.date.isoformat(),
            old_price=record.price,
            new_price=new_price,
            change_percent=self.calculate_change_percent(record.price, new_price),
            reason=(
                f"Gap fill ({signal.signal_type}): {signal.description}"
            ),
            confidence="medium",
            rule_applied=signal.signal_type,
        )

    # ── Velocity Rule ─────────────────────────────────────────────────────

    def apply_velocity_rule(
        self, signal: Optional[BookingSignal], future_records: List[BookingRecord]
    ) -> List[PricingDecision]:
        """Adjust future unbooked prices based on booking velocity.

        Args:
            signal: The booking signal (may be None for safety).
            future_records: All calendar records to potentially adjust.

        Returns:
            List of PricingDecision objects for unbooked dates.
        """
        if signal is None or signal.signal_type == "normal":
            return []

        pct_map = {
            "fast_booking": 0.10,
            "no_booking": -0.10,
        }
        pct = pct_map.get(signal.signal_type, 0.0)
        if pct == 0.0:
            return []

        decisions: List[PricingDecision] = []
        for rec in future_records:
            if rec.is_booked:
                continue
            new_price = round(rec.price * (1 + pct), 2)
            decisions.append(
                PricingDecision(
                    date=rec.date.isoformat(),
                    old_price=rec.price,
                    new_price=new_price,
                    change_percent=self.calculate_change_percent(
                        rec.price, new_price
                    ),
                    reason=(
                        f"Velocity adjustment ({signal.signal_type}): "
                        f"{signal.description}"
                    ),
                    confidence="medium",
                    rule_applied=f"velocity_{signal.signal_type}",
                )
            )

        logger.debug(
            "velocity rule: %s — %d decisions generated",
            signal.signal_type, len(decisions),
        )
        return decisions

    # ── Comp-Set Rule ─────────────────────────────────────────────────────

    def apply_comp_set_rule(
        self, record: BookingRecord, signal: MarketSignal
    ) -> Optional[PricingDecision]:
        """Adjust price toward competitive alignment.

        Args:
            record: The booking record to evaluate.
            signal: The market signal describing positioning vs comp set.

        Returns:
            PricingDecision or None if already aligned or record not affected.
        """
        if record.is_booked:
            return None
        if signal.signal_type == "aligned":
            return None
        if record.date not in signal.affected_dates:
            return None

        pct_map = {
            "underpriced": 0.08,
            "overpriced": -0.08,
        }
        pct = pct_map.get(signal.signal_type)
        if pct is None:
            return None

        new_price = round(record.price * (1 + pct), 2)

        logger.debug(
            "comp_set rule: %s on %s, %.0f -> %.0f",
            signal.signal_type, record.date.isoformat(), record.price, new_price,
        )

        return PricingDecision(
            date=record.date.isoformat(),
            old_price=record.price,
            new_price=new_price,
            change_percent=self.calculate_change_percent(record.price, new_price),
            reason=(
                f"Comp-set adjustment ({signal.signal_type}): {signal.description}"
            ),
            confidence="medium",
            rule_applied=f"comp_set_{signal.signal_type}",
        )

    # ── Event Rule ────────────────────────────────────────────────────────

    def apply_event_rule(
        self, record: BookingRecord, events: List[EventData]
    ) -> Optional[PricingDecision]:
        """Surge pricing for local events by demand level.

        When multiple events fall on the same date, the highest-demand
        event is used.

        Args:
            record: The booking record to evaluate.
            events: All events for the analysis window.

        Returns:
            PricingDecision or None if no event falls on this date.
        """
        if record.is_booked:
            return None

        pct_map = {
            "low": 0.15,
            "medium": 0.25,
            "high": 0.40,
        }

        matching_event: Optional[EventData] = None
        for event in events:
            if event.date == record.date:
                # If multiple events on the same date, use the highest demand
                if matching_event is None or pct_map.get(
                    event.demand_level, 0
                ) > pct_map.get(matching_event.demand_level, 0):
                    matching_event = event

        if matching_event is None:
            return None

        pct = pct_map[matching_event.demand_level]
        new_price = round(record.price * (1 + pct), 2)

        logger.debug(
            "event rule: %s demand (%s) on %s, %.0f -> %.0f",
            matching_event.demand_level,
            matching_event.name,
            record.date.isoformat(),
            record.price,
            new_price,
        )

        return PricingDecision(
            date=record.date.isoformat(),
            old_price=record.price,
            new_price=new_price,
            change_percent=self.calculate_change_percent(record.price, new_price),
            reason=(
                f"Event surge ({matching_event.demand_level} demand): "
                f"{matching_event.name} on {matching_event.date.isoformat()}."
            ),
            confidence="high",
            rule_applied=f"event_{matching_event.demand_level}",
        )

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def calculate_change_percent(old_price: float, new_price: float) -> str:
        """Return a formatted percentage string like '+10.0%' or '-15.0%'.

        Handles the edge case of a zero old_price gracefully.

        Args:
            old_price: Original price.
            new_price: New price after adjustment.

        Returns:
            Formatted string like '+10.0%' or '-15.0%'.
        """
        if old_price == 0.0:
            return "+0.0%"
        change = ((new_price - old_price) / old_price) * 100
        return f"{change:+.1f}%"
