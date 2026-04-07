"""
Tests for RevenueCalculator and ValidationLayer.
Uses Python stdlib unittest only.

Run from project root:
    python -m unittest discover tests
"""

import sys
import os
import unittest
from datetime import date, timedelta

SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC_DIR))

from models import BookingRecord, PricingDecision, RevenueMetrics, AgentOutput, SummaryBlock, PropertyData
from revenue_calculator import RevenueCalculator
from validation_layer import ValidationLayer


def make_calendar(start: date, prices_and_booked: list) -> list:
    """Build calendar from list of (price, is_booked) tuples."""
    return [
        BookingRecord(date=start + timedelta(days=i), is_booked=booked, price=price)
        for i, (price, booked) in enumerate(prices_and_booked)
    ]


def make_decision(d: str, old: float, new: float) -> PricingDecision:
    pct = ((new - old) / old * 100) if old != 0 else 0.0
    sign = "+" if pct >= 0 else ""
    return PricingDecision(
        date=d, old_price=old, new_price=new,
        change_percent=f"{sign}{pct:.1f}%",
        reason="test", confidence="high", rule_applied="test"
    )


class TestRevenueCalculatorBasic(unittest.TestCase):

    def setUp(self):
        self.calc = RevenueCalculator()
        self.start = date(2025, 6, 1)

    def test_known_revenue(self):
        """10 booked days at $150 → revenue=1500, ADR=150."""
        cal = make_calendar(self.start, [(150.0, True)] * 10 + [(150.0, False)] * 5)
        metrics = self.calc.calculate(cal)
        self.assertAlmostEqual(metrics.total_revenue, 1500.0, places=2)
        self.assertAlmostEqual(metrics.adr, 150.0, places=2)
        self.assertEqual(metrics.bookings, 10)
        self.assertEqual(metrics.available_days, 15)

    def test_occupancy_formula(self):
        """Occupancy = bookings / available_days."""
        cal = make_calendar(self.start, [(200.0, True)] * 8 + [(200.0, False)] * 2)
        metrics = self.calc.calculate(cal)
        self.assertAlmostEqual(metrics.occupancy, 0.8, places=3)

    def test_revpar_formula(self):
        """RevPAR = ADR × Occupancy (must be ≤ ADR)."""
        cal = make_calendar(self.start, [(200.0, True)] * 6 + [(200.0, False)] * 4)
        metrics = self.calc.calculate(cal)
        expected_revpar = metrics.adr * metrics.occupancy
        self.assertAlmostEqual(metrics.rev_par, expected_revpar, places=2)
        self.assertLessEqual(metrics.rev_par, metrics.adr)

    def test_zero_bookings_no_crash(self):
        """No bookings → revenue=0, ADR=0, RevPAR=0."""
        cal = make_calendar(self.start, [(200.0, False)] * 10)
        metrics = self.calc.calculate(cal)
        self.assertEqual(metrics.total_revenue, 0.0)
        self.assertEqual(metrics.adr, 0.0)
        self.assertEqual(metrics.rev_par, 0.0)
        self.assertEqual(metrics.occupancy, 0.0)

    def test_empty_calendar_no_crash(self):
        """Empty calendar returns zero metrics."""
        metrics = self.calc.calculate([])
        self.assertEqual(metrics.total_revenue, 0.0)
        self.assertEqual(metrics.bookings, 0)

    def test_full_occupancy(self):
        """All days booked → occupancy = 1.0."""
        cal = make_calendar(self.start, [(180.0, True)] * 30)
        metrics = self.calc.calculate(cal)
        self.assertAlmostEqual(metrics.occupancy, 1.0, places=3)
        self.assertAlmostEqual(metrics.rev_par, metrics.adr, places=2)


class TestRevenueCalculatorProjections(unittest.TestCase):

    def setUp(self):
        self.calc = RevenueCalculator()
        self.start = date(2025, 6, 1)

    def test_project_with_decisions_applies_price(self):
        """Projection uses new_price from decisions on matching dates."""
        cal = make_calendar(self.start, [(200.0, False)] * 3)
        decisions = [
            make_decision(self.start.isoformat(), 200.0, 160.0),
            make_decision((self.start + timedelta(1)).isoformat(), 200.0, 160.0),
        ]
        projected = self.calc.project_with_decisions(cal, decisions)
        # Days 0 and 1 adjusted to 160, day 2 still 200 but unbooked
        # Only booked days count — but none are booked, so revenue=0
        self.assertEqual(projected.total_revenue, 0.0)

    def test_project_improves_revenue_on_booked_dates(self):
        """Projected revenue increases when new_price is applied to booked days."""
        d0 = self.start.isoformat()
        cal = [BookingRecord(date=self.start, is_booked=True, price=150.0)]
        decisions = [make_decision(d0, 150.0, 200.0)]
        projected = self.calc.project_with_decisions(cal, decisions)
        self.assertAlmostEqual(projected.total_revenue, 200.0, places=2)

    def test_project_no_decisions_matches_calculate(self):
        """Empty decisions list returns same metrics as calculate()."""
        cal = make_calendar(self.start, [(200.0, True)] * 5 + [(200.0, False)] * 5)
        base = self.calc.calculate(cal)
        projected = self.calc.project_with_decisions(cal, [])
        self.assertAlmostEqual(projected.total_revenue, base.total_revenue, places=2)


class TestPacingMetrics(unittest.TestCase):

    def setUp(self):
        self.calc = RevenueCalculator()
        self.start = date(2025, 6, 1)

    def _cal(self, booked: int, total: int) -> list:
        return make_calendar(self.start, [(200.0, True)] * booked + [(200.0, False)] * (total - booked))

    def test_ahead_pacing(self):
        result = self.calc.calculate_pacing_metrics(self._cal(9, 10), self._cal(5, 10))
        self.assertEqual(result["status"], "ahead")
        self.assertGreater(result["delta_pct"], 5)

    def test_behind_pacing(self):
        result = self.calc.calculate_pacing_metrics(self._cal(3, 10), self._cal(8, 10))
        self.assertEqual(result["status"], "behind")
        self.assertLess(result["delta_pct"], -5)

    def test_on_track_pacing(self):
        result = self.calc.calculate_pacing_metrics(self._cal(5, 10), self._cal(5, 10))
        self.assertEqual(result["status"], "on_track")

    def test_empty_last_year_no_crash(self):
        result = self.calc.calculate_pacing_metrics(self._cal(5, 10), [])
        self.assertIsNotNone(result)
        self.assertEqual(result["last_year_occ"], 0.0)


class TestValidationLayerMetrics(unittest.TestCase):

    def setUp(self):
        self.vl = ValidationLayer()

    def _metrics(self, adr=200.0, occ=0.5, total_rev=1000.0, bookings=5, avail=10):
        rev_par = round(adr * occ, 2)
        return RevenueMetrics(
            total_revenue=total_rev, bookings=bookings, available_days=avail,
            adr=adr, occupancy=occ, rev_par=rev_par
        )

    def test_valid_metrics_pass(self):
        m = self._metrics()
        result = self.vl.validate_metrics(m)
        self.assertTrue(result.is_valid)
        self.assertEqual(result.errors, [])

    def test_revpar_greater_than_adr_fails(self):
        """RevPAR > ADR is mathematically impossible — should fail."""
        m = RevenueMetrics(total_revenue=2000, bookings=5, available_days=10,
                           adr=200.0, occupancy=0.5, rev_par=250.0)  # impossible
        result = self.vl.validate_metrics(m)
        self.assertFalse(result.is_valid)
        self.assertTrue(any("RevPAR" in e for e in result.errors))

    def test_occupancy_above_1_fails(self):
        m = RevenueMetrics(total_revenue=2000, bookings=15, available_days=10,
                           adr=200.0, occupancy=1.5, rev_par=300.0)
        result = self.vl.validate_metrics(m)
        self.assertFalse(result.is_valid)

    def test_negative_revenue_fails(self):
        m = RevenueMetrics(total_revenue=-100, bookings=0, available_days=10,
                           adr=0.0, occupancy=0.0, rev_par=0.0)
        result = self.vl.validate_metrics(m)
        self.assertFalse(result.is_valid)

    def test_bookings_exceed_available_fails(self):
        m = RevenueMetrics(total_revenue=2000, bookings=15, available_days=10,
                           adr=133.33, occupancy=1.0, rev_par=133.33)
        result = self.vl.validate_metrics(m)
        self.assertFalse(result.is_valid)


class TestValidationLayerDecisions(unittest.TestCase):

    def setUp(self):
        self.vl = ValidationLayer()

    def test_valid_decisions_pass(self):
        decisions = [make_decision("2025-06-10", 200.0, 170.0)]
        result = self.vl.validate_decisions(decisions)
        self.assertTrue(result.is_valid)

    def test_zero_new_price_fails(self):
        d = PricingDecision(date="2025-06-10", old_price=200.0, new_price=0.0,
                            change_percent="-100.0%", reason="test",
                            confidence="high", rule_applied="test")
        result = self.vl.validate_decisions([d])
        self.assertFalse(result.is_valid)

    def test_price_doubling_sanity_check_fails(self):
        d = make_decision("2025-06-10", 100.0, 250.0)  # 2.5x
        result = self.vl.validate_decisions([d])
        self.assertFalse(result.is_valid)

    def test_duplicate_dates_fail(self):
        d1 = make_decision("2025-06-10", 200.0, 170.0)
        d2 = make_decision("2025-06-10", 200.0, 180.0)
        result = self.vl.validate_decisions([d1, d2])
        self.assertFalse(result.is_valid)

    def test_empty_decisions_pass(self):
        result = self.vl.validate_decisions([])
        self.assertTrue(result.is_valid)


class TestValidationLayerPropertyData(unittest.TestCase):

    def setUp(self):
        self.vl = ValidationLayer()
        self.start = date(2025, 6, 1)

    def _data(self, pid="PROP-001", base=200.0, cal=None):
        if cal is None:
            cal = [BookingRecord(date=self.start, is_booked=False, price=200.0)]
        return PropertyData(
            property_id=pid, base_price=base,
            calendar=cal, last_year_calendar=[], comp_set=[], events=[]
        )

    def test_valid_data_passes(self):
        result = self.vl.validate_property_data(self._data())
        self.assertTrue(result.is_valid)

    def test_empty_property_id_fails(self):
        result = self.vl.validate_property_data(self._data(pid=""))
        self.assertFalse(result.is_valid)

    def test_zero_base_price_fails(self):
        result = self.vl.validate_property_data(self._data(base=0.0))
        self.assertFalse(result.is_valid)

    def test_empty_calendar_fails(self):
        result = self.vl.validate_property_data(self._data(cal=[]))
        self.assertFalse(result.is_valid)

    def test_zero_price_in_calendar_fails(self):
        cal = [BookingRecord(date=self.start, is_booked=False, price=0.0)]
        result = self.vl.validate_property_data(self._data(cal=cal))
        self.assertFalse(result.is_valid)


class TestErrorResponse(unittest.TestCase):

    def setUp(self):
        self.vl = ValidationLayer()

    def test_error_response_format(self):
        response = self.vl.create_error_response(["something went wrong"])
        self.assertEqual(response["status"], "error")
        self.assertEqual(response["error_type"], "INVALID_CALCULATION")
        self.assertIn("errors", response)


if __name__ == "__main__":
    unittest.main()
