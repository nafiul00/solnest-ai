"""
Revenue Calculation Engine
Calculates core revenue KPIs from booking calendars and pricing decisions.
"""

from datetime import date
from typing import List

from models import BookingRecord, PricingDecision, RevenueMetrics


class RevenueCalculator:
    """Computes revenue metrics from calendar data and pricing decisions."""

    def calculate(self, calendar: List[BookingRecord]) -> RevenueMetrics:
        """Calculate revenue metrics from a 30-day booking calendar.

        Args:
            calendar: List of BookingRecord entries representing each day.

        Returns:
            RevenueMetrics with total_revenue, bookings, available_days,
            adr, occupancy, and rev_par.
        """
        available_days = len(calendar)
        booked_days = [day for day in calendar if day.is_booked]
        total_bookings = len(booked_days)

        total_revenue = round(sum(day.price for day in booked_days), 2)

        if total_bookings == 0:
            adr = 0.0
            occupancy = 0.0
            rev_par = 0.0
        else:
            adr = round(total_revenue / total_bookings, 2)
            occupancy = round(total_bookings / available_days, 4) if available_days > 0 else 0.0
            rev_par = round(adr * occupancy, 2)

        return RevenueMetrics(
            total_revenue=total_revenue,
            bookings=total_bookings,
            available_days=available_days,
            adr=adr,
            occupancy=occupancy,
            rev_par=rev_par,
        )

    def project_with_decisions(
        self,
        calendar: List[BookingRecord],
        decisions: List[PricingDecision],
    ) -> RevenueMetrics:
        """Project revenue metrics after applying pricing decisions.

        Creates a modified copy of the calendar with decision prices applied,
        then calculates metrics on the adjusted calendar.

        Args:
            calendar: Original 30-day booking calendar.
            decisions: List of pricing decisions to apply.

        Returns:
            RevenueMetrics reflecting projected revenue with new prices.
        """
        # Build a lookup of date string -> new_price from decisions
        price_overrides: dict[str, float] = {
            d.date: d.new_price for d in decisions
        }

        # Create adjusted calendar entries
        adjusted_calendar: List[BookingRecord] = []
        for record in calendar:
            date_str = record.date.isoformat()
            if date_str in price_overrides:
                adjusted_record = BookingRecord(
                    date=record.date,
                    is_booked=record.is_booked,
                    price=price_overrides[date_str],
                    booked_on=record.booked_on,
                )
                adjusted_calendar.append(adjusted_record)
            else:
                adjusted_calendar.append(record)

        return self.calculate(adjusted_calendar)

    def calculate_pacing_metrics(
        self,
        calendar: List[BookingRecord],
        last_year: List[BookingRecord],
    ) -> dict:
        """Compare current booking pace against last year.

        Args:
            calendar: Current year's booking calendar.
            last_year: Same window from the previous year.

        Returns:
            Dict with keys: current_occ, last_year_occ, delta_pct, status.
            status is one of "ahead", "behind", or "on_track".
        """
        current_booked = sum(1 for day in calendar if day.is_booked)
        current_total = len(calendar)
        current_occ = round(current_booked / current_total, 4) if current_total > 0 else 0.0

        ly_booked = sum(1 for day in last_year if day.is_booked)
        ly_total = len(last_year)
        ly_occ = round(ly_booked / ly_total, 4) if ly_total > 0 else 0.0

        if ly_occ == 0.0:
            delta_pct = 100.0 if current_occ > 0 else 0.0
        else:
            delta_pct = round(((current_occ - ly_occ) / ly_occ) * 100, 2)

        # Determine status using a 5% threshold for "on_track"
        if delta_pct > 5.0:
            status = "ahead"
        elif delta_pct < -5.0:
            status = "behind"
        else:
            status = "on_track"

        return {
            "current_occ": current_occ,
            "last_year_occ": ly_occ,
            "delta_pct": delta_pct,
            "status": status,
        }
