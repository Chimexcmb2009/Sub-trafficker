import { ISPName } from '../types';

// Map of Nigerian ISP prefixes
export const ISP_PREFIXES: Record<ISPName, string[]> = {
  MTN: [
    '0803', '0806', '0810', '0813', '0814', '0816', 
    '0903', '0906', '0913', '0916', '0703', '0706', 
    '07025', '07026', '0704', '0707'
  ],
  Airtel: [
    '0802', '0808', '0812', '0701', '0708', 
    '0901', '0902', '0904', '0907', '0912', '0911'
  ],
  Glo: [
    '0805', '0807', '0811', '0815', '0705', '0905', '0915'
  ],
  '9mobile': [
    '0809', '0817', '0818', '0909', '0908'
  ]
};

/**
 * Normalizes a phone number to standard 11-digit Nigerian format (starting with 0)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters (including + etc)
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 234, replace with 0
  if (cleaned.startsWith('234')) {
    cleaned = '0' + cleaned.substring(3);
  }
  
  // If it's 10 digits and doesn't start with 0, prefix with 0 (e.g. 7073477520 -> 07073477520)
  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  
  return cleaned;
}

/**
 * Detects the ISP/Carrier name based on the phone number prefix.
 */
export function detectIspFromPhoneNumber(phone: string): ISPName | null {
  const normalized = normalizePhoneNumber(phone);
  
  if (normalized.length < 4 || !normalized.startsWith('0')) {
    return null;
  }

  // Check 5-digit prefixes first (e.g. 07025)
  const prefix5 = normalized.substring(0, 5);
  for (const [isp, prefixes] of Object.entries(ISP_PREFIXES)) {
    if (prefixes.includes(prefix5)) {
      return isp as ISPName;
    }
  }

  // Check 4-digit prefixes
  const prefix4 = normalized.substring(0, 4);
  for (const [isp, prefixes] of Object.entries(ISP_PREFIXES)) {
    if (prefixes.includes(prefix4)) {
      return isp as ISPName;
    }
  }

  return null;
}

/**
 * Validates a phone number for length, formatting, and carrier compatibility.
 */
export function validatePhoneNumberForIsp(
  phone: string, 
  selectedIsp: ISPName
): { isValid: boolean; error?: string; detectedIsp?: ISPName } {
  const normalized = normalizePhoneNumber(phone);
  
  if (!normalized || normalized.length === 0) {
    return { isValid: false, error: 'Phone number cannot be empty.' };
  }
  
  if (normalized.length !== 11) {
    return { 
      isValid: false, 
      error: `Invalid Nigerian phone number. A standard mobile number must be exactly 11 digits (entered ${normalized.length} digits).` 
    };
  }
  
  if (!normalized.startsWith('0')) {
    return { isValid: false, error: 'Invalid Nigerian phone number format. Must start with 0 or +234.' };
  }

  const detected = detectIspFromPhoneNumber(normalized);
  
  if (!detected) {
    return { 
      isValid: false, 
      error: 'The phone number prefix is not recognized as a valid Nigerian mobile operator line.' 
    };
  }
  
  if (detected !== selectedIsp) {
    return { 
      isValid: false, 
      detectedIsp: detected,
      error: `The phone number entered (${normalized}) belongs to ${detected} Nigeria, but you have selected ${selectedIsp} as the operator. Please switch the selected network carrier to match.` 
    };
  }
  
  return { isValid: true, detectedIsp: detected };
}
