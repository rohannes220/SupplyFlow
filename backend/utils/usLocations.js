// Domestic-only lookups: SupplyFlow does not accept international orders.

export const US_STATES = Object.freeze({
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
});

const STATE_NAME_TO_CODE = new Map(
  Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]),
);

const US_COUNTRY_NAMES = new Set([
  'us',
  'usa',
  'u.s.',
  'u.s.a.',
  'united states',
  'united states of america',
]);

/** Returns the two-letter USPS code for a US state (code or full name), or null. */
export function normalizeUsState(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  if (Object.hasOwn(US_STATES, upper)) return upper;
  return STATE_NAME_TO_CODE.get(trimmed.toLowerCase().replace(/\s+/g, ' ')) ?? null;
}

/**
 * Returns a 10-digit North American Numbering Plan number, or null.
 * Accepts common formats and an optional +1 / 1 country code; any other
 * country code is rejected.
 */
export function normalizeUsPhone(value) {
  if (typeof value !== 'string') return null;
  if (!/^[\d\s().+-]+$/.test(value)) return null;
  const hasPlus = value.trim().startsWith('+');
  let digits = value.replace(/\D/g, '');
  if (hasPlus && !digits.startsWith('1')) return null;
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return digits;
}

export function isUsCountry(value) {
  return typeof value === 'string' && US_COUNTRY_NAMES.has(value.trim().toLowerCase());
}
