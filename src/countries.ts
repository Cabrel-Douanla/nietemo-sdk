/**
 * Mobile Money coverage (Swinmo Pay API v1.4): the 18 supported countries, their native currency and
 * operators. Mirrors the Nietemo platform; the server stays the source of truth and rejects unsupported
 * combinations with a clear message.
 */

export interface MobileMoneyCountry {
  /** ISO 3166-1 alpha-2, e.g. "CM". */
  iso2: string;
  /** ISO 3166-1 alpha-3, used in operator codes such as "ORANGE_CMR". */
  iso3: string;
  name: string;
  currency: string;
  /** International dial code without "+". */
  dialCode: string;
  operators: readonly string[];
}

export const MOBILE_MONEY_COUNTRIES: readonly MobileMoneyCountry[] = [
  { iso2: 'BJ', iso3: 'BEN', name: 'Bénin', currency: 'XOF', dialCode: '229', operators: ['MTN', 'MOOV', 'CELTIIS'] },
  { iso2: 'BF', iso3: 'BFA', name: 'Burkina Faso', currency: 'XOF', dialCode: '226', operators: ['ORANGE', 'MOOV'] },
  { iso2: 'CM', iso3: 'CMR', name: 'Cameroun', currency: 'XAF', dialCode: '237', operators: ['MTN', 'ORANGE'] },
  { iso2: 'CG', iso3: 'COG', name: 'Congo-Brazzaville', currency: 'XAF', dialCode: '242', operators: ['MTN', 'AIRTEL'] },
  { iso2: 'CI', iso3: 'CIV', name: "Côte d'Ivoire", currency: 'XOF', dialCode: '225', operators: ['ORANGE', 'MTN', 'WAVE', 'MOOV', 'DJAMO'] },
  { iso2: 'GA', iso3: 'GAB', name: 'Gabon', currency: 'XAF', dialCode: '241', operators: ['AIRTEL', 'MOOV'] },
  { iso2: 'GH', iso3: 'GHA', name: 'Ghana', currency: 'GHS', dialCode: '233', operators: ['MTN', 'TELECEL', 'AIRTELTIGO'] },
  { iso2: 'GN', iso3: 'GIN', name: 'Guinée', currency: 'GNF', dialCode: '224', operators: ['MTN'] },
  { iso2: 'KE', iso3: 'KEN', name: 'Kenya', currency: 'KES', dialCode: '254', operators: ['MPESA', 'AIRTEL'] },
  { iso2: 'ML', iso3: 'MLI', name: 'Mali', currency: 'XOF', dialCode: '223', operators: ['ORANGE', 'MOOV', 'MOBICASH', 'WAVE'] },
  { iso2: 'NE', iso3: 'NER', name: 'Niger', currency: 'XOF', dialCode: '227', operators: ['AIRTEL'] },
  { iso2: 'UG', iso3: 'UGA', name: 'Ouganda', currency: 'UGX', dialCode: '256', operators: ['MTN', 'AIRTEL'] },
  { iso2: 'CD', iso3: 'COD', name: 'RD Congo', currency: 'CDF', dialCode: '243', operators: ['VODACOM_MPESA', 'ORANGE', 'AIRTEL', 'AFRIMONEY'] },
  { iso2: 'RW', iso3: 'RWA', name: 'Rwanda', currency: 'RWF', dialCode: '250', operators: ['MTN', 'AIRTEL'] },
  { iso2: 'SN', iso3: 'SEN', name: 'Sénégal', currency: 'XOF', dialCode: '221', operators: ['ORANGE', 'WAVE', 'FREE', 'EXPRESSO'] },
  { iso2: 'SL', iso3: 'SLE', name: 'Sierra Leone', currency: 'SLE', dialCode: '232', operators: ['ORANGE'] },
  { iso2: 'TZ', iso3: 'TZA', name: 'Tanzanie', currency: 'TZS', dialCode: '255', operators: ['VODACOM_MPESA', 'AIRTEL', 'TIGO', 'HALOPESA', 'EZYPESA', 'TTCL'] },
  { iso2: 'TG', iso3: 'TGO', name: 'Togo', currency: 'XOF', dialCode: '228', operators: ['TOGOCOM', 'MOOV'] },
];

/** Finds a supported country by ISO alpha-2 or alpha-3 code (case-insensitive). */
export function getMobileMoneyCountry(code: string | null | undefined): MobileMoneyCountry | undefined {
  const c = (code ?? '').trim().toUpperCase();
  return MOBILE_MONEY_COUNTRIES.find((country) => country.iso2 === c || country.iso3 === c);
}
