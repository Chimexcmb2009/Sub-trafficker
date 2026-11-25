import nodemailer from 'nodemailer';

export type NigerianCarrier = 'MTN' | 'Airtel' | 'Glo' | '9mobile';

const PREFIX_TABLE: Record<NigerianCarrier, string[]> = {
  MTN: [
    '07025', '07026', '0703', '0704', '0706', '0707',
    '0803', '0806', '0810', '0813', '0814', '0816',
    '0903', '0906', '0913', '0916',
  ],
  Airtel: [
    '0701', '0708', '0802', '0808', '0812',
    '0901', '0902', '0904', '0907', '0911', '0912',
  ],
  Glo: [
    '0705', '0805', '0807', '0811', '0815', '0905', '0915',
  ],
  '9mobile': [
    '0809', '0817', '0818', '0908', '0909',
  ],
};

export function normalizeNigerianPhone(raw: string): { valid: boolean; local?: string; e164?: string; error?: string } {
  const digits = (raw || '').replace(/\D/g, '');
  let local = digits;
  if (digits.startsWith('234') && digits.length >= 13) {
    local = '0' + digits.slice(3);
  } else if (digits.length === 10 && !digits.startsWith('0')) {
    local = '0' + digits;
  }

  if (!/^0[789][01]\d{8}$/.test(local)) {
    return {
      valid: false,
      error: 'Enter a valid 11-digit Nigerian mobile number (e.g. 0803..., 0802..., 0805..., 0809..., or +234...).',
    };
  }
  return {
    valid: true,
    local,
    e164: '+234' + local.slice(1),
  };
}

export function estimateCarrierByPrefix(localPhone: string): NigerianCarrier | null {
  const p5 = localPhone.slice(0, 5);
  for (const [carrier, prefixes] of Object.entries(PREFIX_TABLE)) {
    if (prefixes.includes(p5)) return carrier as NigerianCarrier;
  }
  const p4 = localPhone.slice(0, 4);
  for (const [carrier, prefixes] of Object.entries(PREFIX_TABLE)) {
    if (prefixes.includes(p4)) return carrier as NigerianCarrier;
  }
  return null;
}

export async function lookupCarrierWithMnp(localPhone: string, e164Phone: string): Promise<{
  carrier: NigerianCarrier | null;
  method: 'hlr_live' | 'prefix_estimate' | 'unknown';
  provider: string;
  ported?: boolean;
  mnpNotice: string;
}> {
  const prefixEstimate = estimateCarrierByPrefix(localPhone);

  // Attempt live HLR / MNP lookup via Termii Insights if TERMII_API_KEY is configured
  const termiiKey = process.env.TERMII_API_KEY;
  if (termiiKey) {
    try {
      const msisdn = e164Phone.replace(/^\+/, '');
      const url = `https://v3.api.termii.com/api/insight/number/query?api_key=${encodeURIComponent(termiiKey)}&phone_number=${encodeURIComponent(msisdn)}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await resp.json().catch(() => null);
      const item = Array.isArray(data) ? data[0] : data;
      const networkName = String(
        item?.network || item?.operator || item?.network_code || item?.routeDetail?.network || ''
      ).toLowerCase();

      let liveCarrier: NigerianCarrier | null = null;
      if (networkName.includes('mtn')) liveCarrier = 'MTN';
      else if (networkName.includes('airtel')) liveCarrier = 'Airtel';
      else if (networkName.includes('glo')) liveCarrier = 'Glo';
      else if (networkName.includes('9mobile') || networkName.includes('etisalat')) liveCarrier = '9mobile';

      if (liveCarrier) {
        return {
          carrier: liveCarrier,
          method: 'hlr_live',
          provider: 'Termii HLR/MNP Lookup',
          ported: prefixEstimate ? prefixEstimate !== liveCarrier : false,
          mnpNotice: 'Verified against live Nigerian HLR/MNP routing registry.',
        };
      }
    } catch {
      // Fall through cleanly to prefix estimate without fabricating live lookup
    }
  }

  return {
    carrier: prefixEstimate,
    method: prefixEstimate ? 'prefix_estimate' : 'unknown',
    provider: 'NCC Prefix Table (Estimate)',
    mnpNotice:
      'Prefix detection is an estimate only because Nigerian Mobile Number Portability (MNP) allows switching carriers while keeping the same number. Configure TERMII_API_KEY for live HLR verification.',
  };
}

export async function sendRealEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; provider?: string; error?: string }> {
  const from = process.env.EMAIL_FROM || 'Sub Trafficker <no-reply@subtrafficker.app>';
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        return { sent: false, provider: 'Resend', error: errBody?.message || `Email API rejected (${resp.status}).` };
      }
      return { sent: true, provider: 'Resend' };
    } catch (err: any) {
      return { sent: false, provider: 'Resend', error: err.message || 'Email delivery request timed out.' };
    }
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = Number(process.env.SMTP_PORT || 587);

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10000,
      });
      await transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return { sent: true, provider: 'SMTP' };
    } catch (err: any) {
      return { sent: false, provider: 'SMTP', error: err.message || 'SMTP mail delivery failed.' };
    }
  }

  return {
    sent: false,
    error: 'Email delivery provider not configured on server (set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS).',
  };
}

export async function sendRealSms(params: {
  toE164: string;
  message: string;
}): Promise<{ sent: boolean; provider?: string; error?: string }> {
  const termiiKey = process.env.TERMII_API_KEY;
  if (termiiKey) {
    try {
      const resp = await fetch('https://v3.api.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: params.toE164.replace(/^\+/, ''),
          from: process.env.TERMII_SENDER_ID || 'SubTraf',
          sms: params.message,
          type: 'plain',
          channel: 'dnd',
          api_key: termiiKey,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && (data.code === 'ok' || data.message_id)) {
        return { sent: true, provider: 'Termii' };
      }
      return { sent: false, provider: 'Termii', error: data?.message || 'Termii SMS dispatch rejected.' };
    } catch (err: any) {
      return { sent: false, provider: 'Termii', error: err.message || 'Termii SMS request timed out.' };
    }
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const body = new URLSearchParams({
        To: params.toE164,
        From: twilioFrom,
        Body: params.message,
      });
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.sid) {
        return { sent: true, provider: 'Twilio' };
      }
      return { sent: false, provider: 'Twilio', error: data?.message || 'Twilio SMS delivery failed.' };
    } catch (err: any) {
      return { sent: false, provider: 'Twilio', error: err.message || 'Twilio request timed out.' };
    }
  }

  return {
    sent: false,
    error: 'SMS OTP provider not configured on server (set TERMII_API_KEY or TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER).',
  };
}

export async function verifyFaceWithProvider(params: {
  liveSelfieBase64: string;
  referenceImageBase64: string;
}): Promise<{
  status: 'verified' | 'failed' | 'retry_required';
  provider: string;
  confidence?: number;
  reason: string;
}> {
  const cleanLive = params.liveSelfieBase64.replace(/^data:image\/\w+;base64,/, '');
  const cleanRef = params.referenceImageBase64.replace(/^data:image\/\w+;base64,/, '');

  if (!cleanLive || cleanLive.length < 200 || !cleanRef || cleanRef.length < 200) {
    return {
      status: 'retry_required',
      provider: 'validation',
      reason: 'Both a reference identity image and a live captured selfie are required.',
    };
  }

  const preferred = (process.env.FACE_VERIFICATION_PROVIDER || '').toLowerCase();

  // 1. Dojah Selfie-to-Photo Compare (https://api.dojah.io)
  if ((preferred === 'dojah' || !preferred) && process.env.DOJAH_APP_ID && process.env.DOJAH_SECRET_KEY) {
    try {
      const resp = await fetch('https://api.dojah.io/api/v1/kyc/photoid/verify', {
        method: 'POST',
        headers: {
          AppId: process.env.DOJAH_APP_ID,
          Authorization: process.env.DOJAH_SECRET_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selfie_image: cleanLive,
          photoid_image: cleanRef,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json().catch(() => ({}));
      const matchObj = data?.entity?.selfie || data?.entity;
      const confidence = Number(matchObj?.confidence_value ?? matchObj?.confidence ?? 0);
      const matched = Boolean(matchObj?.match) && confidence >= 80;

      if (!resp.ok) {
        return {
          status: 'retry_required',
          provider: 'Dojah KYC',
          reason: data?.error || 'Dojah could not process the submitted images clearly. Retry in better lighting.',
        };
      }
      if (matched) {
        return {
          status: 'verified',
          provider: 'Dojah KYC',
          confidence,
          reason: `Identity face match confirmed (${confidence.toFixed(1)}% confidence).`,
        };
      }
      return {
        status: 'failed',
        provider: 'Dojah KYC',
        confidence,
        reason: `Submitted face did not match reference identity (${confidence.toFixed(1)}% confidence).`,
      };
    } catch (err: any) {
      return {
        status: 'retry_required',
        provider: 'Dojah KYC',
        reason: err.message || 'Face verification gateway timed out.',
      };
    }
  }

  // 2. Face++ Compare API (https://api-us.faceplusplus.com/facepp/v3/compare)
  if ((preferred === 'facepp' || !preferred) && process.env.FACEPP_API_KEY && process.env.FACEPP_API_SECRET) {
    try {
      const form = new URLSearchParams({
        api_key: process.env.FACEPP_API_KEY,
        api_secret: process.env.FACEPP_API_SECRET,
        image_base64_1: cleanLive,
        image_base64_2: cleanRef,
      });
      const resp = await fetch('https://api-us.faceplusplus.com/facepp/v3/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.error_message) {
        return {
          status: 'retry_required',
          provider: 'Face++ Biometrics',
          reason: data.error_message || 'No clear single face detected in one or both frames.',
        };
      }
      const confidence = Number(data.confidence ?? 0);
      const threshold = Number(data?.thresholds?.['1e-4'] ?? 75);
      if (confidence >= Math.max(78, threshold)) {
        return {
          status: 'verified',
          provider: 'Face++ Biometrics',
          confidence,
          reason: `Face match verified (${confidence.toFixed(1)}% similarity).`,
        };
      }
      return {
        status: 'failed',
        provider: 'Face++ Biometrics',
        confidence,
        reason: `Face mismatch (${confidence.toFixed(1)}% < required ${Math.max(78, threshold).toFixed(1)}%).`,
      };
    } catch (err: any) {
      return {
        status: 'retry_required',
        provider: 'Face++ Biometrics',
        reason: err.message || 'Face verification service timed out.',
      };
    }
  }

  return {
    status: 'retry_required',
    provider: 'unconfigured',
    reason:
      'Identity verification provider is not configured on this server (set DOJAH_APP_ID + DOJAH_SECRET_KEY or FACEPP_API_KEY + FACEPP_API_SECRET). Camera verification never auto-approves locally.',
  };
}

async function getMonnifyAccessToken(): Promise<string | null> {
  const apiKey = process.env.MONNIFY_API_KEY;
  const secretKey = process.env.MONNIFY_SECRET_KEY;
  if (!apiKey || !secretKey) return null;
  const resp = await fetch('https://api.monnify.com/api/v1/auth/login', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`,
    },
    signal: AbortSignal.timeout(8000),
  });
  const data = await resp.json().catch(() => ({}));
  return resp.ok && data?.responseBody?.accessToken ? data.responseBody.accessToken : null;
}

export async function resolveNigerianBankAccount(params: {
  accountNumber: string;
  bankCode: string;
}): Promise<{ ok: boolean; statusCode: number; accountName?: string; provider?: string; message: string }> {
  const { accountNumber, bankCode } = params;
  if (!/^\d{10}$/.test(accountNumber)) {
    return { ok: false, statusCode: 400, message: 'Enter a valid 10-digit NUBAN account number.' };
  }
  if (!bankCode) {
    return { ok: false, statusCode: 400, message: 'Select a valid Nigerian bank.' };
  }

  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  const flutterwaveKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const hasMonnify = !!(process.env.MONNIFY_API_KEY && process.env.MONNIFY_SECRET_KEY);

  if (!paystackKey && !flutterwaveKey && !hasMonnify) {
    return {
      ok: false,
      statusCode: 503,
      message:
        'Nigerian bank resolution provider not configured (set PAYSTACK_SECRET_KEY, FLUTTERWAVE_SECRET_KEY, or MONNIFY_API_KEY + MONNIFY_SECRET_KEY).',
    };
  }

  // 1. Paystack Account Resolution
  if (paystackKey) {
    try {
      const resp = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${paystackKey}` },
          signal: AbortSignal.timeout(10000),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.status && data.data?.account_name) {
        return {
          ok: true,
          statusCode: 200,
          accountName: data.data.account_name,
          provider: 'Paystack',
          message: 'Account holder name resolved via Paystack.',
        };
      }
      if (!flutterwaveKey && !hasMonnify) {
        return {
          ok: false,
          statusCode: resp.status === 401 ? 502 : 400,
          provider: 'Paystack',
          message: data?.message || 'Paystack could not verify this NUBAN account number.',
        };
      }
    } catch (err: any) {
      if (!flutterwaveKey && !hasMonnify) {
        return { ok: false, statusCode: 504, provider: 'Paystack', message: err.message || 'Paystack request timed out.' };
      }
    }
  }

  // 2. Flutterwave Account Resolution
  if (flutterwaveKey) {
    try {
      const resp = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flutterwaveKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.status === 'success' && data.data?.account_name) {
        return {
          ok: true,
          statusCode: 200,
          accountName: data.data.account_name,
          provider: 'Flutterwave',
          message: 'Account holder name resolved via Flutterwave.',
        };
      }
      if (!hasMonnify) {
        return {
          ok: false,
          statusCode: resp.status === 401 ? 502 : 400,
          provider: 'Flutterwave',
          message: data?.message || 'Flutterwave could not verify this bank account.',
        };
      }
    } catch (err: any) {
      if (!hasMonnify) {
        return { ok: false, statusCode: 504, provider: 'Flutterwave', message: err.message || 'Flutterwave request timed out.' };
      }
    }
  }

  // 3. Monnify Account Validation
  if (hasMonnify) {
    try {
      const token = await getMonnifyAccessToken();
      if (!token) {
        return { ok: false, statusCode: 502, provider: 'Monnify', message: 'Monnify authentication failed.' };
      }
      const resp = await fetch(
        `https://api.monnify.com/api/v1/disbursements/account/validate?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.requestSuccessful && data.responseBody?.accountName) {
        return {
          ok: true,
          statusCode: 200,
          accountName: data.responseBody.accountName,
          provider: 'Monnify',
          message: 'Account holder name resolved via Monnify.',
        };
      }
      return {
        ok: false,
        statusCode: 400,
        provider: 'Monnify',
        message: data?.responseMessage || 'Monnify could not resolve this bank account.',
      };
    } catch (err: any) {
      return { ok: false, statusCode: 504, provider: 'Monnify', message: err.message || 'Monnify request timed out.' };
    }
  }

  return { ok: false, statusCode: 502, message: 'Unable to resolve bank account with configured providers.' };
}

export async function initiateNigerianBankTransfer(params: {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  amountNgn: number;
  reference: string;
  narration: string;
}): Promise<{ ok: boolean; statusCode: number; provider?: string; gatewayRef?: string; message: string }> {
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  const flutterwaveKey = process.env.FLUTTERWAVE_SECRET_KEY;

  if (paystackKey) {
    try {
      // Step 1: Create Transfer Recipient
      const recResp = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'nuban',
          name: params.accountName,
          account_number: params.accountNumber,
          bank_code: params.bankCode,
          currency: 'NGN',
        }),
        signal: AbortSignal.timeout(10000),
      });
      const recData = await recResp.json().catch(() => ({}));
      if (!recResp.ok || !recData.data?.recipient_code) {
        return {
          ok: false,
          statusCode: 400,
          provider: 'Paystack',
          message: recData?.message || 'Paystack recipient creation failed.',
        };
      }

      // Step 2: Initiate Transfer (Paystack amounts are in kobo)
      const txResp = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: Math.round(params.amountNgn * 100),
          recipient: recData.data.recipient_code,
          reason: params.narration,
          reference: params.reference,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const txData = await txResp.json().catch(() => ({}));
      if (txResp.ok && txData.status) {
        return {
          ok: true,
          statusCode: 200,
          provider: 'Paystack',
          gatewayRef: txData.data?.transfer_code || params.reference,
          message: 'Transfer initiated successfully via Paystack.',
        };
      }
      return {
        ok: false,
        statusCode: 400,
        provider: 'Paystack',
        message: txData?.message || 'Paystack declined the payout transfer.',
      };
    } catch (err: any) {
      return { ok: false, statusCode: 504, provider: 'Paystack', message: err.message || 'Paystack transfer timed out.' };
    }
  }

  if (flutterwaveKey) {
    try {
      const resp = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flutterwaveKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_bank: params.bankCode,
          account_number: params.accountNumber,
          amount: params.amountNgn,
          narration: params.narration,
          currency: 'NGN',
          reference: params.reference,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.status === 'success') {
        return {
          ok: true,
          statusCode: 200,
          provider: 'Flutterwave',
          gatewayRef: String(data.data?.id || params.reference),
          message: 'Transfer initiated successfully via Flutterwave.',
        };
      }
      return {
        ok: false,
        statusCode: 400,
        provider: 'Flutterwave',
        message: data?.message || 'Flutterwave transfer failed.',
      };
    } catch (err: any) {
      return { ok: false, statusCode: 504, provider: 'Flutterwave', message: err.message || 'Flutterwave transfer timed out.' };
    }
  }

  return {
    ok: false,
    statusCode: 503,
    message: 'No live Nigerian payout provider configured (set PAYSTACK_SECRET_KEY or FLUTTERWAVE_SECRET_KEY).',
  };
}
