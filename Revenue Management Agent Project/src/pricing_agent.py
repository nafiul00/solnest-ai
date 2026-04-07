"""
Pricing Agent v1 — AI Revenue Management Agent
Analyzes internal + external data to generate pricing decisions and discount rules.

This is a decision engine, not a chatbot.
"""

import json
import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Optional

from models import PropertyData, BookingRecord, PricingDecision
from signal_detection import SignalDetector
from decision_engine import DecisionEngine
from revenue_calculator import RevenueCalculator
from tool_interfaces import ToolInterfaces
from market_analyzer import MarketAnalyzer, MarketAnalysis
from discount_generator import DiscountGenerator, DiscountRule

logger = logging.getLogger(__name__)


@dataclass
class PricingAgentInput:
    """Input payload for the Pricing Agent."""
    property_id: str
    listing_ids: List[str]       # competitor listing IDs to scrape
    location: str
    base_price: float
    analysis_date: Optional[date] = None


class PricingAgent:
    """Main Pricing Agent orchestrator.

    Executes a 6-step mandatory workflow:
        1. Analyze internal calendar
        2. Analyze booking behavior
        3. Scrape and analyze Airbnb competitors
        4. Analyze market data
        5. Apply decision logic
        6. Generate output
    """

    def __init__(self) -> None:
        self.tools = ToolInterfaces()
        self.market_analyzer = MarketAnalyzer()
        self.discount_generator = DiscountGenerator()
        self.decision_engine = DecisionEngine()
        self.revenue_calculator = RevenueCalculator()
        self.signal_detector = SignalDetector()

    def run(self, agent_input: PricingAgentInput) -> dict:
        """Execute the full pricing agent pipeline.

        Args:
            agent_input: PricingAgentInput with property details and
                competitor listing IDs.

        Returns:
            Strict JSON-compatible dict with issues_detected, market_analysis,
            pricing_updates, discount_rules, and summary.
        """
        try:
            analysis_date = agent_input.analysis_date or date.today()
            issues: List[str] = []

            logger.info(
                "Pricing agent starting for property %s on %s",
                agent_input.property_id,
                analysis_date.isoformat(),
            )

            # ── STEP 1 — Analyze internal calendar ─────────────────────────
            calendar_result = self.tools.get_pricing_calendar(
                agent_input.property_id
            )

            if not calendar_result.success or not calendar_result.data.get("dates"):
                logger.error(
                    "Calendar fetch failed for property %s: %s",
                    agent_input.property_id,
                    calendar_result.error,
                )
                return {
                    "status": "error",
                    "error_type": "CALENDAR_FETCH_ERROR",
                    "errors": [
                        calendar_result.error or "No calendar data returned"
                    ],
                }

            # Convert calendar to BookingRecord list
            calendar_entries = calendar_result.data["dates"]
            calendar: List[BookingRecord] = []
            for entry in calendar_entries:
                calendar.append(
                    BookingRecord(
                        date=date.fromisoformat(entry["date"]),
                        is_booked=entry["is_booked"],
                        price=entry["current_price"],
                    )
                )

            # Build PropertyData for the decision engine (with correct property_id)
            property_data = self._calendar_to_property_data(
                calendar_result.data,
                agent_input.property_id,
                agent_input.base_price,
                analysis_date,
            )

            # Run signal detection (single pass — reused downstream)
            signals = self.signal_detector.detect_all(property_data)

            # ── STEP 2 — Analyze booking behavior ──────────────────────────
            if signals.booking is not None:
                if signals.booking.signal_type == "no_booking":
                    days = len(signals.booking.affected_dates)
                    issues.append(
                        f"No bookings in next {days} days — possible overpricing"
                    )
                elif signals.booking.signal_type == "fast_booking":
                    issues.append(signals.booking.description)

            # Collect inventory issues
            for inv in signals.inventory:
                if inv.signal_type == "orphan_day":
                    for d in inv.affected_dates:
                        issues.append(
                            f"Orphan day detected on {d.isoformat()}"
                        )
                elif inv.signal_type == "long_gap":
                    start = min(inv.affected_dates).isoformat()
                    end = max(inv.affected_dates).isoformat()
                    issues.append(
                        f"Long gap of {inv.gap_length} days from {start} to {end}"
                    )

            # ── STEP 3 — Scrape and analyze Airbnb competitors ─────────────
            scrape_dates = [
                (analysis_date + timedelta(days=i)).isoformat()
                for i in range(30)
            ]

            scrape_result = self.tools.scrape_airbnb(
                agent_input.listing_ids, scrape_dates
            )

            competitor_prices: List[float] = []
            if scrape_result.success:
                comp_price_objects = self.market_analyzer.extract_competitor_prices(
                    scrape_result.data
                )
                competitor_prices = [cp.price for cp in comp_price_objects]
                logger.debug(
                    "Scraped %d competitor prices for %s",
                    len(competitor_prices),
                    agent_input.property_id,
                )

            # ── STEP 4 — Analyze market data ───────────────────────────────
            market_result = self.tools.get_competitor_data(
                agent_input.location, {}
            )

            competitor_data = market_result.data if market_result.success else {"competitors": []}

            # Our prices and occupancy
            our_prices = [rec.price for rec in calendar if not rec.is_booked]
            if not our_prices:
                our_prices = [rec.price for rec in calendar]

            booked_count = sum(1 for rec in calendar if rec.is_booked)
            our_occupancy = booked_count / len(calendar) if calendar else 0.0

            market_analysis = self.market_analyzer.analyze(
                our_prices, our_occupancy, competitor_data, {}
            )

            logger.debug(
                "Market analysis: position=%s, recommendation=%s",
                market_analysis.position_vs_comps,
                market_analysis.recommendation,
            )

            # ── STEP 5 — Apply decision logic ──────────────────────────────
            decisions: List[PricingDecision] = self.decision_engine.run(
                property_data
            )

            # Build signals data for discount generation
            orphan_dates: List[str] = []
            gap_dates: List[str] = []
            has_long_gaps = False

            for inv in signals.inventory:
                if inv.signal_type == "orphan_day":
                    orphan_dates.extend(
                        d.isoformat() for d in inv.affected_dates
                    )
                elif inv.signal_type == "long_gap":
                    gap_dates.extend(
                        d.isoformat() for d in inv.affected_dates
                    )
                    has_long_gaps = True

            # Last-minute dates: unbooked within 14 days
            last_minute_cutoff = analysis_date + timedelta(days=14)
            last_minute_dates = [
                rec.date.isoformat()
                for rec in calendar
                if not rec.is_booked and rec.date <= last_minute_cutoff
            ]

            signals_data = {
                "orphan_dates": orphan_dates,
                "gap_dates": gap_dates,
                "last_minute_dates": last_minute_dates,
                "has_long_gaps": has_long_gaps,
            }

            discount_rules = self.discount_generator.generate_all(signals_data)

            # ── STEP 6 — Generate output ───────────────────────────────────
            pricing_updates = self._decisions_to_pricing_updates(decisions)

            summary = self._build_strategy_summary(
                market_analysis, len(decisions), len(issues)
            )

            logger.info(
                "Pricing agent completed for property %s — %d updates, %d rules, %d issues",
                agent_input.property_id,
                len(pricing_updates),
                len(discount_rules),
                len(issues),
            )

            return {
                "issues_detected": issues,
                "market_analysis": {
                    "position_vs_comps": market_analysis.position_vs_comps,
                    "pricing_gap_percent": market_analysis.pricing_gap_percent,
                    "occupancy_comparison": market_analysis.occupancy_comparison,
                },
                "pricing_updates": pricing_updates,
                "discount_rules": [
                    {
                        "rule_type": rule.rule_type,
                        "condition": rule.condition,
                        "discount_percent": rule.discount_percent,
                        "applicable_dates": rule.applicable_dates,
                    }
                    for rule in discount_rules
                ],
                "summary": summary,
            }

        except Exception as exc:
            logger.exception(
                "Unhandled error in pricing agent for property %s",
                getattr(agent_input, "property_id", "unknown"),
            )
            return {
                "status": "error",
                "error_type": "PRICING_AGENT_ERROR",
                "errors": [str(exc)],
            }

    def _build_strategy_summary(
        self,
        market: MarketAnalysis,
        decisions_count: int,
        issues_count: int,
    ) -> dict:
        """Build the strategy summary block.

        Args:
            market: MarketAnalysis result from step 4.
            decisions_count: Number of pricing decisions generated.
            issues_count: Number of issues detected.

        Returns:
            Dict with strategy, risk_level, and confidence keys.
        """
        strategy_parts: List[str] = []

        if market.recommendation == "decrease":
            strategy_parts.append("Lower prices to fill gaps")
        elif market.recommendation == "increase":
            strategy_parts.append("Raise prices to capture market value")
        else:
            strategy_parts.append("Maintain current pricing strategy")

        if decisions_count > 0:
            strategy_parts.append(
                f"apply {decisions_count} date-specific adjustments"
            )

        strategy = "; ".join(strategy_parts)

        # Determine risk level
        if issues_count >= 3 or "above comps" in market.position_vs_comps:
            risk_level = "high"
        elif issues_count >= 1:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Determine confidence
        has_market_data = market.comp_avg_price > 0
        has_internal_data = decisions_count > 0

        if has_market_data and has_internal_data:
            confidence = "high"
        elif has_market_data or has_internal_data:
            confidence = "medium"
        else:
            confidence = "low"

        return {
            "strategy": strategy,
            "risk_level": risk_level,
            "confidence": confidence,
        }

    def _calendar_to_property_data(
        self,
        calendar_result: dict,
        property_id: str,
        base_price: float,
        analysis_date: date,
    ) -> PropertyData:
        """Convert get_pricing_calendar() result into a PropertyData object.

        Uses empty last_year_calendar and comp_set since those are
        sourced from other tool calls in the pipeline.

        Args:
            calendar_result: Dict with "dates" key from get_pricing_calendar.
            property_id: The property's unique identifier.
            base_price: The property's base nightly price.
            analysis_date: Date of the analysis run.

        Returns:
            PropertyData populated with calendar entries.
        """
        calendar_entries = calendar_result.get("dates", [])
        calendar: List[BookingRecord] = []

        for entry in calendar_entries:
            calendar.append(
                BookingRecord(
                    date=date.fromisoformat(entry["date"]),
                    is_booked=entry["is_booked"],
                    price=entry["current_price"],
                )
            )

        return PropertyData(
            property_id=property_id,
            base_price=base_price,
            calendar=calendar,
            last_year_calendar=[],
            comp_set=[],
            events=[],
            analysis_date=analysis_date,
        )

    def _decisions_to_pricing_updates(
        self, decisions: List[PricingDecision]
    ) -> List[dict]:
        """Convert PricingDecision objects into the pricing_updates JSON format.

        Args:
            decisions: List of PricingDecision dataclass objects.

        Returns:
            List of dicts matching the pricing_updates output schema.
        """
        return [
            {
                "date": d.date,
                "old_price": d.old_price,
                "new_price": d.new_price,
                "change_percent": d.change_percent,
                "reason": d.reason,
            }
            for d in decisions
        ]


def run_pricing_agent(agent_input: PricingAgentInput) -> dict:
    """Module-level convenience function to run the Pricing Agent.

    Args:
        agent_input: PricingAgentInput with property details.

    Returns:
        Strict JSON output dict from PricingAgent.run().
    """
    agent = PricingAgent()
    return agent.run(agent_input)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    demo_input = PricingAgentInput(
        property_id="prop_demo_001",
        listing_ids=["airbnb_101", "airbnb_102", "airbnb_103"],
        location="Miami Beach, FL",
        base_price=200.0,
        analysis_date=date.today(),
    )

    result = run_pricing_agent(demo_input)
    print(json.dumps(result, indent=2, default=str))
