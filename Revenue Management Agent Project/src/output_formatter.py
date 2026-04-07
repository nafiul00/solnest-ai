"""
Revenue Agent v2 — Output Formatter
Converts AgentOutput dataclasses into the strict JSON contract
expected by downstream consumers (dashboards, APIs, webhooks).
"""

import json
import logging
import math
from datetime import timedelta
from typing import List

from models import AgentOutput, PropertyData, PricingDecision, SummaryBlock

logger = logging.getLogger(__name__)


class OutputFormatter:
    """Formats AgentOutput into the canonical JSON structure."""

    # ── Public API ────────────────────────────────────────────────────────────

    def format_output(self, output: AgentOutput) -> dict:
        """Convert an AgentOutput dataclass into the strict JSON dict.

        If the output carries an error status, returns the compact error format
        instead of the full payload.

        Args:
            output: Fully assembled AgentOutput from the revenue agent.

        Returns:
            Dict matching the strict JSON contract.
        """
        if output.status == "error":
            return self.format_error(
                error_type=output.error_type or "INVALID_CALCULATION",
                errors=[],
            )

        result = {
            "status": output.status,
            "property_id": output.property_id,
            "date_range": output.date_range,
            "issues_detected": output.issues_detected,
            "decisions": [
                self._format_decision(d) for d in output.decisions
            ],
            "summary": {
                "pacing_status": output.summary.pacing_status,
                "market_position": output.summary.market_position,
                "risk_level": output.summary.risk_level,
            },
            "next_actions": output.next_actions,
        }

        # Include metrics if available (used by orchestrator for report tables)
        if output.metrics is not None:
            result["metrics"] = {
                "adr": self._safe_float(output.metrics.adr),
                "occupancy": self._safe_float(output.metrics.occupancy),
                "rev_par": self._safe_float(output.metrics.rev_par),
                "total_revenue": self._safe_float(output.metrics.total_revenue),
            }

        return result

    def format_error(self, error_type: str, errors: List[str]) -> dict:
        """Return the compact error payload.

        Args:
            error_type: Machine-readable error category,
                        e.g. "INVALID_CALCULATION", "VALIDATION_FAILED".
            errors:     Human-readable error descriptions.

        Returns:
            Dict with status, error_type, and errors keys.
        """
        if errors:
            logger.warning("Formatting error response: %s — %s", error_type, errors)
        return {
            "status": "error",
            "error_type": error_type,
            "errors": errors,
        }

    def to_json(self, output: AgentOutput) -> str:
        """Return the formatted output as an indented JSON string.

        Args:
            output: Fully assembled AgentOutput from the revenue agent.

        Returns:
            JSON string with indent=2.
        """
        payload = self.format_output(output)
        return json.dumps(payload, indent=2)

    def from_property_data_to_date_range(self, data: PropertyData) -> str:
        """Generate a human-readable date range string from PropertyData.

        Uses the analysis_date as the start and adds 30 days for the end.

        Args:
            data: PropertyData containing the analysis_date and calendar.

        Returns:
            String like "2026-03-22 to 2026-04-21".
        """
        start = data.analysis_date
        # Derive end date from calendar length if available, otherwise default 30 days
        if data.calendar:
            days_count = len(data.calendar)
            end = start + timedelta(days=days_count - 1)
        else:
            end = start + timedelta(days=29)
        return f"{start.isoformat()} to {end.isoformat()}"

    # ── Internal Helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _safe_float(val: float) -> float:
        """Replace NaN/infinity with 0.0 to prevent invalid JSON."""
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return 0.0
        return val

    def _format_decision(self, decision: PricingDecision) -> dict:
        """Convert a single PricingDecision into the contract dict format."""
        return {
            "date": decision.date,
            "old_price": self._safe_float(decision.old_price),
            "new_price": self._safe_float(decision.new_price),
            "change_percent": decision.change_percent,
            "reason": decision.reason,
            "confidence": decision.confidence,
        }
