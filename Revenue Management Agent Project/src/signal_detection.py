"""
Signal Detection Layer
Detects booking velocity, inventory gaps, pacing, and market signals
from property calendar data and competitive set information.
"""

import logging
from datetime import date, timedelta
from typing import List

from models import (
    BookingRecord,
    BookingSignal,
    CompSetEntry,
    InventorySignal,
    MarketSignal,
    PacingSignal,
    PropertyData,
    SignalBundle,
)

logger = logging.getLogger(__name__)


class SignalDetector:
    """Analyzes property data to produce actionable pricing signals."""

    # ── Booking Velocity ──────────────────────────────────────────────────

    def detect_booking_signals(
        self, calendar: List[BookingRecord], analysis_date: date
    ) -> BookingSignal:
        """Classify booking velocity as fast, absent, or normal.

        - fast_booking: any date booked within 24h of the stay date
                        (|booked_on - stay_date| <= 1 day).
        - no_booking:   7+ consecutive unbooked days in the next 14 days.
        - normal:       everything else.

        Args:
            calendar: List of booking records for the property.
            analysis_date: The date from which to analyze (typically today).

        Returns:
            BookingSignal with appropriate signal_type.
        """
        if not calendar:
            return BookingSignal(
                signal_type="normal",
                affected_dates=[],
                description="No calendar data available.",
            )

        window_end = analysis_date + timedelta(days=14)

        # --- fast booking check ---
        fast_dates: List[date] = []
        for rec in calendar:
            if rec.is_booked and rec.booked_on is not None:
                days_to_book = (rec.booked_on - rec.date).days
                # Booked within 24 hours of the stay date (across day boundaries)
                if abs(days_to_book) <= 1:
                    fast_dates.append(rec.date)

        if fast_dates:
            logger.debug("fast_booking signal: %d dates", len(fast_dates))
            return BookingSignal(
                signal_type="fast_booking",
                affected_dates=sorted(fast_dates),
                description=(
                    f"{len(fast_dates)} date(s) booked within 24 hours of listing."
                ),
            )

        # --- no booking check (7+ consecutive unbooked in next 14 days) ---
        upcoming = sorted(
            [r for r in calendar if analysis_date <= r.date < window_end],
            key=lambda r: r.date,
        )
        max_run = 0
        current_run = 0
        run_dates: List[date] = []
        best_run_dates: List[date] = []

        for rec in upcoming:
            if not rec.is_booked:
                current_run += 1
                run_dates.append(rec.date)
                if current_run > max_run:
                    max_run = current_run
                    best_run_dates = list(run_dates)
            else:
                current_run = 0
                run_dates = []

        if max_run >= 7:
            logger.debug("no_booking signal: %d consecutive unbooked days", max_run)
            return BookingSignal(
                signal_type="no_booking",
                affected_dates=sorted(best_run_dates),
                description=(
                    f"{max_run} consecutive unbooked days detected in the next 14 days."
                ),
            )

        # --- normal ---
        return BookingSignal(
            signal_type="normal",
            affected_dates=[],
            description="Booking velocity is within normal range.",
        )

    # ── Inventory Gaps ────────────────────────────────────────────────────

    def detect_inventory_signals(
        self, calendar: List[BookingRecord]
    ) -> List[InventorySignal]:
        """Detect orphan days, long gaps, and weekday gaps.

        Args:
            calendar: List of booking records for the property.

        Returns:
            List of InventorySignal objects for each pattern found.
        """
        if not calendar:
            return []

        sorted_cal = sorted(calendar, key=lambda r: r.date)
        signals: List[InventorySignal] = []

        # --- orphan days (unbooked day with booked neighbours) ---
        for i in range(1, len(sorted_cal) - 1):
            prev_rec = sorted_cal[i - 1]
            curr_rec = sorted_cal[i]
            next_rec = sorted_cal[i + 1]

            if (
                not curr_rec.is_booked
                and prev_rec.is_booked
                and next_rec.is_booked
                # Ensure the three dates are actually consecutive
                and (curr_rec.date - prev_rec.date).days == 1
                and (next_rec.date - curr_rec.date).days == 1
            ):
                signals.append(
                    InventorySignal(
                        signal_type="orphan_day",
                        affected_dates=[curr_rec.date],
                        gap_length=1,
                        description=(
                            f"Orphan day on {curr_rec.date.isoformat()}: "
                            "single unbooked day between two bookings."
                        ),
                    )
                )
                logger.debug("orphan_day detected on %s", curr_rec.date.isoformat())

        # --- long gap (5+ consecutive unbooked in next 14 days) ---
        # Use the first date in the calendar as the window start
        window_start = sorted_cal[0].date
        window_end = window_start + timedelta(days=14)
        window_records = [r for r in sorted_cal if window_start <= r.date < window_end]

        run_dates: List[date] = []
        for rec in window_records:
            if not rec.is_booked:
                run_dates.append(rec.date)
            else:
                if len(run_dates) >= 5:
                    signals.append(
                        InventorySignal(
                            signal_type="long_gap",
                            affected_dates=list(run_dates),
                            gap_length=len(run_dates),
                            description=(
                                f"Long gap of {len(run_dates)} unbooked days "
                                f"from {run_dates[0].isoformat()} to "
                                f"{run_dates[-1].isoformat()}."
                            ),
                        )
                    )
                    logger.debug("long_gap of %d days detected", len(run_dates))
                run_dates = []

        # Flush remaining run
        if len(run_dates) >= 5:
            signals.append(
                InventorySignal(
                    signal_type="long_gap",
                    affected_dates=list(run_dates),
                    gap_length=len(run_dates),
                    description=(
                        f"Long gap of {len(run_dates)} unbooked days "
                        f"from {run_dates[0].isoformat()} to "
                        f"{run_dates[-1].isoformat()}."
                    ),
                )
            )
            logger.debug("long_gap of %d days detected (end of window)", len(run_dates))

        # --- weekday gap (unbooked Mon-Thu while surrounding weekend booked) ---
        # Build a set of all dates already captured in any signal (orphan or long_gap)
        already_signaled: set = {
            d for s in signals for d in s.affected_dates
        }

        for rec in sorted_cal:
            if rec.is_booked:
                continue
            # Monday=0 … Thursday=3
            if rec.date.weekday() > 3:
                continue

            # Find the preceding Saturday/Sunday and following Saturday/Sunday
            prev_weekend_booked = False
            next_weekend_booked = False

            for other in sorted_cal:
                diff = (rec.date - other.date).days
                # Previous weekend: 1-6 days before, on a Sat or Sun
                if other.date.weekday() in (5, 6) and 0 < diff <= 6 and other.is_booked:
                    prev_weekend_booked = True
                # Next weekend: 1-6 days after, on a Sat or Sun
                if other.date.weekday() in (5, 6) and -6 <= diff < 0 and other.is_booked:
                    next_weekend_booked = True

            if prev_weekend_booked and next_weekend_booked:
                # Skip if already captured by any other signal type
                if rec.date not in already_signaled:
                    signals.append(
                        InventorySignal(
                            signal_type="weekday_gap",
                            affected_dates=[rec.date],
                            gap_length=1,
                            description=(
                                f"Weekday gap on {rec.date.isoformat()} "
                                f"({rec.date.strftime('%A')}): unbooked while "
                                "surrounding weekends are booked."
                            ),
                        )
                    )
                    already_signaled.add(rec.date)
                    logger.debug(
                        "weekday_gap detected on %s (%s)",
                        rec.date.isoformat(),
                        rec.date.strftime("%A"),
                    )

        return signals

    # ── Pacing vs Last Year ───────────────────────────────────────────────

    def detect_pacing_signals(
        self,
        calendar: List[BookingRecord],
        last_year: List[BookingRecord],
    ) -> PacingSignal:
        """Compare current occupancy to the same window last year.

        Args:
            calendar: Current year booking records.
            last_year: Same date window from the previous year.

        Returns:
            PacingSignal indicating whether bookings are ahead, behind, or on track.
        """
        current_occ = self._occupancy_rate(calendar)
        ly_occ = self._occupancy_rate(last_year)
        delta = round((current_occ - ly_occ) * 100, 2)

        if delta > 5:
            signal_type = "ahead"
            desc = f"Occupancy is ahead of last year by {delta:.1f}pp."
        elif delta < -5:
            signal_type = "behind"
            desc = f"Occupancy is behind last year by {abs(delta):.1f}pp."
        else:
            signal_type = "on_track"
            desc = f"Occupancy is on track with last year (delta {delta:+.1f}pp)."

        logger.debug(
            "pacing signal: %s (current=%.1f%% LY=%.1f%% delta=%.1f%%)",
            signal_type,
            current_occ * 100,
            ly_occ * 100,
            delta,
        )

        return PacingSignal(
            signal_type=signal_type,
            current_occupancy=round(current_occ, 4),
            last_year_occupancy=round(ly_occ, 4),
            delta_percent=delta,
            description=desc,
        )

    # ── Market / Comp Set ─────────────────────────────────────────────────

    def detect_market_signals(
        self,
        calendar: List[BookingRecord],
        comp_set: List[CompSetEntry],
    ) -> MarketSignal:
        """Compare our pricing and occupancy against the competitive set.

        Args:
            calendar: Current year booking records with prices.
            comp_set: Competitor set data for the same date window.

        Returns:
            MarketSignal indicating underpriced, overpriced, or aligned status.
        """
        if not calendar or not comp_set:
            return MarketSignal(
                signal_type="aligned",
                affected_dates=[],
                our_avg_price=0.0,
                comp_avg_price=0.0,
                description="Insufficient data for market comparison.",
            )

        our_avg = sum(r.price for r in calendar) / len(calendar)
        comp_avg = sum(c.avg_price for c in comp_set) / len(comp_set)
        comp_occ = sum(c.avg_occupancy for c in comp_set) / len(comp_set)
        our_occ = self._occupancy_rate(calendar)

        affected: List[date] = []

        if our_avg < comp_avg and comp_occ > 0.7:
            signal_type = "underpriced"
            # Affected = unbooked dates where comp is booked
            comp_booked_dates = {
                c.date for c in comp_set if c.avg_occupancy > 0.7
            }
            affected = sorted(
                r.date
                for r in calendar
                if not r.is_booked and r.date in comp_booked_dates
            )
            desc = (
                f"Our avg price ${our_avg:.0f} is below comp avg ${comp_avg:.0f} "
                f"while comp occupancy is {comp_occ:.0%}."
            )
        elif our_avg > comp_avg and our_occ < 0.5:
            signal_type = "overpriced"
            affected = sorted(r.date for r in calendar if not r.is_booked)
            desc = (
                f"Our avg price ${our_avg:.0f} exceeds comp avg ${comp_avg:.0f} "
                f"and our occupancy is only {our_occ:.0%}."
            )
        else:
            signal_type = "aligned"
            desc = (
                f"Pricing is aligned with comp set "
                f"(ours ${our_avg:.0f} vs comp ${comp_avg:.0f})."
            )

        logger.debug("market signal: %s", signal_type)

        return MarketSignal(
            signal_type=signal_type,
            affected_dates=affected,
            our_avg_price=round(our_avg, 2),
            comp_avg_price=round(comp_avg, 2),
            description=desc,
        )

    # ── Aggregate ─────────────────────────────────────────────────────────

    def detect_all(self, data: PropertyData) -> SignalBundle:
        """Run every detector and return a consolidated SignalBundle.

        Args:
            data: Full property data including calendar, comp set, and events.

        Returns:
            SignalBundle with all detected signals.
        """
        logger.debug("Running full signal detection for property %s", data.property_id)
        return SignalBundle(
            booking=self.detect_booking_signals(data.calendar, data.analysis_date),
            inventory=self.detect_inventory_signals(data.calendar),
            pacing=self.detect_pacing_signals(
                data.calendar, data.last_year_calendar
            ),
            market=self.detect_market_signals(data.calendar, data.comp_set),
        )

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _occupancy_rate(records: List[BookingRecord]) -> float:
        """Return the fraction of booked days (0.0-1.0).

        Args:
            records: List of booking records.

        Returns:
            Occupancy rate between 0.0 and 1.0.
        """
        if not records:
            return 0.0
        booked = sum(1 for r in records if r.is_booked)
        return booked / len(records)
