/**
 * WebAuthn / Passkey & Native Hardware Biometrics Helper
 */

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    return false;
  }
}

/**
 * Register a new Passkey / Device Biometric Credential via native OS Prompt
 */
export async function registerPasskey(email: string, name: string): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: 'WebAuthn hardware biometrics is not supported on this browser.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode(email || 'sub_trafficker_user');

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Sub Trafficker Biometric Guard',
        id: window.location.hostname
      },
      user: {
        id: userIdBytes,
        name: email || 'user@subtrafficker.com',
        displayName: name || 'Sub Trafficker User'
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Triggers Touch ID, Face ID, Windows Hello, Android Biometric
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    }) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'Biometric registration canceled by user.' };
    }

    const credId = credential.id;
    return { success: true, credentialId: credId };
  } catch (err: any) {
    console.warn('WebAuthn Passkey Registration Error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Device biometric prompt was canceled or timed out.' };
    }
    if (err.name === 'InvalidStateError') {
      return { success: false, error: 'A passkey credential already exists for this device.' };
    }
    return { success: false, error: err.message || 'Failed to complete WebAuthn biometric prompt.' };
  }
}

/**
 * Authenticate using registered Passkey / Hardware Biometrics
 */
export async function authenticatePasskey(): Promise<{ success: boolean; credentialId?: string; error?: string }> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: 'WebAuthn hardware biometrics is not supported on this browser.' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname,
      userVerification: 'required',
      timeout: 60000
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    }) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, error: 'Biometric verification canceled.' };
    }

    return { success: true, credentialId: assertion.id };
  } catch (err: any) {
    console.warn('WebAuthn Passkey Authentication Error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric verification prompt was canceled or rejected by user.' };
    }
    return { success: false, error: err.message || 'Biometric authentication failed.' };
  }
}
