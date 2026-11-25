import { ISPName } from '../types';

// Comprehensive Nigerian NCC mobile operator prefix registry (estimate subject to MNP)
export const ISP_PREFIXES: Record<ISPName, string[]> = {
  MTN: [
    '07025', '07026', '0703', '0704', '0706', '0707',
    '0803', '0806', '0810', '0813', '0814', '0816',
    '0903', '0906', '0913', '0916',
  ],
  Airtel: [
    '0701', '0708',
    '0802', '0808', '0812',
    '0901', '0902', '0904', '0907', '0911', '0912',
  ],
  Glo: [
    '0705', '0805', '0807', '0811', '0815', '0905', '0915',
  ],
  '9mobile': [
    '0809', '0817', '0818', '0908', '0909',
  ],
};

export const MNP_ESTIMATE_NOTICE =
  'Prefix matching only estimates original line allocation because Nigerian Mobile Number Portability (MNP) lets subscribers switch networks while keeping their number.';

/**
 * Normalizes a Nigerian phone number into standard 11-digit local format (0XXXXXXXXXX)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('234') && cleaned.length >= 13) {
    cleaned = '0' + cleaned.substring(3);
  }
  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

export function formatE164Nigeria(phone: string): string {
  const local = normalizePhoneNumber(phone);
  if (local.length === 11 && local.startsWith('0')) {
    return '+234' + local.substring(1);
  }
  return '';
}

/**
 * Estimates Nigerian carrier by prefix only (returns null if unknown; never defaults to MTN).
 */
export function detectIspFromPhoneNumber(phone: string): ISPName | null {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length < 4 || !normalized.startsWith('0')) {
    return null;
  }

  const prefix5 = normalized.substring(0, 5);
  for (const [isp, prefixes] of Object.entries(ISP_PREFIXES)) {
    if (prefixes.includes(prefix5)) {
      return isp as ISPName;
    }
  }

  const prefix4 = normalized.substring(0, 4);
  for (const [isp, prefixes] of Object.entries(ISP_PREFIXES)) {
    if (prefixes.includes(prefix4)) {
      return isp as ISPName;
    }
  }

  return null;
}

export function validatePhoneNumberForIsp(
  phone: string,
  selectedIsp: ISPName,
  allowMnpOverride = false
): { isValid: boolean; error?: string; detectedIsp?: ISPName; isMnpEstimate: boolean } {
  const normalized = normalizePhoneNumber(phone);

  if (!normalized) {
    return { isValid: false, error: 'Phone number cannot be empty.', isMnpEstimate: true };
  }

  if (!/^0[789][01]\d{8}$/.test(normalized)) {
    return {
      isValid: false,
      error: `Invalid Nigerian mobile number (${normalized.length} digits). Must be 11 digits starting with 070/080/081/090/091 or +234.`,
      isMnpEstimate: true,
    };
  }

  const detected = detectIspFromPhoneNumber(normalized);
  if (!detected) {
    return {
      isValid: false,
      error: 'Phone prefix is not recognized in Nigerian NCC mobile allocations.',
      isMnpEstimate: true,
    };
  }

  if (detected !== selectedIsp && !allowMnpOverride) {
    return {
      isValid: false,
      detectedIsp: detected,
      isMnpEstimate: true,
      error: `Prefix ${normalized.slice(0, 4)} maps to ${detected} (estimate), while ${selectedIsp} is selected. Switch carrier or verify via HLR/SMS OTP if this line was ported via MNP.`,
    };
  }

  return { isValid: true, detectedIsp: detected, isMnpEstimate: true };
}
