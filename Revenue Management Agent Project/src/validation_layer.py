"""
Validation Layer
Enforces strict business rules on revenue metrics, pricing decisions,
property data, and agent output.
"""

import math
from typing import List

from models import (
    AgentOutput,
    PricingDecision,
    PropertyData,
    RevenueMetrics,
    ValidationResult,
)


class ValidationLayer:
    """Validates all calculated data against strict business rules."""

    def validate_metrics(self, metrics: RevenueMetrics) -> ValidationResult:
        """Validate revenue metrics for mathematical and business correctness.

        Rules enforced:
            - RevPAR <= ADR (always true mathematically since occupancy <= 1.0)
            - Occupancy between 0.0 and 1.0 inclusive
            - ADR >= 0
            - Total revenue >= 0
            - Bookings <= available_days

        Args:
            metrics: The RevenueMetrics to validate.

        Returns:
            ValidationResult with is_valid and any error messages.
        """
        errors: List[str] = []

        # Reject NaN/infinity values — these corrupt downstream calculations
        for field_name in ("adr", "occupancy", "rev_par", "total_revenue"):
            val = getattr(metrics, field_name)
            if math.isnan(val) or math.isinf(val):
                errors.append(f"{field_name} ({val}) is not a finite number")

        if metrics.rev_par > metrics.adr:
            errors.append(
                f"RevPAR ({metrics.rev_par}) cannot exceed ADR ({metrics.adr})"
            )

        if metrics.occupancy < 0.0 or metrics.occupancy > 1.0:
            errors.append(
                f"Occupancy ({metrics.occupancy}) must be between 0.0 and 1.0"
            )

        if metrics.adr < 0:
            errors.append(f"ADR ({metrics.adr}) cannot be negative")

        if metrics.total_revenue < 0:
            errors.append(
                f"Total revenue ({metrics.total_revenue}) cannot be negative"
            )

        if metrics.bookings > metrics.available_days:
            errors.append(
                f"Bookings ({metrics.bookings}) cannot exceed "
                f"available days ({metrics.available_days})"
            )

        return ValidationResult(is_valid=len(errors) == 0, errors=errors)

    def validate_decisions(
        self, decisions: List[PricingDecision]
    ) -> ValidationResult:
        """Validate a list of pricing decisions.

        Rules enforced:
            - new_price must be > 0
            - change_percent must end with '%'
            - new_price must not exceed 2x old_price (no doubling)
            - new_price must not drop below 50% of old_price
            - No duplicate dates across decisions

        Args:
            decisions: List of PricingDecision entries.

        Returns:
            ValidationResult with is_valid and any error messages.
        """
        errors: List[str] = []
        seen_dates: set[str] = set()

        for decision in decisions:
            # Reject NaN/infinity prices
            if math.isnan(decision.new_price) or math.isinf(decision.new_price):
                errors.append(
                    f"Date {decision.date}: new_price ({decision.new_price}) "
                    f"is not a finite number"
                )
                continue
            if math.isnan(decision.old_price) or math.isinf(decision.old_price):
                errors.append(
                    f"Date {decision.date}: old_price ({decision.old_price}) "
                    f"is not a finite number"
                )
                continue

            # Price must be positive
            if decision.new_price <= 0:
                errors.append(
                    f"Date {decision.date}: new_price ({decision.new_price}) "
                    f"must be greater than 0"
                )

            # change_percent format check
            if not decision.change_percent.endswith("%"):
                errors.append(
                    f"Date {decision.date}: change_percent "
                    f"'{decision.change_percent}' must end with '%'"
                )

            # Sanity check: no doubling
            if decision.old_price > 0 and decision.new_price > 2 * decision.old_price:
                errors.append(
                    f"Date {decision.date}: new_price ({decision.new_price}) "
                    f"exceeds 2x old_price ({decision.old_price})"
                )

            # Sanity check: no dropping below 50%
            if decision.old_price > 0 and decision.new_price < 0.5 * decision.old_price:
                errors.append(
                    f"Date {decision.date}: new_price ({decision.new_price}) "
                    f"is below 50% of old_price ({decision.old_price})"
                )

            # Duplicate date check
            if decision.date in seen_dates:
                errors.append(
                    f"Date {decision.date}: duplicate decision detected"
                )
            seen_dates.add(decision.date)

        return ValidationResult(is_valid=len(errors) == 0, errors=errors)

    def validate_property_data(self, data: PropertyData) -> ValidationResult:
        """Validate the incoming property data payload.

        Rules enforced:
            - property_id is not empty
            - Calendar has at least 1 record
            - base_price > 0
            - All calendar record prices > 0

        Args:
            data: PropertyData input payload.

        Returns:
            ValidationResult with is_valid and any error messages.
        """
        errors: List[str] = []

        if not data.property_id or not data.property_id.strip():
            errors.append("property_id must not be empty")

        if len(data.calendar) < 1:
            errors.append("Calendar must have at least 1 record")

        if data.base_price <= 0:
            errors.append(
                f"base_price ({data.base_price}) must be greater than 0"
            )

        for record in data.calendar:
            if record.price <= 0:
                errors.append(
                    f"Calendar date {record.date}: "
                    f"price ({record.price}) must be greater than 0"
                )

        return ValidationResult(is_valid=len(errors) == 0, errors=errors)

    def validate_output(self, output: AgentOutput) -> ValidationResult:
        """Validate the final agent output before returning to the caller.

        Rules enforced:
            - property_id is not empty
            - All pricing decisions pass validate_decisions
            - Summary fields are present (pacing_status, market_position, risk_level)

        Args:
            output: The AgentOutput to validate.

        Returns:
            ValidationResult with is_valid and any error messages.
        """
        errors: List[str] = []

        if not output.property_id or not output.property_id.strip():
            errors.append("property_id must not be empty")

        # Validate decisions
        decisions_result = self.validate_decisions(output.decisions)
        if not decisions_result.is_valid:
            errors.extend(decisions_result.errors)

        # Validate metrics if present
        if output.metrics is not None:
            metrics_result = self.validate_metrics(output.metrics)
            if not metrics_result.is_valid:
                errors.extend(metrics_result.errors)

        # Validate summary fields
        if not output.summary.pacing_status:
            errors.append("summary.pacing_status must not be empty")
        if not output.summary.market_position:
            errors.append("summary.market_position must not be empty")
        if not output.summary.risk_level:
            errors.append("summary.risk_level must not be empty")

        return ValidationResult(is_valid=len(errors) == 0, errors=errors)

    @staticmethod
    def create_error_response(errors: List[str]) -> dict:
        """Build a standardized error response dict.

        Args:
            errors: List of human-readable error messages.

        Returns:
            Dict with status, error_type, and errors list.
        """
        return {
            "status": "error",
            "error_type": "INVALID_CALCULATION",
            "errors": errors,
        }
