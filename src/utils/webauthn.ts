import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { apiRequest } from '../lib/apiClient';

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential);
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerPasskey(deviceName?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: 'WebAuthn passkeys are not supported in this browser.' };
  }

  try {
    const optRes = await apiRequest<{ challengeId: string; options: any }>('/api/webauthn/register/options', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!optRes.ok || !optRes.data?.options) {
      return { success: false, error: optRes.data?.message || 'Unable to initialize passkey registration.' };
    }

    const attResp = await startRegistration({ optionsJSON: optRes.data.options });

    const verifyRes = await apiRequest('/api/webauthn/register/verify', {
      method: 'POST',
      body: JSON.stringify({
        challengeId: optRes.data.challengeId,
        credential: attResp,
        deviceName: deviceName || navigator.platform || 'Platform Authenticator',
      }),
    });

    if (!verifyRes.ok || !verifyRes.data?.status) {
      return { success: false, error: verifyRes.data?.message || 'Server rejected passkey attestation.' };
    }

    return { success: true };
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric / passkey prompt was canceled or blocked by this frame.' };
    }
    if (err?.name === 'InvalidStateError') {
      return { success: false, error: 'This authenticator already has a registered passkey for this account.' };
    }
    return { success: false, error: err?.message || 'Passkey registration failed.' };
  }
}

export async function authenticatePasskey(email?: string): Promise<{
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
}> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: 'WebAuthn passkeys are not supported in this browser.' };
  }

  try {
    const optRes = await apiRequest<{ challengeId: string; options: any }>('/api/webauthn/login/options', {
      method: 'POST',
      body: JSON.stringify({ email: email?.trim() || undefined }),
    });

    if (!optRes.ok || !optRes.data?.options) {
      return { success: false, error: optRes.data?.message || 'Could not start passkey sign-in.' };
    }

    const asseResp = await startAuthentication({ optionsJSON: optRes.data.options });

    const verifyRes = await apiRequest<{ token: string; user: any }>('/api/webauthn/login/verify', {
      method: 'POST',
      body: JSON.stringify({
        challengeId: optRes.data.challengeId,
        credential: asseResp,
      }),
    });

    if (!verifyRes.ok || !verifyRes.data?.status) {
      return { success: false, error: verifyRes.data?.message || 'Passkey verification failed.' };
    }

    return {
      success: true,
      token: verifyRes.data.token,
      user: verifyRes.data.user,
    };
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric prompt was canceled or timed out.' };
    }
    return { success: false, error: err?.message || 'Passkey sign-in failed.' };
  }
}
