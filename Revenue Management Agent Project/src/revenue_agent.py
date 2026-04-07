"""
Revenue Agent v2 — Main Orchestrator
Top-level entry point that runs the complete revenue management loop:
validate -> decide -> calculate -> summarize -> format.

This is a decision engine, not a chatbot.
"""

import logging
from datetime import date, timedelta
from typing import List

from models import (
    PropertyData,
    AgentOutput,
    PricingDecision,
    RevenueMetrics,
    SummaryBlock,
    ValidationResult,
    SignalBundle,
    BookingRecord,
)
from decision_engine import DecisionEngine
from revenue_calculator import RevenueCalculator
from validation_layer import ValidationLayer
from signal_detection import SignalDetector
from output_formatter import OutputFormatter

logger = logging.getLogger(__name__)


class RevenueAgent:
    """Top-level revenue management agent.

    Orchestrates the full pipeline from raw property data to a structured
    pricing output with decisions, metrics, and next actions.
    """

    def __init__(self) -> None:
        self.decision_engine = DecisionEngine()
        self.revenue_calculator = RevenueCalculator()
        self.validation_layer = ValidationLayer()
        self.formatter = OutputFormatter()

    def run(self, data: PropertyData) -> dict:
        """Execute the full revenue agent pipeline.

        Args:
            data: Complete PropertyData input for a single property.

        Returns:
            Dict matching the strict JSON output contract.
            On any failure, returns the error format instead.
        """
        try:
            # Step 1: Validate input data
            input_validation: ValidationResult = self.validation_layer.validate_property_data(data)
            if not input_validation.is_valid:
                logger.warning(
                    "Input validation failed for property %s: %s",
                    data.property_id,
                    input_validation.errors,
                )
                return self.formatter.format_error(
                    error_type="INVALID_INPUT",
                    errors=input_validation.errors,
                )

            # Step 2: Detect signals (done ONCE — results passed to all downstream steps)
            detector = SignalDetector()
            signals: SignalBundle = detector.detect_all(data)

            # Step 3: Run decision engine -> pricing decisions
            decisions: List[PricingDecision] = self.decision_engine.run(data)

            # Step 4: Calculate current revenue metrics
            current_metrics: RevenueMetrics = self.revenue_calculator.calculate(data.calendar)

            # Step 5: Project revenue with proposed decisions applied
            projected_metrics: RevenueMetrics = self.revenue_calculator.project_with_decisions(
                data.calendar, decisions
            )

            # Step 6: Validate metrics
            metrics_validation: ValidationResult = self.validation_layer.validate_metrics(
                current_metrics
            )
            if not metrics_validation.is_valid:
                logger.error(
                    "Metric validation failed for property %s: %s",
                    data.property_id,
                    metrics_validation.errors,
                )
                return self.formatter.format_error(
                    error_type="INVALID_CALCULATION",
                    errors=metrics_validation.errors,
                )

            # Step 7: Build issues list from pre-detected signals
            issues: List[str] = self.decision_engine._collect_issues(signals)

            # Step 8: Build summary (uses pre-detected signals — no redundant detect_all)
            summary: SummaryBlock = self._build_summary(data, decisions, current_metrics, signals, issues)

            # Step 9: Build next actions
            next_actions: List[str] = self._build_next_actions(decisions, issues)

            # Step 10: Assemble AgentOutput
            output = AgentOutput(
                property_id=data.property_id,
                date_range=self.formatter.from_property_data_to_date_range(data),
                issues_detected=issues,
                decisions=decisions,
                summary=summary,
                next_actions=next_actions,
                metrics=projected_metrics,
                status="ok",
            )

            # Step 11: Validate output
            output_validation: ValidationResult = self.validation_layer.validate_output(output)
            if not output_validation.is_valid:
                logger.error(
                    "Output validation failed for property %s: %s",
                    data.property_id,
                    output_validation.errors,
                )
                return self.formatter.format_error(
                    error_type="INVALID_OUTPUT",
                    errors=output_validation.errors,
                )

            # Step 12: Format and return
            logger.info(
                "Revenue agent completed for property %s — %d decisions, %d issues",
                data.property_id,
                len(decisions),
                len(issues),
            )
            return self.formatter.format_output(output)

        except Exception as exc:
            logger.exception("Unhandled error in revenue agent for property %s", getattr(data, "property_id", "unknown"))
            return self.formatter.format_error(
                error_type="AGENT_ERROR",
                errors=[str(exc)],
            )

    # ── Internal Helpers ──────────────────────────────────────────────────────

    def _build_summary(
        self,
        data: PropertyData,
        decisions: List[PricingDecision],
        metrics: RevenueMetrics,
        signals: SignalBundle,
        issues: List[str],
    ) -> SummaryBlock:
        """Build the SummaryBlock from pacing, market, and issue data.

        Args:
            data:      Full property data (includes last year calendar + comp set).
            decisions: Pricing decisions generated by the engine.
            metrics:   Current revenue metrics.
            signals:   Pre-detected signal bundle (avoids redundant detection).
            issues:    Pre-computed issues list (avoids redundant _collect_issues).

        Returns:
            SummaryBlock with pacing_status, market_position, and risk_level.
        """
        # --- Pacing status ---
        pacing = self.revenue_calculator.calculate_pacing_metrics(
            data.calendar, data.last_year_calendar
        )
        delta_pct = pacing["delta_pct"]
        pacing_status_code = pacing["status"]

        if pacing_status_code == "ahead":
            pacing_status = f"ahead +{delta_pct:.0f}% vs LY"
        elif pacing_status_code == "behind":
            pacing_status = f"behind {delta_pct:.0f}% vs LY"
        else:
            pacing_status = "on track"

        # --- Market position ---
        if data.comp_set:
            comp_avg = sum(c.avg_price for c in data.comp_set) / len(data.comp_set)
            our_avg = metrics.adr if metrics.adr > 0 else data.base_price

            if comp_avg > 0:
                diff_pct = ((our_avg - comp_avg) / comp_avg) * 100.0
            else:
                diff_pct = 0.0

            if diff_pct > 5.0:
                market_position = f"above comp set by {diff_pct:.0f}%"
            elif diff_pct < -5.0:
                market_position = f"below comp set by {abs(diff_pct):.0f}%"
            else:
                market_position = "aligned with market"
        else:
            market_position = "aligned with market"

        # --- Risk level (uses pre-computed issues count) ---
        issue_count = len(issues)

        if issue_count > 5 or pacing_status_code == "behind":
            risk_level = "high"
        elif pacing_status_code == "ahead":
            risk_level = "low"
        else:
            risk_level = "medium"

        return SummaryBlock(
            pacing_status=pacing_status,
            market_position=market_position,
            risk_level=risk_level,
        )

    def _build_next_actions(
        self,
        decisions: List[PricingDecision],
        issues: List[str],
    ) -> List[str]:
        """Build a list of 3-5 actionable next steps from decisions and issues.

        Args:
            decisions: Pricing decisions from the engine.
            issues:    Human-readable issues detected by signal analysis.

        Returns:
            List of action strings, capped at 5.
        """
        actions: List[str] = []

        # Generate actions from pricing decisions
        for decision in decisions:
            if "orphan" in decision.rule_applied.lower():
                actions.append(
                    f"Reduce price on orphan day {decision.date} "
                    f"from ${decision.old_price:.0f} to ${decision.new_price:.0f}"
                )
            elif "event" in decision.rule_applied.lower():
                actions.append(
                    f"Apply event premium on {decision.date} "
                    f"({decision.change_percent})"
                )
            elif "lead_time" in decision.rule_applied.lower():
                actions.append(
                    f"Adjust lead-time pricing on {decision.date} "
                    f"from ${decision.old_price:.0f} to ${decision.new_price:.0f}"
                )
            elif "velocity" in decision.rule_applied.lower():
                actions.append(
                    f"Monitor booking velocity — {decision.reason}"
                )
            elif "pacing" in decision.rule_applied.lower():
                actions.append(
                    f"Pacing adjustment on {decision.date} "
                    f"from ${decision.old_price:.0f} to ${decision.new_price:.0f}"
                )
            elif "comp_set" in decision.rule_applied.lower():
                actions.append(
                    f"Align with comp set on {decision.date} "
                    f"({decision.change_percent})"
                )
            elif "gap" in decision.rule_applied.lower():
                actions.append(
                    f"Fill gap — reduce {decision.date} "
                    f"from ${decision.old_price:.0f} to ${decision.new_price:.0f}"
                )
            else:
                actions.append(
                    f"Review pricing on {decision.date}: "
                    f"${decision.old_price:.0f} -> ${decision.new_price:.0f} "
                    f"({decision.change_percent})"
                )

        # Add issue-based actions if we have room
        for issue in issues:
            if len(actions) >= 5:
                break
            if "velocity" in issue.lower() or "fast" in issue.lower():
                actions.append(
                    f"Monitor booking velocity — {issue}"
                )
            elif "pacing behind" in issue.lower():
                actions.append(
                    f"Review overall pricing strategy — {issue}"
                )

        # Cap at 5 actions
        return actions[:5]


# ── Module-level convenience function ─────────────────────────────────────────

def run_revenue_agent(data: PropertyData) -> dict:
    """Create a RevenueAgent and execute the pipeline.

    Args:
        data: Complete PropertyData for a single property.

    Returns:
        Dict matching the strict JSON output contract.
    """
    agent = RevenueAgent()
    return agent.run(data)


# ── Demo / Manual Test ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    logging.basicConfig(level=logging.INFO)
    today = date.today()

    # Build a fake 30-day calendar
    calendar: List[BookingRecord] = []
    for i in range(30):
        d = today + timedelta(days=i)
        # Simulate: days 0-4 booked, 5 open (orphan-ish), 6-10 booked, rest open
        is_booked = i < 5 or (6 <= i <= 10)
        calendar.append(
            BookingRecord(
                date=d,
                is_booked=is_booked,
                price=200.0,
                booked_on=today - timedelta(days=15) if is_booked else None,
            )
        )

    # Last year calendar — slightly lower occupancy
    last_year_calendar: List[BookingRecord] = []
    for i in range(30):
        d = today + timedelta(days=i)
        is_booked = i < 3 or (8 <= i <= 10)
        last_year_calendar.append(
            BookingRecord(
                date=d,
                is_booked=is_booked,
                price=180.0,
                booked_on=today - timedelta(days=380) if is_booked else None,
            )
        )

    # Build property data
    fake_data = PropertyData(
        property_id="PROP-001",
        base_price=200.0,
        calendar=calendar,
        last_year_calendar=last_year_calendar,
        comp_set=[],
        events=[],
        analysis_date=today,
    )

    print("=" * 60)
    print("Revenue Agent — Demo Run")
    print("=" * 60)

    result = run_revenue_agent(fake_data)
    print(json.dumps(result, indent=2))
