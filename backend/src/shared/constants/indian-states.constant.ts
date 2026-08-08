/**
 * Canonical list of Indian states + Union Territories.
 * Mirrored from mobile/src/utils/constants.ts so the same set is available
 * everywhere — server-side validation, distributor workflow, web UI, etc.
 */
export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu & Kashmir',
  'Ladakh',
  'Puducherry',
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export const INDIAN_STATES_SET: ReadonlySet<string> = new Set(INDIAN_STATES);

/** Throws if any of the supplied state names are not in the canonical list. */
export function assertValidIndianStates(states: string[]): void {
  const invalid = states.filter((s) => !INDIAN_STATES_SET.has(s));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown Indian state name(s): ${invalid.join(', ')}. ` +
        `Use one of INDIAN_STATES.`,
    );
  }
}