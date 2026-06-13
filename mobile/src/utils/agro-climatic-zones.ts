/**
 * Agro-Climatic Zones of India — derived from state.
 *
 * Source: Planning Commission of India / Ministry of Agriculture & Farmers Welfare.
 * Zone boundaries are approximate and used for classification only.
 *
 * User does NOT select this — it is always auto-derived from `state`.
 */

export enum AgroClimaticZone {
  WESTERN_HIMALAYAN         = 'western_himalayan',
  EASTERN_HIMALAYAN         = 'eastern_himalayan',
  LOWER_GANGETIC_PLAIN      = 'lower_gangetic_plain',
  MIDDLE_GANGETIC_PLAIN     = 'middle_gangetic_plain',
  UPPER_GANGETIC_PLAIN      = 'upper_gangetic_plain',
  TRANS_GANGETIC_PLAIN      = 'trans_gangetic_plain',
  EASTERN_PLATEAU_AND_HILLS = 'eastern_plateau_and_hills',
  CENTRAL_PLATEAU_AND_HILLS = 'central_plateau_and_hills',
  WESTERN_PLATEAU_AND_HILLS = 'western_plateau_and_hills',
  SAHYADRI_HILLS            = 'sahyadri_hills',
  WESTERN_DRY_REGIONS       = 'western_dry_regions',
  KARNATAKA_PLAIN_AND_LCMS  = 'karnataka_plain_and_lcms',
  COASTAL_ANDHRA_AND_KARNATAKA = 'coastal_andhra_and_karnataka',
  KRISHNA_GODAVARI_DELTA    = 'krishna_godavari_delta',
  EASTERN_GHATS_AND_COASTAL_ODISHA = 'eastern_ghats_and_coastal_odisha',
  WESTERN_GHATS_AND_COASTAL_KERALA = 'western_ghats_and_coastal_kerala',
  // Fallback when state is not mapped
  OTHER                     = 'other',
}

export const AGRO_CLIMATIC_ZONE_LABELS: Record<AgroClimaticZone, string> = {
  [AgroClimaticZone.WESTERN_HIMALAYAN]:          'Western Himalayan',
  [AgroClimaticZone.EASTERN_HIMALAYAN]:          'Eastern Himalayan',
  [AgroClimaticZone.LOWER_GANGETIC_PLAIN]:       'Lower Gangetic Plain',
  [AgroClimaticZone.MIDDLE_GANGETIC_PLAIN]:      'Middle Gangetic Plain',
  [AgroClimaticZone.UPPER_GANGETIC_PLAIN]:       'Upper Gangetic Plain',
  [AgroClimaticZone.TRANS_GANGETIC_PLAIN]:       'Trans-Gangetic Plain',
  [AgroClimaticZone.EASTERN_PLATEAU_AND_HILLS]:  'Eastern Plateau & Hills',
  [AgroClimaticZone.CENTRAL_PLATEAU_AND_HILLS]:  'Central Plateau & Hills',
  [AgroClimaticZone.WESTERN_PLATEAU_AND_HILLS]:  'Western Plateau & Hills',
  [AgroClimaticZone.SAHYADRI_HILLS]:             'Sahyadri Hills',
  [AgroClimaticZone.WESTERN_DRY_REGIONS]:        'Western Dry Regions',
  [AgroClimaticZone.KARNATAKA_PLAIN_AND_LCMS]:   'Karnataka Plain & LCMS',
  [AgroClimaticZone.COASTAL_ANDHRA_AND_KARNATAKA]: 'Coastal Andhra & Karnataka',
  [AgroClimaticZone.KRISHNA_GODAVARI_DELTA]:     'Krishna-Godavari Delta',
  [AgroClimaticZone.EASTERN_GHATS_AND_COASTAL_ODISHA]: 'Eastern Ghats & Coastal Odisha',
  [AgroClimaticZone.WESTERN_GHATS_AND_COASTAL_KERALA]: 'Western Ghats & Coastal Kerala',
  [AgroClimaticZone.OTHER]:                      'Other',
};

/**
 * Maps Indian states/UTs to their agro-climatic zone.
 * Coverage is for all states/UTs in INDIAN_STATES.
 */
export function deriveAgroClimaticZone(state: string): AgroClimaticZone {
  const s = state.toLowerCase().trim();

  if (
    s === 'jammu & kashmir' ||
    s === 'ladakh' ||
    s === 'himachal pradesh' ||
    s === 'uttarakhand'
  ) return AgroClimaticZone.WESTERN_HIMALAYAN;

  if (
    s === 'assam' ||
    s === 'sikkim' ||
    s === 'nagaland' ||
    s === 'meghalaya' ||
    s === 'manipur' ||
    s === 'tripura' ||
    s === 'mizoram' ||
    s === 'arunachal pradesh'
  ) return AgroClimaticZone.EASTERN_HIMALAYAN;

  if (
    s === 'west bengal' ||
    s === 'odisha'
  ) return AgroClimaticZone.LOWER_GANGETIC_PLAIN;

  if (
    s === 'bihar' ||
    s === 'jharkhand'
  ) return AgroClimaticZone.MIDDLE_GANGETIC_PLAIN;

  if (
    s === 'uttar pradesh'
  ) return AgroClimaticZone.UPPER_GANGETIC_PLAIN;

  if (
    s === 'punjab' ||
    s === 'haryana' ||
    s === 'delhi' ||
    s === 'chandigarh'
  ) return AgroClimaticZone.TRANS_GANGETIC_PLAIN;

  if (
    s === 'maharashtra' ||
    s === 'chhattisgarh' ||
    s === 'madhya pradesh'
  ) return AgroClimaticZone.EASTERN_PLATEAU_AND_HILLS;

  if (
    s === 'rajasthan' ||
    s === 'gujarat'
  ) return AgroClimaticZone.CENTRAL_PLATEAU_AND_HILLS;

  if (
    s === 'maharashtra'
  ) return AgroClimaticZone.WESTERN_PLATEAU_AND_HILLS;

  if (
    s === 'karnataka'
  ) return AgroClimaticZone.KARNATAKA_PLAIN_AND_LCMS;

  if (
    s === 'tamil nadu' ||
    s === 'puducherry'
  ) return AgroClimaticZone.COASTAL_ANDHRA_AND_KARNATAKA;

  if (
    s === 'andhra pradesh' ||
    s === 'telangana'
  ) return AgroClimaticZone.KRISHNA_GODAVARI_DELTA;

  if (
    s === 'kerala'
  ) return AgroClimaticZone.WESTERN_GHATS_AND_COASTAL_KERALA;

  return AgroClimaticZone.OTHER;
}