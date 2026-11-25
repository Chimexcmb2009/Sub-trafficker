import { ISPName } from '../types';
import { apiRequest } from '../lib/apiClient';
import { detectIspFromPhoneNumber, MNP_ESTIMATE_NOTICE, normalizePhoneNumber } from './phoneValidator';

export interface CarrierLookupResult {
  carrier: ISPName | null;
  method: 'hlr_live' | 'prefix_estimate' | 'ip_isp' | 'unknown';
  provider: string;
  ported?: boolean;
  mnpNotice: string;
  normalizedLocal?: string;
  normalizedE164?: string;
}

/**
 * Performs backend phone carrier resolution (Termii HLR/MNP lookup + NCC prefix fallback).
 * Never defaults unknown numbers to MTN.
 */
export async function lookupPhoneCarrier(phone: string): Promise<CarrierLookupResult> {
  const normalized = normalizePhoneNumber(phone);
  try {
    const res = await apiRequest<CarrierLookupResult>('/api/phone/detect', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    if (res.ok && res.data.status) {
      return {
        carrier: res.data.carrier ?? null,
        method: res.data.method || 'prefix_estimate',
        provider: res.data.provider || 'Backend Carrier Resolver',
        ported: Boolean(res.data.ported),
        mnpNotice: res.data.mnpNotice || MNP_ESTIMATE_NOTICE,
        normalizedLocal: res.data.normalizedLocal || normalized,
        normalizedE164: res.data.normalizedE164,
      };
    }
  } catch {
    // Fallback to deterministic local prefix estimate only if backend unreachable
  }

  const localGuess = detectIspFromPhoneNumber(normalized);
  return {
    carrier: localGuess,
    method: localGuess ? 'prefix_estimate' : 'unknown',
    provider: 'Local NCC Prefix Table (Estimate)',
    mnpNotice: MNP_ESTIMATE_NOTICE,
    normalizedLocal: normalized,
  };
}

/**
 * Queries IP ISP only as an explicit user-triggered hint; returns null on WiFi/broadband
 * instead of falsely defaulting every connection to MTN.
 */
export async function detectCarrierRealTime(): Promise<ISPName | null> {
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.connection) {
        const ispText = String(data.connection.isp || data.connection.org || '').toLowerCase();
        if (ispText.includes('mtn')) return 'MTN';
        if (ispText.includes('airtel')) return 'Airtel';
        if (ispText.includes('glo') || ispText.includes('globacom')) return 'Glo';
        if (ispText.includes('9mobile') || ispText.includes('etisalat')) return '9mobile';
      }
    }
  } catch {
    // Do not fabricate a carrier on failure
  }
  return null;
}
