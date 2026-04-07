"""
Tool Interfaces for the Pricing Agent.
These are integration stubs — in production they connect to:
  - PriceLabs API
  - Airbnb scraper
  - AirDNA API
  - PMS/Channel Manager
"""

import logging
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, date, timedelta
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ToolResult:
    """Standard result wrapper for all tool calls."""
    success: bool
    data: dict
    error: Optional[str] = None


class ToolInterfaces:
    """Stateless tool interface class.

    Each method returns a ToolResult. In stub mode, all methods generate
    realistic fake data for development and testing purposes.
    """

    def scrape_airbnb(
        self, listing_ids: List[str], dates: List[str]
    ) -> ToolResult:
        """Scrape Airbnb competitor pricing for given listings and dates.

        Args:
            listing_ids: Airbnb listing IDs to scrape.
            dates: ISO-format date strings to check.

        Returns:
            ToolResult with competitor_prices list and per-date availability.
        """
        try:
            if not listing_ids or not dates:
                return ToolResult(
                    success=True,
                    data={"competitor_prices": [], "is_fully_booked": {}},
                )

            base_price = 200.0
            competitor_prices: List[dict] = []

            for listing_id in listing_ids:
                for date_str in dates:
                    price = round(
                        base_price * random.uniform(0.85, 1.15), 2
                    )
                    is_available = random.random() > 0.4
                    competitor_prices.append({
                        "listing_id": listing_id,
                        "date": date_str,
                        "price": price,
                        "is_available": is_available,
                    })

            # Per-date fully-booked flag (all listings unavailable for that date)
            dates_availability: dict = {}
            for date_str in dates:
                date_entries = [
                    cp for cp in competitor_prices if cp["date"] == date_str
                ]
                all_unavailable = all(
                    not cp["is_available"] for cp in date_entries
                ) if date_entries else False
                dates_availability[date_str] = all_unavailable

            logger.debug(
                "scrape_airbnb: %d listings × %d dates = %d price records",
                len(listing_ids), len(dates), len(competitor_prices),
            )

            return ToolResult(
                success=True,
                data={
                    "competitor_prices": competitor_prices,
                    "is_fully_booked": dates_availability,
                },
            )
        except Exception as exc:
            logger.error("scrape_airbnb failed: %s", exc)
            return ToolResult(success=False, data={}, error=str(exc))

    def get_pricing_calendar(
        self, property_id: str, days_ahead: int = 90
    ) -> ToolResult:
        """Retrieve the pricing calendar for a property.

        Args:
            property_id: Internal property identifier.
            days_ahead: Number of days to look ahead (clamped to 30-90).

        Returns:
            ToolResult with a list of date entries including price and booking status.
        """
        try:
            today = date.today()
            actual_days = max(30, min(days_ahead, 90))
            dates_list: List[dict] = []

            for i in range(actual_days):
                current_date = today + timedelta(days=i)
                # Simulate a mix of booked/unbooked: ~55% booked
                is_booked = random.random() < 0.55
                # Price varies around a $200 base
                current_price = round(
                    200.0 * random.uniform(0.85, 1.20), 2
                )
                dates_list.append({
                    "date": current_date.isoformat(),
                    "current_price": current_price,
                    "is_booked": is_booked,
                    "days_out": i,
                })

            logger.debug(
                "get_pricing_calendar: property=%s days=%d", property_id, actual_days
            )

            return ToolResult(
                success=True,
                data={"dates": dates_list},
            )
        except Exception as exc:
            logger.error("get_pricing_calendar failed: %s", exc)
            return ToolResult(success=False, data={}, error=str(exc))

    def get_competitor_data(
        self, location: str, filters: dict
    ) -> ToolResult:
        """Fetch aggregated competitor/market data for a location.

        Args:
            location: Market location string (e.g. "Miami Beach, FL").
            filters: Optional filters (property type, bedrooms, etc.).

        Returns:
            ToolResult with a list of competitor summaries.
        """
        try:
            num_competitors = random.randint(5, 12)
            competitors: List[dict] = []

            for i in range(num_competitors):
                competitors.append({
                    "listing_id": f"comp_{location.replace(' ', '_')}_{i}",
                    "avg_price": round(random.uniform(150, 280), 2),
                    "avg_occupancy": round(random.uniform(0.45, 0.85), 2),
                    "num_listings": random.randint(1, 8),
                })

            logger.debug(
                "get_competitor_data: location=%s competitors=%d",
                location, num_competitors,
            )

            return ToolResult(
                success=True,
                data={"competitors": competitors},
            )
        except Exception as exc:
            logger.error("get_competitor_data failed: %s", exc)
            return ToolResult(success=False, data={}, error=str(exc))

    def update_pricing(
        self, property_id: str, date_str: str, new_price: float
    ) -> ToolResult:
        """Push a price update to the PMS/channel manager.

        Args:
            property_id: Internal property identifier.
            date_str: ISO-format date string for the price update.
            new_price: New nightly price to set.

        Returns:
            ToolResult confirming the update.
        """
        try:
            logger.debug(
                "update_pricing: property=%s date=%s price=%.2f",
                property_id, date_str, new_price,
            )
            return ToolResult(
                success=True,
                data={
                    "success": True,
                    "property_id": property_id,
                    "date": date_str,
                    "new_price": new_price,
                    "updated_at": datetime.now().isoformat(),
                },
            )
        except Exception as exc:
            logger.error("update_pricing failed: %s", exc)
            return ToolResult(success=False, data={}, error=str(exc))

    def create_discount_rule(
        self, property_id: str, rule: dict
    ) -> ToolResult:
        """Create a discount rule in the pricing system.

        Args:
            property_id: Internal property identifier.
            rule: Dict describing the discount rule parameters.

        Returns:
            ToolResult with the created rule ID and details.
        """
        try:
            rule_id = str(uuid.uuid4())
            logger.debug(
                "create_discount_rule: property=%s rule_id=%s", property_id, rule_id
            )
            return ToolResult(
                success=True,
                data={
                    "success": True,
                    "rule_id": rule_id,
                    "property_id": property_id,
                    "rule": rule,
                },
            )
        except Exception as exc:
            logger.error("create_discount_rule failed: %s", exc)
            return ToolResult(success=False, data={}, error=str(exc))
