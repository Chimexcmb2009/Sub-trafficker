import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransport,
} from '@simplewebauthn/server';
import { sqlite } from './server/db';
import {
  AuthenticatedRequest,
  generateNumericOtp,
  getAdminEmail,
  hashOtp,
  hashPassword,
  requireAdmin,
  requireAuth,
  signSessionToken,
  verifyFirebaseIdToken,
  verifyOtpHash,
  verifyPassword,
} from './server/security';
import {
  initiateNigerianBankTransfer,
  lookupCarrierWithMnp,
  normalizeNigerianPhone,
  resolveNigerianBankAccount,
  sendRealEmail,
  sendRealSms,
  verifyFaceWithProvider,
} from './server/providers';

dotenv.config();

const app = express();
app.use(express.json({ limit: '8mb' }));

const PORT = 3000;

// Lazy Gemini client
let aiClient: GoogleGenAI | null = null;
const getAiClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiClient;
};

function resolveRpContext(req: express.Request) {
  const originHeader = req.get('origin') || '';
  let parsedOriginHostname = '';
  if (originHeader) {
    try {
      parsedOriginHostname = new URL(originHeader).hostname;
    } catch {
      parsedOriginHostname = '';
    }
  }
  const hostHeader = (req.get('x-forwarded-host') || req.get('host') || 'localhost').split(':')[0];
  const rpID = process.env.WEBAUTHN_RP_ID || parsedOriginHostname || hostHeader || 'localhost';
  const rpName = process.env.WEBAUTHN_RP_NAME || 'Sub Trafficker';
  const expectedOrigins = [
    process.env.WEBAUTHN_ORIGIN,
    originHeader,
    `${req.protocol}://${req.get('host')}`,
    'http://localhost:3000',
    'https://localhost:3000',
  ].filter((v): v is string => Boolean(v));

  return { rpID, rpName, expectedOrigins: Array.from(new Set(expectedOrigins)) };
}

function formatUserRow(row: any) {
  if (!row) return null;
  const passkeyCountRow = sqlite
    .prepare('SELECT COUNT(*) as cnt FROM webauthn_credentials WHERE user_id = ?')
    .get(row.id) as { cnt: number };
  return {
    uid: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    isp: row.isp || '',
    role: row.email.toLowerCase() === getAdminEmail() || row.role === 'admin' ? 'admin' : 'user',
    emailVerified: Boolean(row.email_verified),
    phoneVerified: Boolean(row.phone_verified),
    phoneCarrierVerified: Boolean(row.phone_carrier_verified),
    faceStatus: row.face_status as 'pending' | 'processing' | 'verified' | 'failed' | 'retry_required',
    faceProvider: row.face_provider || '',
    faceConfidence: row.face_confidence ?? null,
    faceReason: row.face_reason || '',
    bankVerified: Boolean(row.bank_verified),
    bankConfirmed: Boolean(row.bank_confirmed),
    bankDetails: {
      bankCode: row.bank_code || '',
      bankName: row.bank_name || '',
      accountNumber: row.account_number || '',
      accountName: row.account_name || '',
    },
    passkeyCount: passkeyCountRow?.cnt || 0,
    cashBalanceNgn: Number(row.cash_balance_ngn || 0),
    airtimeBalanceNgn: Number(row.airtime_balance_ngn || 0),
  };
}

function getOrCreateUserRecord(params: { id?: string; email: string; name?: string; emailVerified?: boolean }) {
  const email = params.email.toLowerCase().trim();
  let existing = sqlite.prepare('SELECT * FROM users_auth WHERE email = ?').get(email) as any;
  const now = new Date().toISOString();
  const isOwner = email === getAdminEmail();

  if (!existing) {
    const id = params.id || `usr_${crypto.randomUUID()}`;
    sqlite
      .prepare(
        `INSERT INTO users_auth (id, email, name, email_verified, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, email, params.name || email.split('@')[0], params.emailVerified ? 1 : 0, isOwner ? 'admin' : 'user', now, now);
    existing = sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(id);
  } else if (params.emailVerified && !existing.email_verified) {
    sqlite.prepare('UPDATE users_auth SET email_verified = 1, updated_at = ? WHERE id = ?').run(now, existing.id);
    existing = sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(existing.id);
  }
  return existing;
}

// ============================================================================
// 1. CONFIGURATION & HEALTH STATUS (Never returns secret values)
// ============================================================================
app.get('/api/config-check', (_req, res) => {
  res.json({
    paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
    flutterwaveConfigured: Boolean(process.env.FLUTTERWAVE_SECRET_KEY),
    monnifyConfigured: Boolean(process.env.MONNIFY_API_KEY && process.env.MONNIFY_SECRET_KEY),
    bankProviderConfigured: Boolean(
      process.env.PAYSTACK_SECRET_KEY ||
        process.env.FLUTTERWAVE_SECRET_KEY ||
        (process.env.MONNIFY_API_KEY && process.env.MONNIFY_SECRET_KEY)
    ),
    emailProviderConfigured: Boolean(
      process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    ),
    smsProviderConfigured: Boolean(
      process.env.TERMII_API_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)
    ),
    faceProviderConfigured: Boolean(
      (process.env.DOJAH_APP_ID && process.env.DOJAH_SECRET_KEY) ||
        (process.env.FACEPP_API_KEY && process.env.FACEPP_API_SECRET)
    ),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// ============================================================================
// 2. AUTHENTICATION & REAL EMAIL VERIFICATION (ZERO CODE EXPOSURE)
// ============================================================================
async function issueEmailOtp(email: string, purpose: 'verify' | 'reset'): Promise<{ ok: boolean; statusCode: number; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const nowMs = Date.now();

  // Rate limit: 60s cooldown between resends for same email & purpose
  const recent = sqlite
    .prepare('SELECT created_at FROM email_otps WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1')
    .get(normalizedEmail, purpose) as { created_at: number } | undefined;

  if (recent && nowMs - recent.created_at < 60_000) {
    const waitSec = Math.ceil((60_000 - (nowMs - recent.created_at)) / 1000);
    return {
      ok: false,
      statusCode: 429,
      message: `Please wait ${waitSec}s before requesting another verification email.`,
    };
  }

  // Invalidate any prior unused codes for this email/purpose
  sqlite.prepare('UPDATE email_otps SET used = 1 WHERE email = ? AND purpose = ? AND used = 0').run(normalizedEmail, purpose);

  const code = generateNumericOtp(6);
  const expiresAt = nowMs + 10 * 60 * 1000; // 10 minutes
  const otpId = crypto.randomUUID();
  const codeHash = hashOtp(code, `email:${purpose}:${normalizedEmail}`);

  const subject =
    purpose === 'reset' ? 'Sub Trafficker — Password Reset Code' : 'Sub Trafficker — Verify Your Email Address';
  const text = `Your Sub Trafficker ${purpose === 'reset' ? 'password reset' : 'email verification'} code is: ${code}. This code expires in 10 minutes and can only be used once. Do not share it with anyone.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0f172a;color:#f8fafc;border-radius:12px;">
      <h2 style="margin:0 0 12px;color:#f59e0b;">Sub Trafficker Security</h2>
      <p style="color:#cbd5e1;font-size:14px;line-height:1.5;">
        Use the single-use code below to ${purpose === 'reset' ? 'reset your account password' : 'verify your email address'}. It expires in 10 minutes.
      </p>
      <div style="margin:20px 0;padding:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;text-align:center;font-size:28px;font-weight:bold;letter-spacing:6px;color:#34d399;">
        ${code}
      </div>
      <p style="color:#94a3b8;font-size:12px;">If you did not request this code, ignore this message.</p>
    </div>
  `;

  const delivery = await sendRealEmail({ to: normalizedEmail, subject, text, html });
  if (!delivery.sent) {
    return {
      ok: false,
      statusCode: 503,
      message: delivery.error || 'Could not deliver verification email.',
    };
  }

  sqlite
    .prepare(
      `INSERT INTO email_otps (id, email, purpose, code_hash, expires_at, attempts, used, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?)`
    )
    .run(otpId, normalizedEmail, purpose, codeHash, expiresAt, nowMs);

  return {
    ok: true,
    statusCode: 200,
    message: `Verification email sent to ${normalizedEmail}. Check your inbox and enter the 6-digit code.`,
  };
}

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');

  if (!name || name.length < 2) {
    return res.status(400).json({ status: false, message: 'Enter your full name (at least 2 characters).' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ status: false, message: 'Enter a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ status: false, message: 'Password must be at least 8 characters long.' });
  }

  const existing = sqlite.prepare('SELECT id, email_verified, password_hash FROM users_auth WHERE email = ?').get(email) as any;
  if (existing && existing.email_verified && existing.password_hash) {
    return res.status(409).json({ status: false, message: 'An account with this email already exists. Please sign in.' });
  }

  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);
  const role = email === getAdminEmail() ? 'admin' : 'user';
  let userId = existing?.id || `usr_${crypto.randomUUID()}`;

  if (existing) {
    sqlite
      .prepare('UPDATE users_auth SET name = ?, password_hash = ?, role = ?, updated_at = ? WHERE id = ?')
      .run(name, passwordHash, role, now, userId);
  } else {
    sqlite
      .prepare(
        `INSERT INTO users_auth (id, email, password_hash, name, email_verified, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
      )
      .run(userId, email, passwordHash, name, role, now, now);
  }

  const otpDispatch = await issueEmailOtp(email, 'verify');
  if (!otpDispatch.ok) {
    return res.status(otpDispatch.statusCode).json({
      status: false,
      requiresEmailConfig: otpDispatch.statusCode === 503,
      message: otpDispatch.message,
    });
  }

  // NEVER return the verification code in API responses!
  return res.status(201).json({
    status: true,
    pendingVerification: true,
    email,
    message: otpDispatch.message,
  });
});

app.post('/api/auth/email/send-otp', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ status: false, message: 'Enter a valid email address.' });
  }
  const user = sqlite.prepare('SELECT id, email_verified FROM users_auth WHERE email = ?').get(email) as any;
  if (!user) {
    return res.status(404).json({ status: false, message: 'No account found for this email address.' });
  }
  if (user.email_verified) {
    return res.json({ status: true, alreadyVerified: true, message: 'Email is already verified.' });
  }

  const result = await issueEmailOtp(email, 'verify');
  return res.status(result.statusCode).json({ status: result.ok, message: result.message });
});

app.post('/api/auth/email/verify-otp', (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const code = String(req.body?.code || '').trim();

  if (!email || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ status: false, message: 'Enter the 6-digit verification code sent to your email.' });
  }

  const otpRow = sqlite
    .prepare('SELECT * FROM email_otps WHERE email = ? AND purpose = ? AND used = 0 ORDER BY created_at DESC LIMIT 1')
    .get(email, 'verify') as any;

  if (!otpRow) {
    return res.status(400).json({ status: false, message: 'Invalid verification code or no active verification request.' });
  }

  if (Date.now() > otpRow.expires_at) {
    sqlite.prepare('UPDATE email_otps SET used = 1 WHERE id = ?').run(otpRow.id);
    return res.status(400).json({ status: false, codeExpired: true, message: 'Verification code expired. Request a new code.' });
  }

  if (otpRow.attempts >= 5) {
    sqlite.prepare('UPDATE email_otps SET used = 1 WHERE id = ?').run(otpRow.id);
    return res.status(429).json({ status: false, message: 'Too many incorrect attempts. Request a new verification code.' });
  }

  const valid = verifyOtpHash(code, `email:verify:${email}`, otpRow.code_hash);
  if (!valid) {
    sqlite.prepare('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?').run(otpRow.id);
    return res.status(400).json({ status: false, message: 'Invalid verification code.' });
  }

  // Mark code consumed and verify user atomically
  const now = new Date().toISOString();
  const txn = sqlite.transaction(() => {
    sqlite.prepare('UPDATE email_otps SET used = 1 WHERE id = ?').run(otpRow.id);
    sqlite.prepare('UPDATE users_auth SET email_verified = 1, updated_at = ? WHERE email = ?').run(now, email);
  });
  txn();

  const userRow = sqlite.prepare('SELECT * FROM users_auth WHERE email = ?').get(email) as any;
  const user = formatUserRow(userRow)!;
  const token = signSessionToken({ uid: user.uid, email: user.email, role: user.role as 'user' | 'admin' });

  return res.json({
    status: true,
    message: 'Email successfully verified.',
    token,
    user,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ status: false, message: 'Email and password are required.' });
  }

  const userRow = sqlite.prepare('SELECT * FROM users_auth WHERE email = ?').get(email) as any;
  if (!userRow || !userRow.password_hash || !verifyPassword(password, userRow.password_hash)) {
    return res.status(401).json({ status: false, message: 'Invalid email address or password.' });
  }

  if (!userRow.email_verified) {
    return res.status(403).json({
      status: false,
      requiresVerification: true,
      email,
      message: 'Your email is not verified yet. Enter the verification code sent to your inbox or request a new one.',
    });
  }

  const user = formatUserRow(userRow)!;
  const token = signSessionToken({ uid: user.uid, email: user.email, role: user.role as 'user' | 'admin' });
  return res.json({ status: true, token, user });
});

app.post('/api/auth/forgot-password/send-otp', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ status: false, message: 'Enter a valid email address.' });
  }
  const user = sqlite.prepare('SELECT id FROM users_auth WHERE email = ?').get(email);
  if (!user) {
    return res.status(404).json({ status: false, message: 'No account found with that email address.' });
  }

  const result = await issueEmailOtp(email, 'reset');
  return res.status(result.statusCode).json({ status: result.ok, message: result.message });
});

app.post('/api/auth/forgot-password/reset', (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const code = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!email || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ status: false, message: 'Enter a valid email and 6-digit reset code.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ status: false, message: 'New password must be at least 8 characters long.' });
  }

  const otpRow = sqlite
    .prepare('SELECT * FROM email_otps WHERE email = ? AND purpose = ? AND used = 0 ORDER BY created_at DESC LIMIT 1')
    .get(email, 'reset') as any;

  if (!otpRow) {
    return res.status(400).json({ status: false, message: 'Invalid verification code.' });
  }
  if (Date.now() > otpRow.expires_at) {
    sqlite.prepare('UPDATE email_otps SET used = 1 WHERE id = ?').run(otpRow.id);
    return res.status(400).json({ status: false, message: 'Verification code expired. Request a new reset code.' });
  }
  if (otpRow.attempts >= 5) {
    sqlite.prepare('UPDATE email_otps SET used = 1 WHERE id = ?').run(otpRow.id);
    return res.status(429).json({ status: false, message: 'Too many invalid attempts. Request a new reset code.' });
  }

  if (!verifyOtpHash(code, `email:reset:${email}`, otpRow.code_hash)) {
    sqlite.prepare('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?').run(otpRow.id);
    return res.status(400).json({ status: false, message: 'Invalid verification code.' });
  }

  const newHash = hashPassword(newPassword);
  const now = new Date().toISOString();
  const txn = sqlite.transaction(() => {
    sqlite.prepare('UPDATE email_otps SET used = 1 WHERE id = ?').run(otpRow.id);
    sqlite.prepare('UPDATE users_auth SET password_hash = ?, email_verified = 1, updated_at = ? WHERE email = ?').run(newHash, now, email);
  });
  txn();

  return res.json({ status: true, message: 'Password updated successfully. You can now sign in.' });
});

// Exchanges a real verified Firebase ID token (e.g. from Google Sign-In) for an authoritative backend session
app.post('/api/auth/firebase-exchange', async (req, res) => {
  const idToken = String(req.body?.idToken || '').trim();
  if (!idToken) {
    return res.status(400).json({ status: false, message: 'Missing Firebase ID token.' });
  }
  const verified = await verifyFirebaseIdToken(idToken);
  if (!verified) {
    return res.status(401).json({ status: false, message: 'Could not verify Firebase authentication token.' });
  }

  const userRow = getOrCreateUserRecord({
    id: verified.uid,
    email: verified.email,
    name: verified.name,
    emailVerified: verified.emailVerified,
  });
  const user = formatUserRow(userRow)!;
  const token = signSessionToken({ uid: user.uid, email: user.email, role: user.role as 'user' | 'admin' });
  return res.json({ status: true, token, user });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const row = sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(req.authUser!.uid);
  if (!row) {
    return res.status(404).json({ status: false, message: 'Account not found.' });
  }
  return res.json({ status: true, user: formatUserRow(row) });
});

// ============================================================================
// 3. REAL WEBAUTHN / PASSKEYS (OS Fingerprint / Face ID / Windows Hello)
// ============================================================================
app.post('/api/webauthn/register/options', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userRow = sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(req.authUser!.uid) as any;
    if (!userRow) return res.status(404).json({ status: false, message: 'User not found.' });

    const { rpID, rpName } = resolveRpContext(req);
    const existingCreds = sqlite
      .prepare('SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?')
      .all(userRow.id) as Array<{ credential_id: string; transports: string }>;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: userRow.email,
      userDisplayName: userRow.name || userRow.email,
      userID: Buffer.from(userRow.id, 'utf8'),
      attestationType: 'none',
      excludeCredentials: existingCreds.map((c) => ({
        id: c.credential_id,
        transports: JSON.parse(c.transports || '[]') as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
    });

    const challengeId = crypto.randomUUID();
    sqlite
      .prepare('INSERT INTO webauthn_challenges (id, user_id, email, challenge, type, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(challengeId, userRow.id, userRow.email, options.challenge, 'reg', Date.now() + 5 * 60 * 1000);

    return res.json({ status: true, challengeId, options });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message || 'Failed to generate passkey options.' });
  }
});

app.post('/api/webauthn/register/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { challengeId, credential, deviceName } = req.body || {};
    if (!challengeId || !credential) {
      return res.status(400).json({ status: false, message: 'Missing passkey challenge or attestation payload.' });
    }

    const challengeRow = sqlite
      .prepare('SELECT * FROM webauthn_challenges WHERE id = ? AND user_id = ? AND type = ?')
      .get(challengeId, req.authUser!.uid, 'reg') as any;

    if (!challengeRow || Date.now() > challengeRow.expires_at) {
      return res.status(400).json({ status: false, message: 'Passkey registration challenge expired. Please try again.' });
    }

    const { rpID, expectedOrigins } = resolveRpContext(req);
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    sqlite.prepare('DELETE FROM webauthn_challenges WHERE id = ?').run(challengeId);

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ status: false, message: 'Passkey cryptographic verification failed.' });
    }

    const { credential: regCred } = verification.registrationInfo;
    const pubKeyBase64Url = Buffer.from(regCred.publicKey).toString('base64url');
    const transportsJson = JSON.stringify(credential.response?.transports || ['internal']);

    sqlite
      .prepare(
        `INSERT OR REPLACE INTO webauthn_credentials (credential_id, user_id, public_key, counter, transports, device_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        regCred.id,
        req.authUser!.uid,
        pubKeyBase64Url,
        regCred.counter,
        transportsJson,
        String(deviceName || 'Platform Biometric Passkey').slice(0, 80),
        new Date().toISOString()
      );

    return res.json({ status: true, message: 'Passkey registered and verified on this device.' });
  } catch (err: any) {
    return res.status(400).json({ status: false, message: err.message || 'Passkey verification error.' });
  }
});

app.post('/api/webauthn/login/options', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const { rpID } = resolveRpContext(req);

    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] | undefined;
    let userId: string | null = null;

    if (email) {
      const userRow = sqlite.prepare('SELECT id FROM users_auth WHERE email = ?').get(email) as { id: string } | undefined;
      if (!userRow) {
        return res.status(404).json({ status: false, message: 'No account found with this email.' });
      }
      userId = userRow.id;
      const creds = sqlite
        .prepare('SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?')
        .all(userRow.id) as Array<{ credential_id: string; transports: string }>;
      if (creds.length === 0) {
        return res.status(400).json({ status: false, message: 'No passkey is registered for this account yet. Sign in with password first and register one in Verification Center.' });
      }
      allowCredentials = creds.map((c) => ({
        id: c.credential_id,
        transports: JSON.parse(c.transports || '[]'),
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials,
    });

    const challengeId = crypto.randomUUID();
    sqlite
      .prepare('INSERT INTO webauthn_challenges (id, user_id, email, challenge, type, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(challengeId, userId, email || null, options.challenge, 'auth', Date.now() + 5 * 60 * 1000);

    return res.json({ status: true, challengeId, options });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message || 'Failed to prepare passkey sign-in.' });
  }
});

app.post('/api/webauthn/login/verify', async (req, res) => {
  try {
    const { challengeId, credential } = req.body || {};
    if (!challengeId || !credential?.id) {
      return res.status(400).json({ status: false, message: 'Missing passkey assertion payload.' });
    }

    const challengeRow = sqlite
      .prepare('SELECT * FROM webauthn_challenges WHERE id = ? AND type = ?')
      .get(challengeId, 'auth') as any;

    if (!challengeRow || Date.now() > challengeRow.expires_at) {
      return res.status(400).json({ status: false, message: 'Passkey sign-in challenge expired. Please try again.' });
    }

    const credRow = sqlite
      .prepare('SELECT * FROM webauthn_credentials WHERE credential_id = ?')
      .get(credential.id) as any;

    if (!credRow) {
      return res.status(401).json({ status: false, message: 'Unrecognized passkey credential. Sign in with email and password instead.' });
    }

    const { rpID, expectedOrigins } = resolveRpContext(req);
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: credRow.credential_id,
        publicKey: new Uint8Array(Buffer.from(credRow.public_key, 'base64url')),
        counter: Number(credRow.counter || 0),
        transports: JSON.parse(credRow.transports || '[]'),
      },
    });

    sqlite.prepare('DELETE FROM webauthn_challenges WHERE id = ?').run(challengeId);

    if (!verification.verified) {
      return res.status(401).json({ status: false, message: 'Passkey signature verification failed.' });
    }

    sqlite
      .prepare('UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?')
      .run(verification.authenticationInfo.newCounter, credRow.credential_id);

    const userRow = sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(credRow.user_id) as any;
    if (!userRow) {
      return res.status(404).json({ status: false, message: 'Associated account no longer exists.' });
    }
    const user = formatUserRow(userRow)!;
    const token = signSessionToken({ uid: user.uid, email: user.email, role: user.role as 'user' | 'admin' });
    return res.json({ status: true, token, user, message: 'Signed in securely with passkey.' });
  } catch (err: any) {
    return res.status(401).json({ status: false, message: err.message || 'Passkey sign-in failed.' });
  }
});

app.get('/api/webauthn/credentials', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = sqlite
    .prepare('SELECT credential_id, device_name, created_at FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.authUser!.uid);
  return res.json({ status: true, credentials: rows });
});

app.delete('/api/webauthn/credentials/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  sqlite
    .prepare('DELETE FROM webauthn_credentials WHERE credential_id = ? AND user_id = ?')
    .run(req.params.id, req.authUser!.uid);
  return res.json({ status: true, message: 'Passkey removed.' });
});

// ============================================================================
// 4. REAL IDENTITY & BIOMETRIC FACE VERIFICATION (NEVER AUTO-APPROVES)
// ============================================================================
app.post('/api/verification/face/reference', requireAuth, (req: AuthenticatedRequest, res) => {
  const imageBase64 = String(req.body?.imageBase64 || '').trim();
  const clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  if (!clean || clean.length < 200 || clean.length > 6_000_000) {
    return res.status(400).json({ status: false, message: 'Upload or capture a clear portrait reference photo (under 4MB).' });
  }

  const imageHash = crypto.createHash('sha256').update(clean).digest('hex');
  const now = new Date().toISOString();

  sqlite
    .prepare('INSERT OR REPLACE INTO face_references (user_id, image_hash, image_data_base64, updated_at) VALUES (?, ?, ?, ?)')
    .run(req.authUser!.uid, imageHash, clean, now);

  sqlite
    .prepare("UPDATE users_auth SET face_status = 'pending', face_reason = 'Reference photo stored. Capture a live selfie to verify.', updated_at = ? WHERE id = ?")
    .run(now, req.authUser!.uid);

  return res.json({
    status: true,
    hasReference: true,
    faceStatus: 'pending',
    message: 'Reference identity image stored securely on server.',
  });
});

app.post('/api/verification/face/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  const liveSelfieBase64 = String(req.body?.liveSelfieBase64 || '').trim();
  if (!liveSelfieBase64) {
    return res.status(400).json({ status: false, faceStatus: 'retry_required', message: 'Live camera frame is required.' });
  }

  const refRow = sqlite
    .prepare('SELECT image_data_base64 FROM face_references WHERE user_id = ?')
    .get(req.authUser!.uid) as { image_data_base64: string } | undefined;

  if (!refRow) {
    return res.status(400).json({
      status: false,
      faceStatus: 'retry_required',
      message: 'Upload or capture your reference identity photo before running face verification.',
    });
  }

  const now = new Date().toISOString();
  sqlite.prepare("UPDATE users_auth SET face_status = 'processing', updated_at = ? WHERE id = ?").run(now, req.authUser!.uid);

  const outcome = await verifyFaceWithProvider({
    liveSelfieBase64,
    referenceImageBase64: refRow.image_data_base64,
  });

  const verificationId = crypto.randomUUID();
  const tx = sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO face_verifications (id, user_id, status, provider, confidence, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(verificationId, req.authUser!.uid, outcome.status, outcome.provider, outcome.confidence ?? null, outcome.reason, new Date().toISOString());

    sqlite
      .prepare(
        `UPDATE users_auth
         SET face_status = ?, face_provider = ?, face_confidence = ?, face_reason = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(outcome.status, outcome.provider, outcome.confidence ?? null, outcome.reason, new Date().toISOString(), req.authUser!.uid);
  });
  tx();

  const statusCode = outcome.provider === 'unconfigured' ? 503 : outcome.status === 'verified' ? 200 : 422;
  return res.status(statusCode).json({
    status: outcome.status === 'verified',
    faceStatus: outcome.status,
    provider: outcome.provider,
    confidence: outcome.confidence ?? null,
    message: outcome.reason,
  });
});

app.get('/api/verification/status', requireAuth, (req: AuthenticatedRequest, res) => {
  const userRow = sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(req.authUser!.uid);
  const refExists = Boolean(sqlite.prepare('SELECT user_id FROM face_references WHERE user_id = ?').get(req.authUser!.uid));
  const history = sqlite
    .prepare('SELECT id, status, provider, confidence, reason, created_at FROM face_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')
    .all(req.authUser!.uid);

  return res.json({
    status: true,
    hasFaceReference: refExists,
    user: formatUserRow(userRow),
    faceHistory: history,
  });
});

// ============================================================================
// 5. PHONE NORMALIZATION, CARRIER MNP DETECTION & REAL SMS OTP
// ============================================================================
app.post('/api/phone/detect', async (req, res) => {
  const rawPhone = String(req.body?.phone || '').trim();
  const normalized = normalizeNigerianPhone(rawPhone);
  if (!normalized.valid || !normalized.local || !normalized.e164) {
    return res.status(400).json({ status: false, message: normalized.error || 'Invalid Nigerian mobile number.' });
  }

  const lookup = await lookupCarrierWithMnp(normalized.local, normalized.e164);
  return res.json({
    status: true,
    normalizedLocal: normalized.local,
    normalizedE164: normalized.e164,
    carrier: lookup.carrier,
    method: lookup.method,
    provider: lookup.provider,
    ported: lookup.ported ?? false,
    mnpNotice: lookup.mnpNotice,
  });
});

app.post('/api/phone/send-otp', requireAuth, async (req: AuthenticatedRequest, res) => {
  const rawPhone = String(req.body?.phone || '').trim();
  const claimedCarrier = String(req.body?.carrier || '').trim();
  const normalized = normalizeNigerianPhone(rawPhone);

  if (!normalized.valid || !normalized.local || !normalized.e164) {
    return res.status(400).json({ status: false, message: normalized.error || 'Invalid phone number.' });
  }

  const nowMs = Date.now();
  const recent = sqlite
    .prepare('SELECT created_at FROM phone_otps WHERE user_id = ? AND phone = ? ORDER BY created_at DESC LIMIT 1')
    .get(req.authUser!.uid, normalized.local) as { created_at: number } | undefined;

  if (recent && nowMs - recent.created_at < 60_000) {
    const waitSec = Math.ceil((60_000 - (nowMs - recent.created_at)) / 1000);
    return res.status(429).json({ status: false, message: `Please wait ${waitSec}s before requesting another SMS OTP.` });
  }

  const lookup = await lookupCarrierWithMnp(normalized.local, normalized.e164);
  const effectiveCarrier = claimedCarrier || lookup.carrier || '';
  if (!['MTN', 'Airtel', 'Glo', '9mobile'].includes(effectiveCarrier)) {
    return res.status(400).json({ status: false, message: 'Select a valid Nigerian mobile carrier (MTN, Airtel, Glo, or 9mobile).' });
  }

  sqlite.prepare('UPDATE phone_otps SET used = 1 WHERE user_id = ? AND phone = ? AND used = 0').run(req.authUser!.uid, normalized.local);

  const code = generateNumericOtp(6);
  const codeHash = hashOtp(code, `phone:${req.authUser!.uid}:${normalized.local}`);
  const sms = await sendRealSms({
    toE164: normalized.e164,
    message: `Sub Trafficker verification code: ${code}. Valid for 10 minutes. Do not share this code.`,
  });

  if (!sms.sent) {
    return res.status(503).json({
      status: false,
      requiresSmsConfig: true,
      message: sms.error || 'SMS provider could not send verification OTP.',
    });
  }

  sqlite
    .prepare(
      `INSERT INTO phone_otps (id, user_id, phone, carrier, code_hash, expires_at, attempts, used, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`
    )
    .run(crypto.randomUUID(), req.authUser!.uid, normalized.local, effectiveCarrier, codeHash, nowMs + 10 * 60 * 1000, nowMs);

  return res.json({
    status: true,
    normalizedLocal: normalized.local,
    carrier: effectiveCarrier,
    lookupMethod: lookup.method,
    mnpNotice: lookup.mnpNotice,
    message: `SMS verification code sent to ${normalized.local} via ${sms.provider}.`,
  });
});

app.post('/api/phone/verify-otp', requireAuth, async (req: AuthenticatedRequest, res) => {
  const rawPhone = String(req.body?.phone || '').trim();
  const code = String(req.body?.code || '').trim();
  const normalized = normalizeNigerianPhone(rawPhone);

  if (!normalized.valid || !normalized.local || !normalized.e164) {
    return res.status(400).json({ status: false, message: normalized.error || 'Invalid phone number.' });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ status: false, message: 'Enter the 6-digit SMS code.' });
  }

  const otpRow = sqlite
    .prepare('SELECT * FROM phone_otps WHERE user_id = ? AND phone = ? AND used = 0 ORDER BY created_at DESC LIMIT 1')
    .get(req.authUser!.uid, normalized.local) as any;

  if (!otpRow) {
    return res.status(400).json({ status: false, message: 'No active SMS verification found for this number.' });
  }
  if (Date.now() > otpRow.expires_at) {
    sqlite.prepare('UPDATE phone_otps SET used = 1 WHERE id = ?').run(otpRow.id);
    return res.status(400).json({ status: false, message: 'SMS verification code expired. Request a new code.' });
  }
  if (otpRow.attempts >= 5) {
    sqlite.prepare('UPDATE phone_otps SET used = 1 WHERE id = ?').run(otpRow.id);
    return res.status(429).json({ status: false, message: 'Too many invalid attempts. Request a new SMS code.' });
  }

  if (!verifyOtpHash(code, `phone:${req.authUser!.uid}:${normalized.local}`, otpRow.code_hash)) {
    sqlite.prepare('UPDATE phone_otps SET attempts = attempts + 1 WHERE id = ?').run(otpRow.id);
    return res.status(400).json({ status: false, message: 'Invalid SMS verification code.' });
  }

  const lookup = await lookupCarrierWithMnp(normalized.local, normalized.e164);
  const now = new Date().toISOString();
  const txn = sqlite.transaction(() => {
    sqlite.prepare('UPDATE phone_otps SET used = 1 WHERE id = ?').run(otpRow.id);
    sqlite
      .prepare(
        `UPDATE users_auth
         SET phone = ?, isp = ?, phone_verified = 1, phone_carrier_verified = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(normalized.local, otpRow.carrier, lookup.method === 'hlr_live' ? 1 : 0, now, req.authUser!.uid);
  });
  txn();

  const updatedUser = formatUserRow(sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(req.authUser!.uid));
  return res.json({
    status: true,
    user: updatedUser,
    message: `Phone number ${normalized.local} (${otpRow.carrier}) verified via SMS OTP.`,
  });
});

// ============================================================================
// 6. REAL NIGERIAN BANK RESOLUTION & TRANSFERS (ZERO FABRICATION)
// ============================================================================
app.all(['/api/paystack/resolve', '/api/bank/resolve'], async (req, res) => {
  const accountNumber = String(req.body?.accountNumber || req.query?.accountNumber || req.query?.account_number || '').trim();
  const bankCode = String(req.body?.bankCode || req.query?.bankCode || req.query?.bank_code || '').trim();

  const result = await resolveNigerianBankAccount({ accountNumber, bankCode });
  if (!result.ok) {
    return res.status(result.statusCode).json({
      status: false,
      provider: result.provider,
      message: result.message,
    });
  }

  return res.json({
    status: true,
    accountName: result.accountName,
    provider: result.provider,
    message: result.message,
  });
});

app.post('/api/bank/confirm', requireAuth, async (req: AuthenticatedRequest, res) => {
  const accountNumber = String(req.body?.accountNumber || '').trim();
  const bankCode = String(req.body?.bankCode || '').trim();
  const bankName = String(req.body?.bankName || '').trim();
  const confirmedByHolder = Boolean(req.body?.confirmed);

  if (!confirmedByHolder) {
    return res.status(400).json({ status: false, message: 'You must confirm that the resolved account holder name belongs to you.' });
  }

  // Always re-resolve on backend so frontend cannot spoof accountName
  const resolved = await resolveNigerianBankAccount({ accountNumber, bankCode });
  if (!resolved.ok || !resolved.accountName) {
    return res.status(resolved.statusCode).json({ status: false, message: resolved.message });
  }

  const now = new Date().toISOString();
  sqlite
    .prepare(
      `UPDATE users_auth
       SET bank_code = ?, bank_name = ?, account_number = ?, account_name = ?, bank_verified = 1, bank_confirmed = 1, updated_at = ?
       WHERE id = ?`
    )
    .run(bankCode, bankName, accountNumber, resolved.accountName, now, req.authUser!.uid);

  const user = formatUserRow(sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(req.authUser!.uid));
  return res.json({
    status: true,
    accountName: resolved.accountName,
    provider: resolved.provider,
    user,
    message: `Bank account verified (${resolved.accountName}) via ${resolved.provider}.`,
  });
});

app.post(['/api/paystack/transfer', '/api/bank/withdraw'], requireAuth, async (req: AuthenticatedRequest, res) => {
  const amount = Number(req.body?.amount || 0);
  const accountNumber = String(req.body?.accountNumber || '').trim();
  const bankCode = String(req.body?.bankCode || '').trim();

  if (!Number.isFinite(amount) || amount < 100) {
    return res.status(400).json({ status: false, message: 'Minimum bank withdrawal is ₦100.' });
  }

  const userRow = sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(req.authUser!.uid) as any;
  if (!userRow) return res.status(404).json({ status: false, message: 'User not found.' });

  // Verify bank details freshly via provider
  const resolved = await resolveNigerianBankAccount({
    accountNumber: accountNumber || userRow.account_number,
    bankCode: bankCode || userRow.bank_code,
  });
  if (!resolved.ok || !resolved.accountName) {
    return res.status(resolved.statusCode).json({ status: false, message: resolved.message });
  }

  if (Number(userRow.cash_balance_ngn) < amount) {
    return res.status(400).json({ status: false, message: 'Insufficient verified cash balance for this withdrawal.' });
  }

  const ref = `st_wd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const transfer = await initiateNigerianBankTransfer({
    accountNumber: accountNumber || userRow.account_number,
    bankCode: bankCode || userRow.bank_code,
    accountName: resolved.accountName,
    amountNgn: amount,
    reference: ref,
    narration: 'Sub Trafficker Wallet Payout',
  });

  if (!transfer.ok) {
    return res.status(transfer.statusCode).json({
      status: false,
      provider: transfer.provider,
      message: transfer.message,
    });
  }

  const tx = sqlite.transaction(() => {
    const deduct = sqlite
      .prepare('UPDATE users_auth SET cash_balance_ngn = cash_balance_ngn - ?, updated_at = ? WHERE id = ? AND cash_balance_ngn >= ?')
      .run(amount, new Date().toISOString(), req.authUser!.uid, amount);
    if (deduct.changes === 0) throw new Error('Insufficient balance during atomic deduction.');

    sqlite
      .prepare(
        `INSERT INTO server_transactions (id, user_id, type, amount_ngn, received_ngn, network_or_provider, reference_details, status, created_at)
         VALUES (?, ?, 'withdrawal', ?, ?, ?, ?, 'completed', ?)`
      )
      .run(ref, req.authUser!.uid, amount, amount, transfer.provider || 'Bank', `${resolved.accountName} (${accountNumber || userRow.account_number})`, new Date().toISOString());
  });
  tx();

  return res.json({
    status: true,
    reference: ref,
    gatewayRef: transfer.gatewayRef,
    provider: transfer.provider,
    message: transfer.message,
  });
});

// ============================================================================
// 7. SPONSORED PARTNER REWARDS (HONEST REPLACEMENT FOR FAKE TRAFFIC CONVERTER)
// ============================================================================
app.get('/api/rewards/campaigns', requireAuth, (req: AuthenticatedRequest, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const campaigns = sqlite.prepare('SELECT * FROM reward_campaigns WHERE active = 1').all() as any[];
  const claimsToday = sqlite
    .prepare('SELECT campaign_id FROM reward_claims WHERE user_id = ? AND claim_date = ?')
    .all(req.authUser!.uid, today) as Array<{ campaign_id: string }>;

  const claimedSet = new Set(claimsToday.map((c) => c.campaign_id));
  const userRow = sqlite.prepare('SELECT cash_balance_ngn FROM users_auth WHERE id = ?').get(req.authUser!.uid) as any;

  return res.json({
    status: true,
    verifiedCashBalanceNgn: Number(userRow?.cash_balance_ngn || 0),
    campaigns: campaigns.map((c) => ({
      ...c,
      claimedToday: claimedSet.has(c.id),
    })),
  });
});

app.post('/api/rewards/start-session', requireAuth, (req: AuthenticatedRequest, res) => {
  const campaignId = String(req.body?.campaignId || '').trim();
  const campaign = sqlite.prepare('SELECT * FROM reward_campaigns WHERE id = ? AND active = 1').get(campaignId) as any;
  if (!campaign) {
    return res.status(404).json({ status: false, message: 'Sponsored campaign not found or inactive.' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const existingClaim = sqlite
    .prepare('SELECT id FROM reward_claims WHERE user_id = ? AND campaign_id = ? AND claim_date = ?')
    .get(req.authUser!.uid, campaignId, today);
  if (existingClaim) {
    return res.status(409).json({ status: false, message: 'Daily limit reached for this campaign. Come back tomorrow.' });
  }

  const nowMs = Date.now();
  const sessionId = `rs_${crypto.randomUUID()}`;
  const minDwellMs = Number(campaign.min_dwell_seconds) * 1000;

  sqlite
    .prepare('INSERT INTO reward_sessions (id, user_id, campaign_id, started_at, min_dwell_ms, claimed, expires_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run(sessionId, req.authUser!.uid, campaignId, nowMs, minDwellMs, nowMs + 15 * 60 * 1000);

  return res.json({
    status: true,
    sessionId,
    campaignId,
    minDwellSeconds: Number(campaign.min_dwell_seconds),
    rewardNgn: Number(campaign.reward_ngn),
  });
});

app.post('/api/rewards/claim', requireAuth, (req: AuthenticatedRequest, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  const attestationAnswer = String(req.body?.attestation || '').trim();

  if (!sessionId) {
    return res.status(400).json({ status: false, message: 'Missing engagement session ID.' });
  }
  if (!attestationAnswer || attestationAnswer.length < 3) {
    return res.status(400).json({ status: false, message: 'Complete the campaign verification check before claiming.' });
  }

  const session = sqlite
    .prepare('SELECT * FROM reward_sessions WHERE id = ? AND user_id = ?')
    .get(sessionId, req.authUser!.uid) as any;

  if (!session) {
    return res.status(404).json({ status: false, message: 'Reward session not found.' });
  }
  if (session.claimed) {
    return res.status(409).json({ status: false, message: 'This reward session has already been claimed.' });
  }
  if (Date.now() > session.expires_at) {
    return res.status(400).json({ status: false, message: 'Engagement session expired. Start a fresh session.' });
  }

  const elapsed = Date.now() - session.started_at;
  if (elapsed < session.min_dwell_ms - 500) {
    const remaining = Math.ceil((session.min_dwell_ms - elapsed) / 1000);
    return res.status(400).json({
      status: false,
      message: `Minimum verified engagement duration not met yet (${remaining}s remaining).`,
    });
  }

  const campaign = sqlite.prepare('SELECT * FROM reward_campaigns WHERE id = ? AND active = 1').get(session.campaign_id) as any;
  if (!campaign) {
    return res.status(404).json({ status: false, message: 'Campaign is no longer active.' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const claimId = `rc_${crypto.randomUUID()}`;
  const txId = `tx_${crypto.randomUUID()}`;
  const rewardNgn = Number(campaign.reward_ngn);
  const now = new Date().toISOString();

  try {
    const txn = sqlite.transaction(() => {
      const updatedSess = sqlite.prepare('UPDATE reward_sessions SET claimed = 1 WHERE id = ? AND claimed = 0').run(sessionId);
      if (updatedSess.changes === 0) throw new Error('Duplicate claim blocked.');

      sqlite
        .prepare('INSERT INTO reward_claims (id, user_id, campaign_id, claim_date, amount_ngn, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(claimId, req.authUser!.uid, campaign.id, today, rewardNgn, sessionId, now);

      sqlite
        .prepare('UPDATE users_auth SET cash_balance_ngn = cash_balance_ngn + ?, updated_at = ? WHERE id = ?')
        .run(rewardNgn, now, req.authUser!.uid);

      sqlite
        .prepare('UPDATE admin_ledger SET total_ad_revenue_ngn = total_ad_revenue_ngn + ?, updated_at = ? WHERE id = ?')
        .run(Number((rewardNgn * 0.25).toFixed(2)), now, 'revenue_ledger');

      sqlite
        .prepare(
          `INSERT INTO server_transactions (id, user_id, type, amount_ngn, received_ngn, network_or_provider, reference_details, status, created_at)
           VALUES (?, ?, 'traffic_cashout', ?, ?, ?, ?, 'completed', ?)`
        )
        .run(txId, req.authUser!.uid, rewardNgn, rewardNgn, campaign.sponsor_name, campaign.title, now);
    });
    txn();
  } catch (err: any) {
    return res.status(409).json({
      status: false,
      message: err?.message?.includes('UNIQUE') ? 'Daily reward already claimed for this campaign.' : err.message || 'Claim rejected.',
    });
  }

  const updatedUser = formatUserRow(sqlite.prepare('SELECT * FROM users_auth WHERE id = ?').get(req.authUser!.uid));
  return res.json({
    status: true,
    rewardNgn,
    claimId,
    user: updatedUser,
    message: `Verified ₦${rewardNgn.toFixed(2)} reward credited from ${campaign.sponsor_name}.`,
  });
});

app.get('/api/rewards/history', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = sqlite
    .prepare('SELECT * FROM server_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(req.authUser!.uid);
  return res.json({ status: true, transactions: rows });
});

// ============================================================================
// 8. OWNER ADMIN ENDPOINTS (STRICTLY ADMIN-GATED)
// ============================================================================
app.get('/api/admin/overview', requireAuth, requireAdmin, (_req, res) => {
  const ledger = sqlite.prepare("SELECT * FROM admin_ledger WHERE id = 'revenue_ledger'").get();
  const userStats = sqlite
    .prepare(
      `SELECT COUNT(*) as totalUsers,
              SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) as emailVerifiedUsers,
              SUM(CASE WHEN face_status = 'verified' THEN 1 ELSE 0 END) as faceVerifiedUsers,
              SUM(CASE WHEN bank_verified = 1 THEN 1 ELSE 0 END) as bankVerifiedUsers,
              COALESCE(SUM(cash_balance_ngn), 0) as totalUserCashNgn
       FROM users_auth`
    )
    .get();
  return res.json({ status: true, ledger, userStats });
});

app.post('/api/admin/reset-balances', requireAuth, requireAdmin, (_req, res) => {
  const now = new Date().toISOString();
  sqlite.prepare('UPDATE users_auth SET cash_balance_ngn = 0, airtime_balance_ngn = 0, updated_at = ?').run(now);
  return res.json({ status: true, message: 'Server cash and airtime balances reset.' });
});

// ============================================================================
// 9. GEMINI AI ASSISTANT STREAMING (CHIMEX)
// ============================================================================
function getOfflineSmartResponse(userQuery: string, reason: string): string {
  const query = userQuery.toLowerCase();
  if (query.includes('bank') || query.includes('paystack') || query.includes('flutterwave') || query.includes('monnify')) {
    return 'Bank verification uses live Paystack, Flutterwave, or Monnify account resolution on the backend. Add your 10-digit NUBAN and bank in Verification Center, resolve your real registered account name, and confirm ownership before requesting transfers.';
  }
  if (query.includes('passkey') || query.includes('face') || query.includes('biometric') || query.includes('email')) {
    return 'Sub Trafficker uses real WebAuthn passkeys (Touch ID, Face ID, Windows Hello, Android BiometricPrompt), backend-delivered 6-digit email/SMS verification codes, and server-side face comparison via Dojah or Face++. Open Verification Center to complete each step.';
  }
  if (query.includes('traffic') || query.includes('earn') || query.includes('reward') || query.includes('bandwidth')) {
    return 'Raw background browser traffic cannot legally or technically generate revenue without a paying buyer or proxy exit node. Instead, the Sponsored Engagement Hub pays transparent NGN rewards funded by verified partner campaigns with server-side dwell verification and duplicate-claim protection.';
  }
  return `I am Chimex, your Sub Trafficker security and operations guide. Ask me about Verification Center (Email OTP, SMS MNP lookup, Face comparison, Passkeys), Nigerian bank resolution, Sponsored Rewards, or Blood Strike 3D mobile controls.\n\n*(Offline helper active: ${reason})*`;
}

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body || {};
  const list = Array.isArray(messages) ? messages : [];
  const lastMsg = list[list.length - 1];
  const userMessage = String(lastMsg?.content || '');
  const attachment = lastMsg?.attachment;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const offlineReply = getOfflineSmartResponse(userMessage, 'GEMINI_API_KEY not configured');
    res.write(`data: ${JSON.stringify({ text: offlineReply })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  try {
    const ai = getAiClient();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const history = list.slice(0, -1).map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history,
      config: {
        systemInstruction:
          'You are Chimex, the technical assistant for Sub Trafficker. Give concise, accurate guidance on WebAuthn passkeys, Email/SMS verification, Paystack/Flutterwave/Monnify NUBAN verification, transparent Sponsored Engagement Rewards, and Blood Strike 3D FPS performance/mobile controls. Never claim raw background browser traffic generates cash or that local timers verify faces.',
      },
    });

    let messagePayload: any = userMessage;
    if (attachment?.data) {
      messagePayload = [
        { text: userMessage || 'Analyze this attached file for Sub Trafficker:' },
        { inlineData: { mimeType: attachment.mimeType || 'image/png', data: attachment.data } },
      ];
    }

    const result = await chat.sendMessageStream({ message: messagePayload });
    for await (const chunk of result) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (err: any) {
    const offlineReply = getOfflineSmartResponse(userMessage, err.message || 'Connection issue');
    res.write(`data: ${JSON.stringify({ text: offlineReply })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }
});

// JSON 404 fallback for /api/*
app.all('/api/*', (req, res) => {
  res.status(404).json({ status: false, message: `API endpoint ${req.method} ${req.url} not found.` });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sub Trafficker server listening on port ${PORT}`);
  });
}

startServer();
