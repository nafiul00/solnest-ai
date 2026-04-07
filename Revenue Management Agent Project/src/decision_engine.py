"""
Revenue Agent v2 — Decision Engine
Orchestrates signal detection and pricing rules in strict priority order.

Priority order:
  1. Lead Time
  2. Pacing
  3. Comp Set
  4. Events / Seasonality
  5. Inventory Gaps
  6. Booking Velocity
"""

from typing import List, Optional
from datetime import date

from models import (
    PropertyData,
    SignalBundle,
    PricingDecision,
    BookingRecord,
    EventData,
    InventorySignal,
)
from signal_detection import SignalDetector
from pricing_rules import PricingRulesEngine


class DecisionEngine:
    """Applies all pricing rules in strict priority order and merges results."""

    # ── Public API ────────────────────────────────────────────────────────────

    def run(self, data: PropertyData) -> List[PricingDecision]:
        """Run the full decision pipeline for a property.

        Steps:
            1. Detect signals via SignalDetector.
            2. Walk each unbooked calendar day and apply rules by priority.
            3. Apply velocity rule across all future dates.
            4. Merge decisions (largest absolute change wins per date).
            5. Return sorted, deduplicated decisions.
        """
        if not data.calendar:
            return []

        # 1 — Detect signals
        detector = SignalDetector()
        signals: SignalBundle = detector.detect_all(data)

        # 2 — Prepare rules engine
        rules = PricingRulesEngine()

        # Pre-index helpers for O(1) lookups
        events_by_date: dict[date, EventData] = {e.date: e for e in data.events}
        inventory_dates: set[date] = set()
        for inv_signal in signals.inventory:
            for d in inv_signal.affected_dates:
                inventory_dates.add(d)

        market_dates: set[date] = set()
        if signals.market and signals.market.affected_dates:
            market_dates = set(signals.market.affected_dates)

        pacing_delta: float = signals.pacing.delta_percent if signals.pacing else 0.0
        pacing_behind: bool = pacing_delta < -5.0

        decisions: List[PricingDecision] = []

        # 3 — Per-date rule application (unbooked days only)
        for record in data.calendar:
            if record.is_booked:
                continue

            date_str = record.date.isoformat()

            # Priority 1 — Lead Time
            lead_decision = rules.apply_lead_time_rule(record, data.analysis_date)
            if lead_decision is not None:
                decisions.append(lead_decision)

            # Priority 2 — Pacing (additive adjustment, not standalone)
            if pacing_behind and lead_decision is not None:
                adjusted = self._apply_pacing_adjustment(lead_decision, pacing_delta)
                decisions.append(adjusted)
            elif pacing_behind:
                # Create a pacing-only decision when no lead-time decision exists
                pacing_decision = PricingDecision(
                    date=date_str,
                    old_price=record.price,
                    new_price=round(record.price * 0.95, 2),
                    change_percent="-5.0%",
                    reason="Pacing behind — reducing price | pacing adjustment",
                    confidence="medium",
                    rule_applied="pacing",
                )
                decisions.append(pacing_decision)

            # Priority 3 — Comp Set
            if record.date in market_dates and signals.market is not None:
                comp_decision = rules.apply_comp_set_rule(record, signals.market)
                if comp_decision is not None:
                    decisions.append(comp_decision)

            # Priority 4 — Events / Seasonality
            if record.date in events_by_date:
                event_decision = rules.apply_event_rule(record, data.events)
                if event_decision is not None:
                    decisions.append(event_decision)

            # Priority 5 — Inventory Gaps
            if record.date in inventory_dates:
                matching_signals = [
                    s for s in signals.inventory if record.date in s.affected_dates
                ]
                for inv_signal in matching_signals:
                    gap_decision = rules.apply_gap_rule(record, data.calendar, inv_signal)
                    if gap_decision is not None:
                        decisions.append(gap_decision)

        # 4 — Priority 6: Booking Velocity (cross-date rule)
        velocity_decisions = rules.apply_velocity_rule(signals.booking, data.calendar)
        if velocity_decisions:
            decisions.extend(velocity_decisions)

        # 5 — Merge and deduplicate
        merged = self._merge_decisions(decisions)

        # 6 — Sort by date ascending
        merged.sort(key=lambda d: d.date)
        return merged

    # ── Internal Helpers ──────────────────────────────────────────────────────

    def _merge_decisions(
        self, decisions: List[PricingDecision]
    ) -> List[PricingDecision]:
        """Group decisions by date; keep the one with the largest absolute change.

        Never compounds multiple percentage adjustments — only the single
        largest-magnitude change survives for each date.
        """
        if not decisions:
            return []

        by_date: dict[str, List[PricingDecision]] = {}
        for d in decisions:
            by_date.setdefault(d.date, []).append(d)

        merged: List[PricingDecision] = []
        for date_str, group in by_date.items():
            best = max(group, key=lambda d: abs(_parse_change_percent(d.change_percent)))
            merged.append(best)

        return merged

    def _apply_pacing_adjustment(
        self, decision: PricingDecision, pacing_delta: float
    ) -> PricingDecision:
        """Apply an additional -5% pacing nudge on top of an existing decision.

        Returns a NEW PricingDecision with the combined effect so that the
        merge step can compare it against the original.
        """
        additional_factor = 0.95  # -5%
        adjusted_price = round(decision.new_price * additional_factor, 2)
        old_price = decision.old_price

        if old_price != 0:
            total_change = ((adjusted_price - old_price) / old_price) * 100.0
        else:
            total_change = 0.0

        return PricingDecision(
            date=decision.date,
            old_price=old_price,
            new_price=adjusted_price,
            change_percent=f"{total_change:+.1f}%",
            reason=f"{decision.reason} | pacing adjustment",
            confidence=decision.confidence,
            rule_applied=decision.rule_applied,
        )

    def _collect_issues(self, signals: SignalBundle) -> List[str]:
        """Convert all detected signals into human-readable issue strings."""
        issues: List[str] = []

        # Booking signals
        if signals.booking is not None:
            if signals.booking.signal_type == "no_booking":
                days = len(signals.booking.affected_dates)
                issues.append(
                    f"No bookings in next {days} days — possible overpricing"
                )
            elif signals.booking.signal_type == "fast_booking":
                issues.append(signals.booking.description)

        # Pacing signals
        if signals.pacing is not None:
            if signals.pacing.signal_type == "behind":
                delta = abs(signals.pacing.delta_percent)
                issues.append(f"Pacing behind by {delta:.0f}% vs last year")
            elif signals.pacing.signal_type == "ahead":
                delta = signals.pacing.delta_percent
                issues.append(f"Pacing ahead by {delta:.0f}% vs last year")

        # Inventory signals
        for inv in signals.inventory:
            if inv.signal_type == "orphan_day":
                for d in inv.affected_dates:
                    issues.append(f"Orphan day detected on {d.isoformat()}")
            elif inv.signal_type == "long_gap":
                start = min(inv.affected_dates).isoformat()
                end = max(inv.affected_dates).isoformat()
                issues.append(
                    f"Long gap of {inv.gap_length} days from {start} to {end}"
                )
            elif inv.signal_type == "weekday_gap":
                start = min(inv.affected_dates).isoformat()
                end = max(inv.affected_dates).isoformat()
                issues.append(
                    f"Weekday gap ({inv.gap_length} days) from {start} to {end}"
                )

        # Market signals
        if signals.market is not None:
            if signals.market.signal_type == "overpriced":
                diff = signals.market.our_avg_price - signals.market.comp_avg_price
                issues.append(
                    f"Overpriced vs comp set by ${diff:.0f}/night "
                    f"(${signals.market.our_avg_price:.0f} vs "
                    f"${signals.market.comp_avg_price:.0f})"
                )
            elif signals.market.signal_type == "underpriced":
                diff = signals.market.comp_avg_price - signals.market.our_avg_price
                issues.append(
                    f"Underpriced vs comp set by ${diff:.0f}/night "
                    f"(${signals.market.our_avg_price:.0f} vs "
                    f"${signals.market.comp_avg_price:.0f})"
                )

        return issues


# ── Module-level utility ──────────────────────────────────────────────────────

def _parse_change_percent(value: str) -> float:
    """Parse a change_percent string like '+15.0%' or '-5.0%' into a float."""
    try:
        return float(value.replace("%", "").replace("+", ""))
    except (ValueError, AttributeError):
        return 0.0
