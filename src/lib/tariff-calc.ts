import type { TariffPlan, TariffBracket, TariffPrice } from './types';

/** Returns the total price for a bracket period (regardless of pricing type) */
function bracketTotalPrice(bracket: TariffBracket, price: TariffPrice): number {
  const days = bracket.minDays || 1;
  if (price.pricingType === 'DIA' || price.pricingType === 'DIA_KM') {
    return price.price * days;
  }
  // FIJO, KM, LIBRE: price is the total
  return price.price;
}

/** Returns the daily rate for a bracket */
function bracketDailyRate(bracket: TariffBracket, price: TariffPrice): number {
  const days = bracket.minDays || 1;
  return bracketTotalPrice(bracket, price) / days;
}

/**
 * Find the reference bracket for a given number of days.
 * Returns the largest defined bracket whose minDays <= billedDays.
 * If billedDays < smallest bracket, returns the smallest bracket.
 */
function findReferenceBracket(
  billedDays: number,
  brackets: TariffBracket[],
  prices: TariffPrice[],
  categoryId: string
): { bracket: TariffBracket; price: TariffPrice } | null {
  // Only brackets that have a price for this category, sorted by minDays ASC
  const available = brackets
    .filter((b) => !b.isExtraDay)
    .map((b) => {
      const p = prices.find((pr) => pr.bracketId === b.id && pr.categoryId === categoryId);
      return p ? { bracket: b, price: p } : null;
    })
    .filter(Boolean) as { bracket: TariffBracket; price: TariffPrice }[];

  if (available.length === 0) return null;

  available.sort((a, b) => a.bracket.minDays - b.bracket.minDays);

  // Exact match
  const exact = available.find((x) => x.bracket.minDays === billedDays);
  if (exact) return exact;

  // Largest bracket whose minDays <= billedDays
  const lower = [...available].reverse().find((x) => x.bracket.minDays <= billedDays);
  if (lower) return lower;

  // billedDays < all brackets: use smallest
  return available[0];
}

/**
 * Compute base price for a given number of days and category within a single tariff plan.
 * Uses proration: (total_for_reference_bracket / reference_bracket_days) * billedDays
 */
export function computePriceForDays(
  billedDays: number,
  brackets: TariffBracket[],
  prices: TariffPrice[],
  categoryId: string
): number {
  if (billedDays <= 0) return 0;

  const ref = findReferenceBracket(billedDays, brackets, prices, categoryId);
  if (!ref) return 0;

  const { bracket, price } = ref;

  if (price.pricingType === 'LIBRE') return 0;

  const dailyRate = bracketDailyRate(bracket, price);
  const total = dailyRate * billedDays;
  return Math.round(total * 100) / 100;
}

/** Find all tariff plans covering a date range (potentially multiple for season crossing) */
export function findApplicablePlans(
  startDate: string,
  endDate: string,
  plans: TariffPlan[]
): { plan: TariffPlan; daysInPlan: number; planStartDate: string; planEndDate: string }[] {
  const result: { plan: TariffPlan; daysInPlan: number; planStartDate: string; planEndDate: string }[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const plan of plans) {
    if (!plan.active) continue;
    const planFrom = new Date(plan.validFrom);
    const planTo = new Date(plan.validTo);

    // Overlap check
    if (planTo <= start || planFrom >= end) continue;

    const overlapStart = planFrom > start ? planFrom : start;
    const overlapEnd = planTo < end ? planTo : end;
    const daysInPlan = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));

    if (daysInPlan > 0) {
      result.push({
        plan,
        daysInPlan,
        planStartDate: overlapStart.toISOString().slice(0, 10),
        planEndDate: overlapEnd.toISOString().slice(0, 10),
      });
    }
  }

  return result.sort((a, b) => a.planStartDate.localeCompare(b.planStartDate));
}

export interface PriceBreakdown {
  total: number;
  breakdown: {
    planId: string;
    planName: string;
    daysInPlan: number;
    priceForSegment: number;
  }[];
  applicablePlans: number;
}

/**
 * Compute total base price for a reservation spanning possibly multiple tariff plans (seasons).
 *
 * Season crossing rules:
 * - Determine reference bracket from TOTAL days
 * - For each plan segment: (segment_days / reference_bracket_days) * segment_price_for_reference_bracket
 *
 * @param startDate YYYY-MM-DD
 * @param endDate YYYY-MM-DD
 * @param totalBilledDays total billed days (may differ from calendar diff due to cutoff hours)
 * @param categoryId vehicle category ID
 * @param plans all TariffPlans
 * @param brackets all TariffBrackets
 * @param prices all TariffPrices
 */
export function computePriceForDateRange(
  startDate: string,
  endDate: string,
  totalBilledDays: number,
  categoryId: string,
  plans: TariffPlan[],
  brackets: TariffBracket[],
  prices: TariffPrice[]
): PriceBreakdown {
  const applicable = findApplicablePlans(startDate, endDate, plans);

  if (applicable.length === 0) {
    return { total: 0, breakdown: [], applicablePlans: 0 };
  }

  if (applicable.length === 1) {
    // Single plan - simple calculation
    const planBrackets = brackets.filter((b) => b.planId === applicable[0].plan.id);
    const planPrices = prices.filter((p) => applicable[0].plan.id === brackets.find((b) => b.id === p.bracketId)?.planId);
    const total = computePriceForDays(totalBilledDays, planBrackets, planPrices, categoryId);
    return {
      total,
      breakdown: [{ planId: applicable[0].plan.id, planName: applicable[0].plan.name, daysInPlan: totalBilledDays, priceForSegment: total }],
      applicablePlans: 1,
    };
  }

  // Multiple plans (season crossing)
  // Find reference bracket based on TOTAL days from each plan
  let total = 0;
  const breakdown: PriceBreakdown['breakdown'] = [];

  const totalCalendarDays = applicable.reduce((s, a) => s + a.daysInPlan, 0) || 1;

  for (const seg of applicable) {
    const planBrackets = brackets.filter((b) => b.planId === seg.plan.id);
    const planPrices = prices.filter((p) => planBrackets.some((b) => b.id === p.bracketId));

    // Proportional billed days for this segment
    const segBilledDays = Math.round((seg.daysInPlan / totalCalendarDays) * totalBilledDays);

    // Find reference bracket based on TOTAL billed days (not segment days)
    const ref = findReferenceBracket(totalBilledDays, planBrackets, planPrices, categoryId);
    if (!ref) continue;

    // Price for this segment: (segment_billed_days / reference_days) * reference_total_price
    const refTotal = bracketTotalPrice(ref.bracket, ref.price);
    const refDays = ref.bracket.minDays || 1;
    const segPrice = Math.round((refTotal / refDays) * segBilledDays * 100) / 100;

    total += segPrice;
    breakdown.push({ planId: seg.plan.id, planName: seg.plan.name, daysInPlan: seg.daysInPlan, priceForSegment: segPrice });
  }

  return { total: Math.round(total * 100) / 100, breakdown, applicablePlans: applicable.length };
}
