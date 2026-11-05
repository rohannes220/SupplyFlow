// Domestic-only lookups: SupplyFlow accepts orders from the 50 states, DC and
// the five inhabited US territories. International orders are not accepted.

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

export const US_TERRITORIES = Object.freeze({
  AS: 'American Samoa',
  GU: 'Guam',
  MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico',
  VI: 'U.S. Virgin Islands',
});

/** Every accepted region, code -> name. */
export const US_REGIONS = Object.freeze({ ...US_STATES, ...US_TERRITORIES });

const NAME_TO_CODE = new Map([
  ...Object.entries(US_REGIONS).map(([code, name]) => [name.toLowerCase(), code]),
  ['us virgin islands', 'VI'],
  ['virgin islands', 'VI'],
  ['washington dc', 'DC'],
  ['washington d.c.', 'DC'],
]);

const US_COUNTRY_NAMES = new Set([
  'us',
  'usa',
  'u.s.',
  'u.s.a.',
  'united states',
  'united states of america',
]);

// Area codes inside the +1 North American Numbering Plan that belong to other
// countries (Canada and Caribbean/Atlantic nations). A +1 number alone does not
// mean the customer is in the US.
// Sources: NANPA area code lists for Canada and non-US NANP members.
// prettier-ignore
const NON_US_AREA_CODES = new Set([
  // Canada
  '204', '226', '236', '249', '250', '257', '263', '273', '289', '306', '343', '354', '365',
  '367', '368', '382', '387', '403', '416', '418', '428', '431', '437', '438', '450', '460',
  '468', '474', '506', '514', '519', '537', '548', '568', '579', '581', '584', '587', '600',
  '604', '613', '622', '639', '647', '672', '683', '705', '709', '742', '753', '778', '780',
  '782', '807', '819', '825', '851', '867', '873', '879', '902', '905', '942',
  // Caribbean and Atlantic NANP members
  '242', '246', '264', '268', '284', '345', '441', '473', '649', '658', '664', '721', '758',
  '767', '784', '809', '829', '849', '868', '869', '876',
]);

/** Returns the two-letter USPS code for a US state/DC/territory (code or name), or null. */
export function normalizeUsState(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  if (Object.hasOwn(US_REGIONS, upper)) return upper;
  return NAME_TO_CODE.get(trimmed.toLowerCase().replace(/\s+/g, ' ')) ?? null;
}

/**
 * Returns a 10-digit US phone number (digits only), or null.
 * Accepts common formats and an optional +1 / 1 prefix. Rejects other country
 * codes and +1 area codes that belong to Canada or Caribbean nations.
 */
export function normalizeUsPhone(value) {
  if (typeof value !== 'string') return null;
  if (!/^[\d\s().+-]+$/.test(value)) return null;
  const hasPlus = value.trim().startsWith('+');
  let digits = value.replace(/\D/g, '');
  if (hasPlus && !digits.startsWith('1')) return null;
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  if (NON_US_AREA_CODES.has(digits.slice(0, 3))) return null;
  return digits;
}

export function isUsCountry(value) {
  return typeof value === 'string' && US_COUNTRY_NAMES.has(value.trim().toLowerCase());
}

/** Formats 4045550123 as (404) 555-0123 for display. */
export function formatUsPhone(digits) {
  return /^\d{10}$/.test(digits)
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : digits;
}
