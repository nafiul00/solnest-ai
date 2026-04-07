"""
Market Analyzer — Competitor and Market Intelligence.
Analyzes external data to determine market positioning.
"""

import logging
from dataclasses import dataclass
from typing import List

logger = logging.getLogger(__name__)


@dataclass
class CompetitorPrice:
    """A single competitor price observation."""
    listing_id: str
    date: str
    price: float
    is_available: bool


@dataclass
class MarketAnalysis:
    """Result of a market positioning analysis."""
    position_vs_comps: str       # e.g. "above comps by 12.0%", "below comps by 5.0%", "aligned with comps"
    pricing_gap_percent: str     # e.g. "+12.0%", "-5.0%"
    occupancy_comparison: str    # e.g. "ahead +8% vs market", "behind 3% vs market"
    our_avg_price: float
    comp_avg_price: float
    comp_avg_occupancy: float
    recommendation: str          # "increase", "decrease", "hold"


class MarketAnalyzer:
    """Compares our pricing against competitors and market data."""

    def analyze(
        self,
        our_prices: List[float],
        our_occupancy: float,
        competitor_data: dict,
        airdna_data: dict,
    ) -> MarketAnalysis:
        """Perform a full market positioning analysis.

        Args:
            our_prices: List of our nightly prices for the analysis window.
            our_occupancy: Our current occupancy rate (0.0-1.0).
            competitor_data: Dict with key "competitors", each having
                avg_price, avg_occupancy, num_listings.
            airdna_data: Additional market data (reserved for future use).

        Returns:
            MarketAnalysis with positioning, gap, and recommendation.
        """
        # Calculate our average price
        if our_prices:
            our_avg_price = sum(our_prices) / len(our_prices)
        else:
            our_avg_price = 0.0

        # Extract competitor averages
        competitors = competitor_data.get("competitors", [])
        if competitors:
            comp_avg_price = sum(
                c["avg_price"] for c in competitors
            ) / len(competitors)
            comp_avg_occupancy = sum(
                c["avg_occupancy"] for c in competitors
            ) / len(competitors)
        else:
            comp_avg_price = 0.0
            comp_avg_occupancy = 0.0

        # Calculate pricing gap
        if comp_avg_price > 0:
            gap = ((our_avg_price - comp_avg_price) / comp_avg_price) * 100.0
        else:
            gap = 0.0

        pricing_gap_percent = f"{gap:+.1f}%"

        # Determine position vs comps (8% threshold)
        if gap > 8.0:
            position_vs_comps = f"above comps by {abs(gap):.1f}%"
        elif gap < -8.0:
            position_vs_comps = f"below comps by {abs(gap):.1f}%"
        else:
            position_vs_comps = "aligned with comps"

        # Occupancy comparison (3-branch to avoid "behind 0%" or negative signs)
        if comp_avg_occupancy > 0:
            occ_delta = (our_occupancy - comp_avg_occupancy) * 100.0
        else:
            occ_delta = 0.0

        if occ_delta > 0:
            occupancy_comparison = f"ahead +{occ_delta:.0f}% vs market"
        elif occ_delta < 0:
            occupancy_comparison = f"behind {abs(occ_delta):.0f}% vs market"
        else:
            occupancy_comparison = "aligned with market"

        # Determine recommendation
        if "above comps" in position_vs_comps and our_occupancy < 0.5:
            recommendation = "decrease"
        elif "below comps" in position_vs_comps and comp_avg_occupancy > 0.7:
            recommendation = "increase"
        else:
            recommendation = "hold"

        logger.debug(
            "Market analysis: gap=%.1f%% position=%s occ_delta=%.1f%% recommendation=%s",
            gap, position_vs_comps, occ_delta, recommendation,
        )

        return MarketAnalysis(
            position_vs_comps=position_vs_comps,
            pricing_gap_percent=pricing_gap_percent,
            occupancy_comparison=occupancy_comparison,
            our_avg_price=round(our_avg_price, 2),
            comp_avg_price=round(comp_avg_price, 2),
            comp_avg_occupancy=round(comp_avg_occupancy, 4),
            recommendation=recommendation,
        )

    def extract_competitor_prices(
        self, scrape_result: dict
    ) -> List[CompetitorPrice]:
        """Convert raw Airbnb scrape data to CompetitorPrice objects.

        Args:
            scrape_result: Dict with key "competitor_prices", each entry
                having listing_id, date, price, is_available.

        Returns:
            List of CompetitorPrice dataclass instances.
        """
        raw_prices = scrape_result.get("competitor_prices", [])
        result = [
            CompetitorPrice(
                listing_id=entry["listing_id"],
                date=entry["date"],
                price=entry["price"],
                is_available=entry["is_available"],
            )
            for entry in raw_prices
        ]
        logger.debug("Extracted %d competitor prices", len(result))
        return result

    def calculate_market_occupancy(self, competitor_data: dict) -> float:
        """Calculate weighted average occupancy from competitor data.

        Weights each competitor's occupancy by its number of listings.

        Args:
            competitor_data: Dict with key "competitors", each having
                avg_occupancy and num_listings.

        Returns:
            Weighted average occupancy (0.0-1.0).
        """
        competitors = competitor_data.get("competitors", [])
        if not competitors:
            return 0.0

        total_weight = sum(c.get("num_listings", 1) for c in competitors)
        if total_weight == 0:
            return 0.0

        weighted_sum = sum(
            c["avg_occupancy"] * c.get("num_listings", 1)
            for c in competitors
        )
        return round(weighted_sum / total_weight, 4)
