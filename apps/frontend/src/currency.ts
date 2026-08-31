/**
 * ISO 3166-1 alpha-2 country code -> ISO 4217 alpha-3 currency code. Kept in sync by hand with
 * apps/backend/src/currency.ts (same object, no shared package between the two workspaces — see
 * types.ts for the existing precedent of manually mirroring shapes). See that file's comment for
 * the rationale on simplified dollarized/pegged territories.
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

/** Best-fit BCP-47 locale per currency, so amounts render with that currency's own conventions
 * (e.g. USD as "$1,250.00", EUR as "1 250,00 €") rather than always in French formatting. Covers
 * the currencies most likely to be used by a self-hosted school; anything else falls back to the
 * viewer's own browser locale via `formatCurrency`, which still produces a correct — just not
 * necessarily idiomatic — result (Intl.NumberFormat always knows how to format any valid ISO 4217
 * code, it just may not pick that currency's "home" grouping/symbol placement without a hint). */
const CURRENCY_LOCALE: Record<string, string> = {
    MAD: 'fr-MA', DZD: 'fr-DZ', TND: 'fr-TN', EUR: 'fr-FR', USD: 'en-US', GBP: 'en-GB',
    CAD: 'fr-CA', CHF: 'fr-CH', XOF: 'fr-SN', XAF: 'fr-CM', EGP: 'ar-EG', SAR: 'ar-SA',
    AED: 'ar-AE', CNY: 'zh-CN', JPY: 'ja-JP', INR: 'en-IN', NGN: 'en-NG', GHS: 'en-GH',
    KES: 'en-KE', ZAR: 'en-ZA', BRL: 'pt-BR', MXN: 'es-MX', RUB: 'ru-RU', TRY: 'tr-TR'
};

/**
 * Formats an amount for display in the given currency, using that currency's own idiomatic
 * grouping/decimal separators and symbol placement (see CURRENCY_LOCALE) rather than a fixed
 * locale — this is the ONLY place in the app that should turn a number into money text; never
 * concatenate a literal "DH"/"€"/"$" anywhere else.
 */
export const formatCurrency = (amount: number | string, currencyCode: string): string => {
    const value = typeof amount === 'string' ? Number(amount) : amount;
    const code = currencyCode || 'MAD';
    try {
        return new Intl.NumberFormat(CURRENCY_LOCALE[code], { style: 'currency', currency: code }).format(value);
    } catch {
        // Unrecognized/malformed currency code (e.g. corrupted data) — never let a formatting
        // failure crash a page; fall back to a plain number with the raw code appended.
        return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`;
    }
};

const countryName = (code: string): string => {
    try { return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) ?? code; } catch { return code; }
};
const currencyName = (code: string): string => {
    try { return new Intl.DisplayNames(['fr'], { type: 'currency' }).of(code) ?? code; } catch { return code; }
};

export type CodeOption = { value: string; label: string };

/** All selectable countries, sorted by their French display name, for the Pays <select>. */
export const countryOptions = (): CodeOption[] => Object.keys(COUNTRY_CURRENCY)
    .map((code) => ({ value: code, label: countryName(code) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

/** Every distinct currency in use across COUNTRY_CURRENCY, sorted by name, for the Devise <select>. */
export const currencyOptions = (): CodeOption[] => [...new Set(Object.values(COUNTRY_CURRENCY))]
    .map((code) => ({ value: code, label: `${currencyName(code)} (${code})` }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

/**
 * Best-effort IANA timezone -> ISO country code, for prefilling the Pays field at registration
 * from `Intl.DateTimeFormat().resolvedOptions().timeZone` — entirely client-side, no network call,
 * no external service (see the currency feature discussion: no paid/fragile geo-IP API). Not
 * exhaustive against the full IANA tz database — covers the timezone of essentially every country
 * in COUNTRY_CURRENCY plus the handful of extra zones large multi-zone countries commonly resolve
 * to. An unmatched timezone simply leaves Pays unset, requiring the user to pick it themselves —
 * detection is a convenience, never a requirement (see priority: choix utilisateur > suggestion > manuel).
 */
const TIMEZONE_COUNTRY: Record<string, string> = {
    // Afrique
    'Africa/Algiers': 'DZ', 'Africa/Luanda': 'AO', 'Africa/Porto-Novo': 'BJ', 'Africa/Gaborone': 'BW',
    'Africa/Ouagadougou': 'BF', 'Africa/Bujumbura': 'BI', 'Atlantic/Cape_Verde': 'CV', 'Africa/Douala': 'CM',
    'Africa/Bangui': 'CF', 'Africa/Ndjamena': 'TD', 'Indian/Comoro': 'KM', 'Africa/Brazzaville': 'CG',
    'Africa/Kinshasa': 'CD', 'Africa/Lubumbashi': 'CD', 'Africa/Abidjan': 'CI', 'Africa/Djibouti': 'DJ',
    'Africa/Cairo': 'EG', 'Africa/Malabo': 'GQ', 'Africa/Asmara': 'ER', 'Africa/Mbabane': 'SZ',
    'Africa/Addis_Ababa': 'ET', 'Africa/Libreville': 'GA', 'Africa/Banjul': 'GM', 'Africa/Accra': 'GH',
    'Africa/Conakry': 'GN', 'Africa/Bissau': 'GW', 'Africa/Nairobi': 'KE', 'Africa/Maseru': 'LS',
    'Africa/Monrovia': 'LR', 'Africa/Tripoli': 'LY', 'Indian/Antananarivo': 'MG', 'Africa/Blantyre': 'MW',
    'Africa/Bamako': 'ML', 'Africa/Nouakchott': 'MR', 'Indian/Mauritius': 'MU', 'Africa/Casablanca': 'MA',
    'Africa/El_Aaiun': 'EH', 'Africa/Maputo': 'MZ', 'Africa/Windhoek': 'NA', 'Africa/Niamey': 'NE',
    'Africa/Lagos': 'NG', 'Africa/Kigali': 'RW', 'Africa/Sao_Tome': 'ST', 'Africa/Dakar': 'SN',
    'Indian/Mahe': 'SC', 'Africa/Freetown': 'SL', 'Africa/Mogadishu': 'SO', 'Africa/Johannesburg': 'ZA',
    'Africa/Juba': 'SS', 'Africa/Khartoum': 'SD', 'Africa/Dar_es_Salaam': 'TZ', 'Africa/Lome': 'TG',
    'Africa/Tunis': 'TN', 'Africa/Kampala': 'UG', 'Africa/Lusaka': 'ZM', 'Africa/Harare': 'ZW',
    // Amériques
    'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
    'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
    'America/Winnipeg': 'CA', 'America/Edmonton': 'CA', 'America/Halifax': 'CA', 'America/St_Johns': 'CA',
    'America/Mexico_City': 'MX', 'America/Tijuana': 'MX', 'America/Cancun': 'MX', 'America/Guatemala': 'GT',
    'America/Belize': 'BZ', 'America/El_Salvador': 'SV', 'America/Tegucigalpa': 'HN', 'America/Managua': 'NI',
    'America/Costa_Rica': 'CR', 'America/Panama': 'PA', 'America/Havana': 'CU', 'America/Santo_Domingo': 'DO',
    'America/Port-au-Prince': 'HT', 'America/Jamaica': 'JM', 'America/Port_of_Spain': 'TT', 'America/Nassau': 'BS',
    'America/Barbados': 'BB', 'America/Grenada': 'GD', 'America/St_Lucia': 'LC', 'America/St_Vincent': 'VC',
    'America/Antigua': 'AG', 'America/St_Kitts': 'KN', 'America/Dominica': 'DM', 'America/Bogota': 'CO',
    'America/Caracas': 'VE', 'America/Guyana': 'GY', 'America/Paramaribo': 'SR', 'America/Guayaquil': 'EC',
    'Pacific/Galapagos': 'EC', 'America/Lima': 'PE', 'America/Sao_Paulo': 'BR', 'America/Manaus': 'BR',
    'America/Bahia': 'BR', 'America/La_Paz': 'BO', 'America/Asuncion': 'PY', 'America/Montevideo': 'UY',
    'America/Santiago': 'CL', 'Pacific/Easter': 'CL', 'America/Argentina/Buenos_Aires': 'AR',
    // Europe
    'Europe/Vienna': 'AT', 'Europe/Brussels': 'BE', 'Asia/Nicosia': 'CY', 'Europe/Tallinn': 'EE',
    'Europe/Helsinki': 'FI', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Athens': 'GR',
    'Europe/Dublin': 'IE', 'Europe/Rome': 'IT', 'Europe/Riga': 'LV', 'Europe/Vilnius': 'LT',
    'Europe/Luxembourg': 'LU', 'Europe/Malta': 'MT', 'Europe/Amsterdam': 'NL', 'Europe/Lisbon': 'PT',
    'Atlantic/Madeira': 'PT', 'Atlantic/Azores': 'PT', 'Europe/Bratislava': 'SK', 'Europe/Ljubljana': 'SI',
    'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES', 'Europe/Zagreb': 'HR', 'Europe/Sofia': 'BG',
    'Europe/Prague': 'CZ', 'Europe/Copenhagen': 'DK', 'Europe/Budapest': 'HU', 'Europe/Warsaw': 'PL',
    'Europe/Bucharest': 'RO', 'Europe/Stockholm': 'SE', 'Europe/London': 'GB', 'Europe/Zurich': 'CH',
    'Europe/Oslo': 'NO', 'Atlantic/Reykjavik': 'IS', 'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA',
    'Europe/Chisinau': 'MD', 'Europe/Minsk': 'BY', 'Europe/Moscow': 'RU', 'Europe/Kaliningrad': 'RU',
    'Asia/Yekaterinburg': 'RU', 'Asia/Novosibirsk': 'RU', 'Asia/Vladivostok': 'RU', 'Europe/Belgrade': 'RS',
    'Europe/Sarajevo': 'BA', 'Europe/Skopje': 'MK', 'Europe/Tirane': 'AL', 'Europe/Podgorica': 'ME',
    'Europe/Vaduz': 'LI', 'Europe/Monaco': 'MC', 'Europe/San_Marino': 'SM', 'Europe/Vatican': 'VA',
    'Europe/Andorra': 'AD',
    // Asie
    'Asia/Shanghai': 'CN', 'Asia/Urumqi': 'CN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Pyongyang': 'KP',
    'Asia/Ulaanbaatar': 'MN', 'Asia/Taipei': 'TW', 'Asia/Hong_Kong': 'HK', 'Asia/Macau': 'MO',
    'Asia/Kolkata': 'IN', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK',
    'Asia/Kathmandu': 'NP', 'Asia/Thimphu': 'BT', 'Indian/Maldives': 'MV', 'Asia/Kabul': 'AF',
    'Asia/Tehran': 'IR', 'Asia/Baghdad': 'IQ', 'Asia/Damascus': 'SY', 'Asia/Beirut': 'LB',
    'Asia/Amman': 'JO', 'Asia/Jerusalem': 'IL', 'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS',
    'Asia/Riyadh': 'SA', 'Asia/Aden': 'YE', 'Asia/Muscat': 'OM', 'Asia/Dubai': 'AE',
    'Asia/Qatar': 'QA', 'Asia/Bahrain': 'BH', 'Asia/Kuwait': 'KW', 'Europe/Istanbul': 'TR',
    'Asia/Tbilisi': 'GE', 'Asia/Yerevan': 'AM', 'Asia/Baku': 'AZ', 'Asia/Almaty': 'KZ',
    'Asia/Aqtobe': 'KZ', 'Asia/Tashkent': 'UZ', 'Asia/Ashgabat': 'TM', 'Asia/Dushanbe': 'TJ',
    'Asia/Bishkek': 'KG', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Vientiane': 'LA',
    'Asia/Phnom_Penh': 'KH', 'Asia/Yangon': 'MM', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Singapore': 'SG',
    'Asia/Jakarta': 'ID', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID', 'Asia/Manila': 'PH',
    'Asia/Brunei': 'BN', 'Asia/Dili': 'TL',
    // Océanie
    'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU',
    'Australia/Adelaide': 'AU', 'Australia/Darwin': 'AU', 'Pacific/Auckland': 'NZ', 'Pacific/Port_Moresby': 'PG',
    'Pacific/Fiji': 'FJ', 'Pacific/Guadalcanal': 'SB', 'Pacific/Efate': 'VU', 'Pacific/Apia': 'WS',
    'Pacific/Tongatapu': 'TO', 'Pacific/Tarawa': 'KI', 'Pacific/Funafuti': 'TV', 'Pacific/Nauru': 'NR',
    'Pacific/Chuuk': 'FM', 'Pacific/Majuro': 'MH', 'Pacific/Palau': 'PW'
};

/** Reads the browser's resolved IANA timezone and maps it to a country, or `null` if unmatched. */
export const detectCountryFromTimezone = (): string | null => {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return TIMEZONE_COUNTRY[zone] ?? null;
    } catch {
        return null;
    }
};
