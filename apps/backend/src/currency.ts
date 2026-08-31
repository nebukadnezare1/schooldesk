/**
 * ISO 3166-1 alpha-2 country code -> ISO 4217 alpha-3 currency code, for every country a school
 * can select at registration/in Settings (see settings-routes.ts, auth-routes.ts). Used only to
 * validate that a client-supplied pair looks like a real code, and to suggest a currency when a
 * country is picked on the frontend — the school's actual currencyCode is independent of this
 * table and can be any value in KNOWN_CURRENCIES (see §4 of the currency feature: the user must
 * always be able to override the suggestion).
 *
 * Kept in sync by hand with apps/frontend/src/currency.ts (same object, no shared package between
 * the two workspaces — see types.ts for the existing precedent of manually mirroring shapes).
 * A handful of dollarized/unilaterally-pegged territories are simplified to their de facto
 * currency (e.g. Ecuador/El Salvador -> USD, Kosovo/Montenegro -> EUR) rather than modelling
 * dual-currency edge cases no school here needs.
 */
export const COUNTRY_CURRENCY: Record<string, string> = {
    // Afrique
    DZ: 'DZD', AO: 'AOA', BJ: 'XOF', BW: 'BWP', BF: 'XOF', BI: 'BIF', CV: 'CVE', CM: 'XAF',
    CF: 'XAF', TD: 'XAF', KM: 'KMF', CG: 'XAF', CD: 'CDF', CI: 'XOF', DJ: 'DJF', EG: 'EGP',
    GQ: 'XAF', ER: 'ERN', SZ: 'SZL', ET: 'ETB', GA: 'XAF', GM: 'GMD', GH: 'GHS', GN: 'GNF',
    GW: 'XOF', KE: 'KES', LS: 'LSL', LR: 'LRD', LY: 'LYD', MG: 'MGA', MW: 'MWK', ML: 'XOF',
    MR: 'MRU', MU: 'MUR', MA: 'MAD', MZ: 'MZN', NA: 'NAD', NE: 'XOF', NG: 'NGN', RW: 'RWF',
    ST: 'STN', SN: 'XOF', SC: 'SCR', SL: 'SLE', SO: 'SOS', ZA: 'ZAR', SS: 'SSP', SD: 'SDG',
    TZ: 'TZS', TG: 'XOF', TN: 'TND', UG: 'UGX', ZM: 'ZMW', ZW: 'ZWG', EH: 'MAD',
    // Amériques
    US: 'USD', CA: 'CAD', MX: 'MXN', GT: 'GTQ', BZ: 'BZD', SV: 'USD', HN: 'HNL', NI: 'NIO',
    CR: 'CRC', PA: 'PAB', CU: 'CUP', DO: 'DOP', HT: 'HTG', JM: 'JMD', TT: 'TTD', BS: 'BSD',
    BB: 'BBD', GD: 'XCD', LC: 'XCD', VC: 'XCD', AG: 'XCD', KN: 'XCD', DM: 'XCD', CO: 'COP',
    VE: 'VES', GY: 'GYD', SR: 'SRD', EC: 'USD', PE: 'PEN', BR: 'BRL', BO: 'BOB', PY: 'PYG',
    UY: 'UYU', CL: 'CLP', AR: 'ARS',
    // Europe
    AT: 'EUR', BE: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR', FR: 'EUR', DE: 'EUR', GR: 'EUR',
    IE: 'EUR', IT: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR',
    SK: 'EUR', SI: 'EUR', ES: 'EUR', HR: 'EUR', BG: 'BGN', CZ: 'CZK', DK: 'DKK', HU: 'HUF',
    PL: 'PLN', RO: 'RON', SE: 'SEK', GB: 'GBP', CH: 'CHF', NO: 'NOK', IS: 'ISK', UA: 'UAH',
    MD: 'MDL', BY: 'BYN', RU: 'RUB', RS: 'RSD', BA: 'BAM', MK: 'MKD', AL: 'ALL', ME: 'EUR',
    XK: 'EUR', LI: 'CHF', MC: 'EUR', SM: 'EUR', VA: 'EUR', AD: 'EUR',
    // Asie
    CN: 'CNY', JP: 'JPY', KR: 'KRW', KP: 'KPW', MN: 'MNT', TW: 'TWD', HK: 'HKD', MO: 'MOP',
    IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', BT: 'BTN', MV: 'MVR', AF: 'AFN',
    IR: 'IRR', IQ: 'IQD', SY: 'SYP', LB: 'LBP', JO: 'JOD', IL: 'ILS', PS: 'ILS', SA: 'SAR',
    YE: 'YER', OM: 'OMR', AE: 'AED', QA: 'QAR', BH: 'BHD', KW: 'KWD', TR: 'TRY', GE: 'GEL',
    AM: 'AMD', AZ: 'AZN', KZ: 'KZT', UZ: 'UZS', TM: 'TMT', TJ: 'TJS', KG: 'KGS', TH: 'THB',
    VN: 'VND', LA: 'LAK', KH: 'KHR', MM: 'MMK', MY: 'MYR', SG: 'SGD', ID: 'IDR', PH: 'PHP',
    BN: 'BND', TL: 'USD',
    // Océanie
    AU: 'AUD', NZ: 'NZD', PG: 'PGK', FJ: 'FJD', SB: 'SBD', VU: 'VUV', WS: 'WST', TO: 'TOP',
    KI: 'AUD', TV: 'AUD', NR: 'AUD', FM: 'USD', MH: 'USD', PW: 'USD'
};

export const KNOWN_CURRENCIES = new Set(Object.values(COUNTRY_CURRENCY));

export const isKnownCountryCode = (value: string): boolean => value in COUNTRY_CURRENCY;
export const isKnownCurrencyCode = (value: string): boolean => KNOWN_CURRENCIES.has(value);
