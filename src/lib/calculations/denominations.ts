import { roundToCents } from './financials';

export type PricingMode = 'fixed' | 'denomination';

export interface AgreedDenomination {
  sos: number;
  usd: number;
}

/**
 * Agreed discrete denominations for the shop:
 * $0.05 = 1,000 SOS
 * $0.10 = 3,000 SOS
 * $0.15 = 4,000 SOS
 * $0.20 = 6,000 SOS
 * $0.25 = 7,000 SOS
 */
export const AGREED_DENOMINATIONS: readonly AgreedDenomination[] = [
  { sos: 1000, usd: 0.05 },
  { sos: 3000, usd: 0.10 },
  { sos: 4000, usd: 0.15 },
  { sos: 6000, usd: 0.20 },
  { sos: 7000, usd: 0.25 },
] as const;

export interface DenominationCalculationResult {
  actualSos: number;
  hasExactDenomination: boolean;
  denominationSos: number;
  denominationUsd: number;
  differenceSos: number;
}

/**
 * Calculates the applicable agreed denomination for a given total SOS amount.
 * 
 * Rules:
 * - Discrete agreed denominations, NOT a fixed exchange rate.
 * - If product is 5,000 SOS, next applicable denomination is $0.20 = 6,000 SOS (diff = 1,000 SOS).
 * - Multiples above 7,000 SOS compose 7,000 SOS ($0.25) blocks + remainder discrete lookup.
 */
export function calculateSosDenomination(totalSos: number): DenominationCalculationResult {
  const safeSos = Math.max(0, Math.round(totalSos));
  
  if (safeSos === 0) {
    return {
      actualSos: 0,
      hasExactDenomination: true,
      denominationSos: 0,
      denominationUsd: 0,
      differenceSos: 0,
    };
  }

  const quarters = Math.floor(safeSos / 7000);
  const remainder = safeSos % 7000;

  if (remainder === 0) {
    const denominationSos = quarters * 7000;
    const denominationUsd = roundToCents(quarters * 0.25);
    return {
      actualSos: safeSos,
      hasExactDenomination: true,
      denominationSos,
      denominationUsd,
      differenceSos: 0,
    };
  }

  const match = AGREED_DENOMINATIONS.find(d => d.sos >= remainder);
  if (match) {
    const denominationSos = quarters * 7000 + match.sos;
    const denominationUsd = roundToCents(quarters * 0.25 + match.usd);
    const differenceSos = denominationSos - safeSos;

    return {
      actualSos: safeSos,
      hasExactDenomination: differenceSos === 0,
      denominationSos,
      denominationUsd,
      differenceSos,
    };
  }

  // Fallback if remainder exceeds top tier (unreachable with modulo 7000)
  return {
    actualSos: safeSos,
    hasExactDenomination: true,
    denominationSos: safeSos,
    denominationUsd: roundToCents((safeSos / 7000) * 0.25),
    differenceSos: 0,
  };
}

/**
 * Formats an SOS value with comma separation: e.g. 5000 -> "5,000 SOS"
 */
export function formatSos(amount: number): string {
  const safe = Math.round(Number(amount) || 0);
  return `${safe.toLocaleString('en-US')} SOS`;
}
