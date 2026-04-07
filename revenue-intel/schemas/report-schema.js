/**
 * Report Schema (Zod)
 *
 * Validates the structure of reports produced by the revenue engine
 * and the orchestrator. Matches the Python engine's output contract.
 */

import { z } from 'zod';

export const PricingDecisionSchema = z.object({
  date: z.string(),
  old_price: z.number(),
  new_price: z.number(),
  change_percent: z.string(),
  reason: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  rule_applied: z.string(),
});

export const RevenueMetricsSchema = z.object({
  total_revenue: z.number(),
  bookings: z.number(),
  available_days: z.number(),
  adr: z.number(),
  occupancy: z.number(),
  rev_par: z.number(),
});

export const SummaryBlockSchema = z.object({
  pacing_status: z.string(),
  market_position: z.string(),
  risk_level: z.enum(['low', 'medium', 'high']),
});

export const EngineOutputSchema = z.object({
  property_id: z.string(),
  date_range: z.string(),
  issues_detected: z.array(z.string()),
  decisions: z.array(PricingDecisionSchema),
  summary: SummaryBlockSchema,
  next_actions: z.array(z.string()),
  metrics: RevenueMetricsSchema.optional(),
  status: z.string(),
});

export const PropertyReportSchema = z.object({
  name: z.string(),
  market: z.string(),
  scrapedAt: z.string(),
  pricelabsData: z.any().optional(),
  engineAnalysis: EngineOutputSchema.optional(),
  claudeAnalysis: z.string().optional(),
});

export const FullReportSchema = z.object({
  mode: z.enum(['daily', 'weekly']),
  generatedAt: z.string(),
  properties: z.array(PropertyReportSchema),
  summary: z.string().optional(),
});
