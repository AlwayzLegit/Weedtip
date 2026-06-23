/**
 * Cannabis licensing authority by US state. The "license on file" data uses
 * CA-DCC-shaped column names (`dcc_phone`, `dcc_email`) but applies to shops in
 * any state, so labels must reflect the dispensary's actual authority rather
 * than hardcoding California. Returns null for states without a known mapping
 * so callers can fall back to a neutral label.
 */
const AUTHORITIES: Record<string, string> = {
  CA: 'California DCC',
  NY: 'New York OCM',
  NJ: 'New Jersey CRC',
  MA: 'Massachusetts CCC',
  CT: 'Connecticut DCP',
  CO: 'Colorado MED',
  WA: 'Washington LCB',
  OR: 'Oregon OLCC',
  MI: 'Michigan CRA',
  IL: 'Illinois IDFPR',
  NV: 'Nevada CCB',
  AZ: 'Arizona ADHS',
  NM: 'New Mexico CCD',
  MD: 'Maryland MCA',
  MO: 'Missouri DHSS',
};

export function licenseAuthority(state?: string | null): string | null {
  const code = state?.toUpperCase();
  return (code && AUTHORITIES[code]) || null;
}
