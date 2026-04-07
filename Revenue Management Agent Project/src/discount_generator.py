"""
Discount Rule Generator.
Creates actionable discount rules for the pricing system.
"""

import logging
from dataclasses import dataclass
from typing import List

logger = logging.getLogger(__name__)


@dataclass
class DiscountRule:
    """A single discount rule to be applied by the pricing system."""
    rule_type: str           # "last_minute", "orphan_day", "length_of_stay", "gap_fill"
    condition: str           # human-readable condition
    discount_percent: str    # e.g. "15%"
    applicable_dates: str    # e.g. "2026-03-22 to 2026-03-25" or "all"


class DiscountGenerator:
    """Generates structured discount rule sets based on signals and market position."""

    def generate_last_minute_rules(
        self, unbooked_dates_within_14_days: List[str]
    ) -> List[DiscountRule]:
        """Create last-minute discount rules for dates within 14 days.

        Args:
            unbooked_dates_within_14_days: ISO-format date strings for
                unbooked dates that are 14 or fewer days from today.

        Returns:
            List containing a single last-minute DiscountRule, or empty
            list if no qualifying dates exist.
        """
        if not unbooked_dates_within_14_days:
            return []

        sorted_dates = sorted(unbooked_dates_within_14_days)
        date_range = f"{sorted_dates[0]} to {sorted_dates[-1]}"

        logger.debug(
            "last_minute rule: %d dates (%s)", len(sorted_dates), date_range
        )
        return [
            DiscountRule(
                rule_type="last_minute",
                condition="date is within 14 days of today",
                discount_percent="15%",
                applicable_dates=date_range,
            )
        ]

    def generate_orphan_day_rules(
        self, orphan_dates: List[str]
    ) -> List[DiscountRule]:
        """Create orphan day discount rules.

        Args:
            orphan_dates: ISO-format date strings for single unbooked
                days sandwiched between booked dates.

        Returns:
            List containing a single orphan day DiscountRule, or empty
            list if no orphan dates exist.
        """
        if not orphan_dates:
            return []

        dates_str = ", ".join(sorted(orphan_dates))

        logger.debug("orphan_day rule: %d dates", len(orphan_dates))
        return [
            DiscountRule(
                rule_type="orphan_day",
                condition="single unbooked day between booked dates",
                discount_percent="20%",
                applicable_dates=dates_str,
            )
        ]

    def generate_length_of_stay_rules(
        self, min_nights: int = 5
    ) -> List[DiscountRule]:
        """Create a length-of-stay discount for extended bookings.

        Args:
            min_nights: Minimum number of nights to qualify for the discount.

        Returns:
            List containing a single length-of-stay DiscountRule.
        """
        return [
            DiscountRule(
                rule_type="length_of_stay",
                condition=f"stay is {min_nights}+ nights",
                discount_percent="10%",
                applicable_dates="all",
            )
        ]

    def generate_gap_fill_rules(
        self, gap_dates: List[str]
    ) -> List[DiscountRule]:
        """Create gap-filling discount for 5+ consecutive empty days.

        Args:
            gap_dates: ISO-format date strings for consecutive unbooked
                days forming a gap of 5 or more days.

        Returns:
            List containing a single gap-fill DiscountRule, or empty
            list if no qualifying gap dates exist.
        """
        if not gap_dates:
            return []

        sorted_dates = sorted(gap_dates)
        date_range = f"{sorted_dates[0]} to {sorted_dates[-1]}"

        logger.debug(
            "gap_fill rule: %d dates (%s)", len(sorted_dates), date_range
        )
        return [
            DiscountRule(
                rule_type="gap_fill",
                condition="5+ consecutive unbooked days in next 14 days",
                discount_percent="12%",
                applicable_dates=date_range,
            )
        ]

    def generate_all(self, signals_data: dict) -> List[DiscountRule]:
        """Generate all applicable discount rules from detected signals.

        Orchestrator method that delegates to individual rule generators
        and returns a deduplicated combined list.

        Args:
            signals_data: Dict with keys:
                - orphan_dates: List[str] of ISO date strings
                - gap_dates: List[str] of ISO date strings
                - last_minute_dates: List[str] of ISO date strings
                - has_long_gaps: bool

        Returns:
            Combined, deduplicated list of DiscountRule objects.
        """
        orphan_dates = signals_data.get("orphan_dates", [])
        gap_dates = signals_data.get("gap_dates", [])
        last_minute_dates = signals_data.get("last_minute_dates", [])
        has_long_gaps = signals_data.get("has_long_gaps", False)

        all_rules: List[DiscountRule] = []

        # Last-minute discounts
        all_rules.extend(
            self.generate_last_minute_rules(last_minute_dates)
        )

        # Orphan day discounts
        all_rules.extend(
            self.generate_orphan_day_rules(orphan_dates)
        )

        # Length-of-stay discounts (always generated)
        all_rules.extend(
            self.generate_length_of_stay_rules()
        )

        # Gap-fill discounts
        if has_long_gaps and gap_dates:
            all_rules.extend(
                self.generate_gap_fill_rules(gap_dates)
            )

        # Deduplicate by rule_type (keep first occurrence)
        seen_types: set = set()
        deduplicated: List[DiscountRule] = []
        for rule in all_rules:
            if rule.rule_type not in seen_types:
                seen_types.add(rule.rule_type)
                deduplicated.append(rule)

        logger.debug(
            "generate_all: %d rules generated (from %d candidates)",
            len(deduplicated), len(all_rules),
        )
        return deduplicated
