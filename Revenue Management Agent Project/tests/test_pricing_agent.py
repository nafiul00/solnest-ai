"""
Comprehensive tests for the Pricing Agent pipeline.

Covers:
  - ToolInterfaces (scrape_airbnb, get_pricing_calendar, create_discount_rule, update_pricing)
  - MarketAnalyzer (analyze, extract_competitor_prices, calculate_market_occupancy)
  - DiscountGenerator (each rule type, deduplication, empty inputs)
  - PricingAgent (run(), output schema, JSON serialisability, error path)

Run from project root:
    cd "src" && python3 -m pytest ../tests/test_pricing_agent.py -v
"""

import json
import sys
import os
import re
import unittest
from datetime import date, timedelta

SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC_DIR))

from tool_interfaces import ToolInterfaces, ToolResult
from market_analyzer import MarketAnalyzer, MarketAnalysis
from discount_generator import DiscountGenerator, DiscountRule
from pricing_agent import PricingAgent, PricingAgentInput


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_competitor_data(avg_price: float, avg_occupancy: float, n: int = 3) -> dict:
    return {
        "competitors": [
            {"avg_price": avg_price, "avg_occupancy": avg_occupancy, "num_listings": 2}
            for _ in range(n)
        ]
    }


def _make_agent_input(**kwargs) -> PricingAgentInput:
    defaults = dict(
        property_id="TEST-PROP-001",
        listing_ids=["comp_1", "comp_2"],
        location="Miami Beach, FL",
        base_price=200.0,
        analysis_date=date.today(),
    )
    defaults.update(kwargs)
    return PricingAgentInput(**defaults)


# ─── ToolInterfaces ───────────────────────────────────────────────────────────

class TestToolInterfacesScrapeAirbnb(unittest.TestCase):

    def setUp(self):
        self.tools = ToolInterfaces()

    def test_scrape_returns_success_true(self):
        result = self.tools.scrape_airbnb(["listing_1"], ["2026-03-22"])
        self.assertTrue(result.success)

    def test_scrape_returns_toolresult_instance(self):
        result = self.tools.scrape_airbnb(["listing_1"], ["2026-03-22"])
        self.assertIsInstance(result, ToolResult)

    def test_scrape_data_has_competitor_prices_key(self):
        result = self.tools.scrape_airbnb(["listing_1"], ["2026-03-22"])
        self.assertIn("competitor_prices", result.data)

    def test_scrape_entry_has_required_fields(self):
        result = self.tools.scrape_airbnb(["listing_1"], ["2026-03-22"])
        entry = result.data["competitor_prices"][0]
        for field in ("listing_id", "date", "price", "is_available"):
            self.assertIn(field, entry)

    def test_scrape_price_is_float(self):
        result = self.tools.scrape_airbnb(["listing_1"], ["2026-03-22"])
        price = result.data["competitor_prices"][0]["price"]
        self.assertIsInstance(price, float)

    def test_scrape_empty_listing_ids_no_crash(self):
        result = self.tools.scrape_airbnb([], ["2026-03-22"])
        self.assertTrue(result.success)
        self.assertEqual(result.data["competitor_prices"], [])

    def test_scrape_empty_dates_no_crash(self):
        result = self.tools.scrape_airbnb(["listing_1"], [])
        self.assertTrue(result.success)
        self.assertEqual(result.data["competitor_prices"], [])


class TestToolInterfacesPricingCalendar(unittest.TestCase):

    def setUp(self):
        self.tools = ToolInterfaces()

    def test_calendar_returns_success_true(self):
        result = self.tools.get_pricing_calendar("prop_001")
        self.assertTrue(result.success)

    def test_calendar_data_has_dates_key(self):
        result = self.tools.get_pricing_calendar("prop_001")
        self.assertIn("dates", result.data)

    def test_calendar_dates_are_iso_strings(self):
        result = self.tools.get_pricing_calendar("prop_001")
        for entry in result.data["dates"]:
            date.fromisoformat(entry["date"])  # raises ValueError if invalid

    def test_calendar_prices_are_floats(self):
        result = self.tools.get_pricing_calendar("prop_001")
        for entry in result.data["dates"]:
            self.assertIsInstance(entry["current_price"], float)

    def test_calendar_min_30_days(self):
        result = self.tools.get_pricing_calendar("prop_001", days_ahead=5)
        self.assertGreaterEqual(len(result.data["dates"]), 30)

    def test_calendar_max_90_days(self):
        result = self.tools.get_pricing_calendar("prop_001", days_ahead=200)
        self.assertLessEqual(len(result.data["dates"]), 90)


class TestToolInterfacesCreateDiscountRule(unittest.TestCase):

    def setUp(self):
        self.tools = ToolInterfaces()

    def test_create_discount_rule_success(self):
        result = self.tools.create_discount_rule("prop_001", {"rule_type": "last_minute"})
        self.assertTrue(result.success)

    def test_rule_id_is_string(self):
        result = self.tools.create_discount_rule("prop_001", {})
        self.assertIsInstance(result.data["rule_id"], str)

    def test_rule_id_is_uuid4_format(self):
        result = self.tools.create_discount_rule("prop_001", {})
        rule_id = result.data["rule_id"]
        pattern = re.compile(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
        )
        self.assertTrue(pattern.match(rule_id), f"Not UUID4: {rule_id}")

    def test_update_pricing_returns_success(self):
        result = self.tools.update_pricing("prop_001", "2026-03-22", 180.0)
        self.assertTrue(result.success)


# ─── MarketAnalyzer ───────────────────────────────────────────────────────────

class TestMarketAnalyzerPositioning(unittest.TestCase):

    def setUp(self):
        self.analyzer = MarketAnalyzer()

    def test_above_comps_detected(self):
        comp = _make_competitor_data(100.0, 0.6)
        result = self.analyzer.analyze([120.0], 0.7, comp, {})
        self.assertIn("above comps by", result.position_vs_comps)

    def test_below_comps_detected(self):
        comp = _make_competitor_data(200.0, 0.6)
        result = self.analyzer.analyze([150.0], 0.7, comp, {})
        self.assertIn("below comps by", result.position_vs_comps)

    def test_aligned_detected(self):
        comp = _make_competitor_data(200.0, 0.6)
        result = self.analyzer.analyze([205.0], 0.7, comp, {})
        self.assertEqual(result.position_vs_comps, "aligned with comps")

    def test_pricing_gap_has_sign(self):
        comp = _make_competitor_data(200.0, 0.6)
        result = self.analyzer.analyze([220.0], 0.7, comp, {})
        self.assertTrue(result.pricing_gap_percent[0] in ("+", "-"))

    def test_recommendation_valid_values(self):
        comp = _make_competitor_data(200.0, 0.6)
        result = self.analyzer.analyze([200.0], 0.6, comp, {})
        self.assertIn(result.recommendation, ("increase", "decrease", "hold"))

    def test_empty_competitor_data_no_crash(self):
        result = self.analyzer.analyze([200.0], 0.6, {}, {})
        self.assertIsInstance(result, MarketAnalysis)

    def test_occupancy_comparison_zero_is_aligned(self):
        """Zero delta → 'aligned with market', not 'behind 0%'."""
        result = self.analyzer.analyze([200.0], 0.0, {}, {})
        self.assertEqual(result.occupancy_comparison, "aligned with market")

    def test_occupancy_comparison_behind_no_minus(self):
        """Negative delta → 'behind X%' with positive number, no minus sign."""
        comp = _make_competitor_data(200.0, 0.8)
        result = self.analyzer.analyze([200.0], 0.4, comp, {})
        self.assertIn("behind", result.occupancy_comparison)
        self.assertNotIn("-", result.occupancy_comparison)

    def test_occupancy_comparison_ahead_positive(self):
        comp = _make_competitor_data(200.0, 0.4)
        result = self.analyzer.analyze([200.0], 0.9, comp, {})
        self.assertIn("ahead", result.occupancy_comparison)

    def test_calculate_market_occupancy_empty_no_crash(self):
        self.assertEqual(self.analyzer.calculate_market_occupancy({}), 0.0)

    def test_calculate_market_occupancy_weighted(self):
        comp = {"competitors": [
            {"avg_occupancy": 0.8, "num_listings": 4},
            {"avg_occupancy": 0.4, "num_listings": 2},
        ]}
        result = self.analyzer.calculate_market_occupancy(comp)
        expected = (0.8 * 4 + 0.4 * 2) / 6
        self.assertAlmostEqual(result, expected, places=3)

    def test_extract_competitor_prices_empty(self):
        self.assertEqual(self.analyzer.extract_competitor_prices({}), [])

    def test_extract_competitor_prices_parses(self):
        raw = {"competitor_prices": [
            {"listing_id": "abc", "date": "2026-03-22", "price": 150.0, "is_available": True}
        ]}
        result = self.analyzer.extract_competitor_prices(raw)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].price, 150.0)


# ─── DiscountGenerator ────────────────────────────────────────────────────────

class TestDiscountGenerator(unittest.TestCase):

    def setUp(self):
        self.gen = DiscountGenerator()

    def test_last_minute_empty_returns_empty(self):
        self.assertEqual(self.gen.generate_last_minute_rules([]), [])

    def test_last_minute_returns_rule(self):
        rules = self.gen.generate_last_minute_rules(["2026-03-22"])
        self.assertEqual(len(rules), 1)
        self.assertEqual(rules[0].rule_type, "last_minute")

    def test_orphan_day_empty_returns_empty(self):
        self.assertEqual(self.gen.generate_orphan_day_rules([]), [])

    def test_orphan_day_returns_rule(self):
        rules = self.gen.generate_orphan_day_rules(["2026-03-24"])
        self.assertEqual(len(rules), 1)
        self.assertEqual(rules[0].rule_type, "orphan_day")

    def test_length_of_stay_always_generated(self):
        rules = self.gen.generate_length_of_stay_rules()
        self.assertEqual(len(rules), 1)
        self.assertEqual(rules[0].rule_type, "length_of_stay")

    def test_gap_fill_empty_returns_empty(self):
        self.assertEqual(self.gen.generate_gap_fill_rules([]), [])

    def test_gap_fill_returns_rule(self):
        dates = ["2026-03-22", "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26"]
        rules = self.gen.generate_gap_fill_rules(dates)
        self.assertEqual(len(rules), 1)

    def test_generate_all_deduplication(self):
        signals = {
            "orphan_dates": ["2026-03-22"],
            "gap_dates": ["2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29"],
            "last_minute_dates": ["2026-03-22"],
            "has_long_gaps": True,
        }
        rules = self.gen.generate_all(signals)
        types = [r.rule_type for r in rules]
        self.assertEqual(len(types), len(set(types)))

    def test_generate_all_always_has_length_of_stay(self):
        rules = self.gen.generate_all({})
        self.assertIn("length_of_stay", [r.rule_type for r in rules])

    def test_discount_percent_is_string_with_percent(self):
        rules = self.gen.generate_all({})
        for rule in rules:
            self.assertIsInstance(rule.discount_percent, str)
            self.assertIn("%", rule.discount_percent)


# ─── PricingAgent ─────────────────────────────────────────────────────────────

class TestPricingAgentOutputSchema(unittest.TestCase):

    def setUp(self):
        self.agent = PricingAgent()
        self.agent_input = _make_agent_input()

    def test_run_returns_dict(self):
        self.assertIsInstance(self.agent.run(self.agent_input), dict)

    def test_required_top_level_keys(self):
        result = self.agent.run(self.agent_input)
        required = {"issues_detected", "market_analysis", "pricing_updates",
                    "discount_rules", "summary"}
        self.assertTrue(required.issubset(result.keys()))

    def test_market_analysis_fields(self):
        result = self.agent.run(self.agent_input)
        for f in ("position_vs_comps", "pricing_gap_percent", "occupancy_comparison"):
            self.assertIn(f, result["market_analysis"])

    def test_summary_fields(self):
        result = self.agent.run(self.agent_input)
        for f in ("strategy", "risk_level", "confidence"):
            self.assertIn(f, result["summary"])

    def test_pricing_updates_is_list(self):
        self.assertIsInstance(self.agent.run(self.agent_input)["pricing_updates"], list)

    def test_pricing_update_fields(self):
        result = self.agent.run(self.agent_input)
        for u in result["pricing_updates"]:
            for f in ("date", "old_price", "new_price", "change_percent", "reason"):
                self.assertIn(f, u)

    def test_discount_rules_is_list(self):
        self.assertIsInstance(self.agent.run(self.agent_input)["discount_rules"], list)

    def test_discount_rule_fields(self):
        result = self.agent.run(self.agent_input)
        for r in result["discount_rules"]:
            for f in ("rule_type", "condition", "discount_percent", "applicable_dates"):
                self.assertIn(f, r)

    def test_json_serializable(self):
        result = self.agent.run(self.agent_input)
        try:
            json.dumps(result)
        except (TypeError, ValueError) as e:
            self.fail(f"Not JSON-serializable: {e}")

    def test_risk_level_valid(self):
        result = self.agent.run(self.agent_input)
        self.assertIn(result["summary"]["risk_level"], ("low", "medium", "high"))

    def test_confidence_valid(self):
        result = self.agent.run(self.agent_input)
        self.assertIn(result["summary"]["confidence"], ("low", "medium", "high"))

    def test_no_extra_keys_on_success(self):
        result = self.agent.run(self.agent_input)
        if "status" not in result:  # success path
            allowed = {"issues_detected", "market_analysis", "pricing_updates",
                       "discount_rules", "summary"}
            self.assertEqual(set(result.keys()), allowed)

    def test_error_path_returns_dict(self):
        bad = _make_agent_input(property_id="")
        result = self.agent.run(bad)
        self.assertIsInstance(result, dict)


if __name__ == "__main__":
    unittest.main()
