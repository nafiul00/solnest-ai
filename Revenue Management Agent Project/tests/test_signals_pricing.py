"""
Tests for signal_detection.py and pricing_rules.py.
Uses Python stdlib unittest only.

Run from project root:
    cd src && python3 -m pytest ../tests/test_signals_pricing.py -v
"""

import sys
import os
import unittest
from datetime import date, timedelta

SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC_DIR))

from models import (
    BookingRecord, CompSetEntry, EventData, PropertyData,
    SignalBundle, BookingSignal, InventorySignal, PacingSignal, MarketSignal,
)
from signal_detection import SignalDetector
from pricing_rules import PricingRulesEngine


# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_record(d: date, is_booked: bool = False, price: float = 200.0,
                booked_on: date = None) -> BookingRecord:
    return BookingRecord(date=d, is_booked=is_booked, price=price, booked_on=booked_on)


def make_calendar(start: date, statuses: list, price: float = 200.0) -> list:
    return [
        BookingRecord(date=start + timedelta(days=i), is_booked=s, price=price)
        for i, s in enumerate(statuses)
    ]


def make_booking_signal(signal_type: str) -> BookingSignal:
    return BookingSignal(signal_type=signal_type, affected_dates=[], description="test")


# ─── SignalDetector — Booking Signals ─────────────────────────────────────────

class TestDetectBookingSignals(unittest.TestCase):

    def setUp(self):
        self.detector = SignalDetector()
        self.today = date(2026, 3, 22)

    def test_fast_booking_same_day(self):
        """booked_on == stay date → fast_booking."""
        stay = self.today + timedelta(5)
        cal = [make_record(stay, is_booked=True, booked_on=stay)]
        signal = self.detector.detect_booking_signals(cal, self.today)
        self.assertEqual(signal.signal_type, "fast_booking")
        self.assertIn(stay, signal.affected_dates)

    def test_fast_booking_one_day_before(self):
        """booked_on 1 day before stay → fast_booking (within 24h)."""
        stay = self.today + timedelta(5)
        cal = [make_record(stay, is_booked=True, booked_on=stay - timedelta(1))]
        signal = self.detector.detect_booking_signals(cal, self.today)
        self.assertEqual(signal.signal_type, "fast_booking")

    def test_fast_booking_two_days_before_is_not_fast(self):
        """booked_on 2 days before → NOT fast."""
        stay = self.today + timedelta(5)
        cal = [make_record(stay, is_booked=True, booked_on=stay - timedelta(2))]
        signal = self.detector.detect_booking_signals(cal, self.today)
        self.assertNotEqual(signal.signal_type, "fast_booking")

    def test_fast_booking_no_booked_on_is_not_fast(self):
        stay = self.today + timedelta(5)
        cal = [make_record(stay, is_booked=True, booked_on=None)]
        signal = self.detector.detect_booking_signals(cal, self.today)
        self.assertNotEqual(signal.signal_type, "fast_booking")

    def test_no_booking_seven_consecutive(self):
        """7+ consecutive unbooked days in 14-day window → no_booking."""
        cal = make_calendar(self.today, [False] * 7 + [True] * 7)
        signal = self.detector.detect_booking_signals(cal, self.today)
        self.assertEqual(signal.signal_type, "no_booking")

    def test_no_booking_six_consecutive_is_normal(self):
        """6 consecutive unbooked is not enough."""
        cal = make_calendar(self.today, [False] * 6 + [True] * 8)
        signal = self.detector.detect_booking_signals(cal, self.today)
        self.assertEqual(signal.signal_type, "normal")

    def test_no_booking_empty_calendar(self):
        signal = self.detector.detect_booking_signals([], self.today)
        self.assertEqual(signal.signal_type, "normal")

    def test_normal_mixed_bookings(self):
        cal = make_calendar(self.today, [True, False, True, False, True, False])
        signal = self.detector.detect_booking_signals(cal, self.today)
        self.assertEqual(signal.signal_type, "normal")

    def test_no_booking_window_boundary(self):
        """Exactly 7 consecutive unbooked at window boundary → no_booking."""
        cal = make_calendar(self.today, [False] * 7)
        signal = self.detector.detect_booking_signals(cal, self.today)
        self.assertEqual(signal.signal_type, "no_booking")

    def test_no_booking_outside_window_ignored(self):
        """Unbooked days starting beyond 14-day window don't trigger."""
        start = self.today + timedelta(days=15)
        cal = make_calendar(start, [False] * 10)
        signal = self.detector.detect_booking_signals(cal, self.today)
        self.assertEqual(signal.signal_type, "normal")


# ─── SignalDetector — Inventory Signals ───────────────────────────────────────

class TestDetectInventorySignals(unittest.TestCase):

    def setUp(self):
        self.detector = SignalDetector()

    def test_orphan_day_detected(self):
        d = date(2026, 3, 22)
        cal = [
            make_record(d, is_booked=True),
            make_record(d + timedelta(1), is_booked=False),
            make_record(d + timedelta(2), is_booked=True),
        ]
        signals = self.detector.detect_inventory_signals(cal)
        orphans = [s for s in signals if s.signal_type == "orphan_day"]
        self.assertEqual(len(orphans), 1)
        self.assertIn(d + timedelta(1), orphans[0].affected_dates)

    def test_orphan_day_non_consecutive_not_triggered(self):
        """Non-consecutive dates don't form an orphan."""
        d = date(2026, 3, 22)
        cal = [
            make_record(d, is_booked=True),
            make_record(d + timedelta(2), is_booked=False),  # gap in calendar
            make_record(d + timedelta(3), is_booked=True),
        ]
        signals = self.detector.detect_inventory_signals(cal)
        orphans = [s for s in signals if s.signal_type == "orphan_day"]
        self.assertEqual(len(orphans), 0)

    def test_orphan_day_both_neighbours_must_be_booked(self):
        d = date(2026, 3, 22)
        cal = [
            make_record(d, is_booked=False),
            make_record(d + timedelta(1), is_booked=False),
            make_record(d + timedelta(2), is_booked=True),
        ]
        signals = self.detector.detect_inventory_signals(cal)
        orphans = [s for s in signals if s.signal_type == "orphan_day"]
        self.assertEqual(len(orphans), 0)

    def test_orphan_day_empty_calendar(self):
        self.assertEqual(self.detector.detect_inventory_signals([]), [])

    def test_long_gap_five_consecutive(self):
        start = date(2026, 3, 22)
        cal = make_calendar(start, [False] * 5 + [True] * 9)
        signals = self.detector.detect_inventory_signals(cal)
        gaps = [s for s in signals if s.signal_type == "long_gap"]
        self.assertEqual(len(gaps), 1)

    def test_long_gap_four_consecutive_not_triggered(self):
        start = date(2026, 3, 22)
        cal = make_calendar(start, [False] * 4 + [True] * 10)
        signals = self.detector.detect_inventory_signals(cal)
        gaps = [s for s in signals if s.signal_type == "long_gap"]
        self.assertEqual(len(gaps), 0)

    def test_weekday_gap_detected(self):
        """Unbooked Mon-Thu with booked surrounding weekends → weekday_gap."""
        monday = date(2026, 3, 23)  # Monday
        self.assertEqual(monday.weekday(), 0)
        cal = [
            make_record(monday - timedelta(1), is_booked=True),   # Sunday
            make_record(monday, is_booked=False),
            make_record(monday + timedelta(5), is_booked=True),    # Saturday
        ]
        signals = self.detector.detect_inventory_signals(cal)
        wgaps = [s for s in signals if s.signal_type == "weekday_gap"]
        self.assertEqual(len(wgaps), 1)

    def test_orphan_not_also_weekday_gap(self):
        """A day captured as orphan should NOT also be captured as weekday_gap."""
        d = date(2026, 3, 23)  # Monday
        cal = [
            make_record(d - timedelta(1), is_booked=True),
            make_record(d, is_booked=False),
            make_record(d + timedelta(1), is_booked=True),
        ]
        signals = self.detector.detect_inventory_signals(cal)
        types = [s.signal_type for s in signals]
        if "orphan_day" in types:
            self.assertNotIn("weekday_gap", types,
                "Same date appeared in both orphan_day and weekday_gap")


# ─── SignalDetector — Pacing Signals ──────────────────────────────────────────

class TestDetectPacingSignals(unittest.TestCase):

    def setUp(self):
        self.detector = SignalDetector()
        self.start = date(2026, 3, 22)

    def _cal(self, booked: int, total: int) -> list:
        return make_calendar(self.start, [True] * booked + [False] * (total - booked))

    def test_pacing_ahead(self):
        signal = self.detector.detect_pacing_signals(self._cal(9, 10), self._cal(5, 10))
        self.assertEqual(signal.signal_type, "ahead")
        self.assertGreater(signal.delta_percent, 5)

    def test_pacing_behind(self):
        signal = self.detector.detect_pacing_signals(self._cal(3, 10), self._cal(9, 10))
        self.assertEqual(signal.signal_type, "behind")
        self.assertLess(signal.delta_percent, -5)

    def test_pacing_on_track(self):
        signal = self.detector.detect_pacing_signals(self._cal(5, 10), self._cal(5, 10))
        self.assertEqual(signal.signal_type, "on_track")

    def test_pacing_empty_last_year_no_crash(self):
        signal = self.detector.detect_pacing_signals(self._cal(7, 10), [])
        self.assertIsNotNone(signal)
        self.assertEqual(signal.last_year_occupancy, 0.0)

    def test_pacing_both_empty_no_crash(self):
        signal = self.detector.detect_pacing_signals([], [])
        self.assertIsNotNone(signal)
        self.assertEqual(signal.current_occupancy, 0.0)


# ─── SignalDetector — Market Signals ──────────────────────────────────────────

class TestDetectMarketSignals(unittest.TestCase):

    def setUp(self):
        self.detector = SignalDetector()
        self.start = date(2026, 3, 22)

    def _comp(self, avg_price, avg_occ, count=3):
        return [
            CompSetEntry(date=self.start + timedelta(i), avg_price=avg_price,
                         avg_occupancy=avg_occ)
            for i in range(count)
        ]

    def test_underpriced_detected(self):
        cal = make_calendar(self.start, [False] * 3, price=150.0)
        comp = self._comp(200.0, 0.8)
        signal = self.detector.detect_market_signals(cal, comp)
        self.assertEqual(signal.signal_type, "underpriced")

    def test_overpriced_detected(self):
        """Our price above comp and poor occupancy → overpriced."""
        cal = [
            make_record(self.start, is_booked=True, price=300.0),
            make_record(self.start + timedelta(1), is_booked=False, price=300.0),
            make_record(self.start + timedelta(2), is_booked=False, price=300.0),
            make_record(self.start + timedelta(3), is_booked=False, price=300.0),
        ]
        comp = self._comp(200.0, 0.6, count=4)
        signal = self.detector.detect_market_signals(cal, comp)
        self.assertEqual(signal.signal_type, "overpriced")

    def test_aligned(self):
        cal = make_calendar(self.start, [True] * 5 + [False] * 5, price=210.0)
        comp = self._comp(200.0, 0.6, count=10)
        signal = self.detector.detect_market_signals(cal, comp)
        self.assertEqual(signal.signal_type, "aligned")

    def test_empty_comp_set_no_crash(self):
        cal = [make_record(self.start, is_booked=False, price=200.0)]
        signal = self.detector.detect_market_signals(cal, [])
        self.assertIsNotNone(signal)

    def test_empty_calendar_no_crash(self):
        comp = self._comp(200.0, 0.8)
        signal = self.detector.detect_market_signals([], comp)
        self.assertIsNotNone(signal)


# ─── SignalDetector — detect_all ──────────────────────────────────────────────

class TestDetectAll(unittest.TestCase):

    def setUp(self):
        self.detector = SignalDetector()

    def test_returns_signal_bundle(self):
        today = date(2026, 3, 22)
        data = PropertyData(
            property_id="test", base_price=200.0,
            calendar=make_calendar(today, [True, False, True, False]),
            last_year_calendar=make_calendar(today, [True, False, True, False]),
            comp_set=[], events=[], analysis_date=today,
        )
        bundle = self.detector.detect_all(data)
        self.assertIsInstance(bundle, SignalBundle)
        self.assertIsNotNone(bundle.booking)
        self.assertIsNotNone(bundle.pacing)
        self.assertIsNotNone(bundle.market)
        self.assertIsInstance(bundle.inventory, list)

    def test_empty_property_no_crash(self):
        today = date(2026, 3, 22)
        data = PropertyData(
            property_id="test", base_price=200.0,
            calendar=[], last_year_calendar=[], comp_set=[], events=[],
            analysis_date=today,
        )
        bundle = self.detector.detect_all(data)
        self.assertIsInstance(bundle, SignalBundle)


# ─── PricingRulesEngine — Lead Time ───────────────────────────────────────────

class TestApplyLeadTimeRule(unittest.TestCase):

    def setUp(self):
        self.engine = PricingRulesEngine()
        self.today = date(2026, 3, 22)

    def _rec(self, days: int, price: float = 200.0) -> BookingRecord:
        return make_record(self.today + timedelta(days), is_booked=False, price=price)

    def test_90_plus_increase(self):
        d = self.engine.apply_lead_time_rule(self._rec(95), self.today)
        self.assertIsNotNone(d)
        self.assertAlmostEqual(d.new_price, 220.0, places=2)

    def test_60_to_89_increase(self):
        d = self.engine.apply_lead_time_rule(self._rec(75), self.today)
        self.assertIsNotNone(d)
        self.assertAlmostEqual(d.new_price, 210.0, places=2)

    def test_30_to_59_returns_none(self):
        for days in [30, 45, 59]:
            with self.subTest(days=days):
                self.assertIsNone(self.engine.apply_lead_time_rule(self._rec(days), self.today))

    def test_14_to_29_discount(self):
        d = self.engine.apply_lead_time_rule(self._rec(20), self.today)
        self.assertIsNotNone(d)
        self.assertAlmostEqual(d.new_price, 190.0, places=2)

    def test_7_to_13_discount(self):
        d = self.engine.apply_lead_time_rule(self._rec(10), self.today)
        self.assertIsNotNone(d)
        self.assertAlmostEqual(d.new_price, 170.0, places=2)

    def test_0_to_6_discount(self):
        d = self.engine.apply_lead_time_rule(self._rec(3), self.today)
        self.assertIsNotNone(d)
        self.assertAlmostEqual(d.new_price, 160.0, places=2)

    def test_booked_returns_none(self):
        rec = make_record(self.today + timedelta(5), is_booked=True)
        self.assertIsNone(self.engine.apply_lead_time_rule(rec, self.today))


# ─── PricingRulesEngine — Gap Rule ────────────────────────────────────────────

class TestApplyGapRule(unittest.TestCase):

    def setUp(self):
        self.engine = PricingRulesEngine()
        self.today = date(2026, 3, 22)

    def _orphan_signal(self, dates):
        from models import InventorySignal
        return InventorySignal(signal_type="orphan_day", affected_dates=dates,
                               gap_length=1, description="test")

    def test_orphan_day_discount(self):
        d = self.today + timedelta(5)
        rec = make_record(d, is_booked=False, price=200.0)
        sig = self._orphan_signal([d])
        decision = self.engine.apply_gap_rule(rec, [], sig)
        self.assertIsNotNone(decision)
        self.assertAlmostEqual(decision.new_price, 160.0, places=2)

    def test_date_not_in_affected_returns_none(self):
        d = self.today + timedelta(5)
        other = self.today + timedelta(10)
        rec = make_record(d, is_booked=False, price=200.0)
        sig = self._orphan_signal([other])
        self.assertIsNone(self.engine.apply_gap_rule(rec, [], sig))

    def test_booked_returns_none(self):
        d = self.today + timedelta(5)
        rec = make_record(d, is_booked=True, price=200.0)
        sig = self._orphan_signal([d])
        self.assertIsNone(self.engine.apply_gap_rule(rec, [], sig))

    def test_long_gap_discount(self):
        from models import InventorySignal
        d = self.today + timedelta(2)
        rec = make_record(d, is_booked=False, price=200.0)
        sig = InventorySignal(signal_type="long_gap", affected_dates=[d],
                              gap_length=5, description="test")
        decision = self.engine.apply_gap_rule(rec, [], sig)
        self.assertIsNotNone(decision)
        self.assertAlmostEqual(decision.new_price, 200.0 * 0.875, places=2)

    def test_weekday_gap_discount(self):
        from models import InventorySignal
        d = self.today + timedelta(1)
        rec = make_record(d, is_booked=False, price=200.0)
        sig = InventorySignal(signal_type="weekday_gap", affected_dates=[d],
                              gap_length=1, description="test")
        decision = self.engine.apply_gap_rule(rec, [], sig)
        self.assertIsNotNone(decision)
        self.assertAlmostEqual(decision.new_price, 180.0, places=2)


# ─── PricingRulesEngine — Velocity Rule ───────────────────────────────────────

class TestApplyVelocityRule(unittest.TestCase):

    def setUp(self):
        self.engine = PricingRulesEngine()
        self.today = date(2026, 3, 22)

    def test_none_signal_returns_empty(self):
        """None signal must not crash (bug fix: added None check)."""
        future = [make_record(self.today + timedelta(i), is_booked=False) for i in range(3)]
        result = self.engine.apply_velocity_rule(None, future)
        self.assertEqual(result, [])

    def test_fast_booking_increases_price(self):
        sig = make_booking_signal("fast_booking")
        future = [make_record(self.today + timedelta(i), is_booked=False, price=200.0)
                  for i in range(3)]
        decisions = self.engine.apply_velocity_rule(sig, future)
        self.assertEqual(len(decisions), 3)
        for d in decisions:
            self.assertAlmostEqual(d.new_price, 220.0, places=2)

    def test_no_booking_decreases_price(self):
        sig = make_booking_signal("no_booking")
        future = [make_record(self.today + timedelta(i), is_booked=False, price=200.0)
                  for i in range(3)]
        decisions = self.engine.apply_velocity_rule(sig, future)
        for d in decisions:
            self.assertAlmostEqual(d.new_price, 180.0, places=2)

    def test_normal_returns_empty(self):
        sig = make_booking_signal("normal")
        future = [make_record(self.today + timedelta(i), is_booked=False) for i in range(3)]
        self.assertEqual(self.engine.apply_velocity_rule(sig, future), [])

    def test_empty_future_returns_empty(self):
        sig = make_booking_signal("fast_booking")
        self.assertEqual(self.engine.apply_velocity_rule(sig, []), [])

    def test_booked_records_skipped(self):
        sig = make_booking_signal("fast_booking")
        future = [
            make_record(self.today + timedelta(1), is_booked=True, price=200.0),
            make_record(self.today + timedelta(2), is_booked=False, price=200.0),
        ]
        decisions = self.engine.apply_velocity_rule(sig, future)
        self.assertEqual(len(decisions), 1)
        self.assertAlmostEqual(decisions[0].new_price, 220.0, places=2)


# ─── PricingRulesEngine — Comp Set Rule ───────────────────────────────────────

class TestApplyCompSetRule(unittest.TestCase):

    def setUp(self):
        self.engine = PricingRulesEngine()
        self.today = date(2026, 3, 22)

    def _signal(self, t, dates):
        from models import MarketSignal
        return MarketSignal(signal_type=t, affected_dates=dates,
                            our_avg_price=200.0, comp_avg_price=250.0, description="test")

    def test_underpriced_increases(self):
        d = self.today + timedelta(5)
        rec = make_record(d, is_booked=False, price=200.0)
        decision = self.engine.apply_comp_set_rule(rec, self._signal("underpriced", [d]))
        self.assertIsNotNone(decision)
        self.assertAlmostEqual(decision.new_price, 216.0, places=2)

    def test_overpriced_decreases(self):
        d = self.today + timedelta(5)
        rec = make_record(d, is_booked=False, price=200.0)
        decision = self.engine.apply_comp_set_rule(rec, self._signal("overpriced", [d]))
        self.assertIsNotNone(decision)
        self.assertAlmostEqual(decision.new_price, 184.0, places=2)

    def test_aligned_returns_none(self):
        d = self.today + timedelta(5)
        rec = make_record(d, is_booked=False, price=200.0)
        self.assertIsNone(self.engine.apply_comp_set_rule(rec, self._signal("aligned", [d])))

    def test_date_not_affected_returns_none(self):
        d = self.today + timedelta(5)
        other = self.today + timedelta(10)
        rec = make_record(d, is_booked=False, price=200.0)
        self.assertIsNone(self.engine.apply_comp_set_rule(rec, self._signal("underpriced", [other])))

    def test_booked_returns_none(self):
        d = self.today + timedelta(5)
        rec = make_record(d, is_booked=True, price=200.0)
        self.assertIsNone(self.engine.apply_comp_set_rule(rec, self._signal("underpriced", [d])))


# ─── PricingRulesEngine — Event Rule ──────────────────────────────────────────

class TestApplyEventRule(unittest.TestCase):

    def setUp(self):
        self.engine = PricingRulesEngine()
        self.today = date(2026, 3, 22)

    def _event(self, d, demand, name="Test Event"):
        return EventData(date=d, name=name, demand_level=demand)

    def test_low_demand_plus_15(self):
        rec = make_record(self.today, is_booked=False, price=200.0)
        d = self.engine.apply_event_rule(rec, [self._event(self.today, "low")])
        self.assertIsNotNone(d)
        self.assertAlmostEqual(d.new_price, 230.0, places=2)

    def test_medium_demand_plus_25(self):
        rec = make_record(self.today, is_booked=False, price=200.0)
        d = self.engine.apply_event_rule(rec, [self._event(self.today, "medium")])
        self.assertIsNotNone(d)
        self.assertAlmostEqual(d.new_price, 250.0, places=2)

    def test_high_demand_plus_40(self):
        rec = make_record(self.today, is_booked=False, price=200.0)
        d = self.engine.apply_event_rule(rec, [self._event(self.today, "high")])
        self.assertIsNotNone(d)
        self.assertAlmostEqual(d.new_price, 280.0, places=2)

    def test_no_event_on_date_returns_none(self):
        rec = make_record(self.today, is_booked=False, price=200.0)
        self.assertIsNone(self.engine.apply_event_rule(
            rec, [self._event(self.today + timedelta(1), "high")]))

    def test_empty_events_returns_none(self):
        rec = make_record(self.today, is_booked=False, price=200.0)
        self.assertIsNone(self.engine.apply_event_rule(rec, []))

    def test_multiple_events_highest_wins(self):
        rec = make_record(self.today, is_booked=False, price=200.0)
        events = [
            self._event(self.today, "low", "Small Fair"),
            self._event(self.today, "high", "Big Festival"),
            self._event(self.today, "medium", "Race"),
        ]
        d = self.engine.apply_event_rule(rec, events)
        self.assertAlmostEqual(d.new_price, 280.0, places=2)
        self.assertEqual(d.rule_applied, "event_high")

    def test_booked_returns_none(self):
        rec = make_record(self.today, is_booked=True, price=200.0)
        self.assertIsNone(self.engine.apply_event_rule(
            rec, [self._event(self.today, "high")]))


# ─── PricingRulesEngine — calculate_change_percent ────────────────────────────

class TestCalculateChangePercent(unittest.TestCase):

    def setUp(self):
        self.engine = PricingRulesEngine()

    def test_increase(self):
        self.assertEqual(self.engine.calculate_change_percent(200.0, 220.0), "+10.0%")

    def test_decrease(self):
        self.assertEqual(self.engine.calculate_change_percent(200.0, 170.0), "-15.0%")

    def test_no_change(self):
        self.assertEqual(self.engine.calculate_change_percent(200.0, 200.0), "+0.0%")

    def test_zero_old_price_no_crash(self):
        result = self.engine.calculate_change_percent(0.0, 150.0)
        self.assertEqual(result, "+0.0%")

    def test_always_has_sign(self):
        pos = self.engine.calculate_change_percent(100.0, 110.0)
        neg = self.engine.calculate_change_percent(100.0, 90.0)
        self.assertTrue(pos.startswith("+"))
        self.assertTrue(neg.startswith("-"))


if __name__ == "__main__":
    unittest.main()
