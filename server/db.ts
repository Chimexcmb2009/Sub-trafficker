import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'subtrafficker.db');
export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users_auth (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      isp TEXT NOT NULL DEFAULT '',
      email_verified INTEGER NOT NULL DEFAULT 0,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      phone_carrier_verified INTEGER NOT NULL DEFAULT 0,
      face_status TEXT NOT NULL DEFAULT 'pending',
      face_provider TEXT NOT NULL DEFAULT '',
      face_confidence REAL,
      face_reason TEXT NOT NULL DEFAULT '',
      bank_verified INTEGER NOT NULL DEFAULT 0,
      bank_code TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      account_number TEXT NOT NULL DEFAULT '',
      account_name TEXT NOT NULL DEFAULT '',
      bank_confirmed INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'user',
      cash_balance_ngn REAL NOT NULL DEFAULT 0,
      airtime_balance_ngn REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_otps (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_otps_lookup ON email_otps (email, purpose, created_at);

    CREATE TABLE IF NOT EXISTS phone_otps (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      carrier TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_phone_otps_lookup ON phone_otps (user_id, phone, created_at);

    CREATE TABLE IF NOT EXISTS webauthn_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email TEXT,
      challenge TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      credential_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT NOT NULL DEFAULT '[]',
      device_name TEXT NOT NULL DEFAULT 'Platform Passkey',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users_auth(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS face_references (
      user_id TEXT PRIMARY KEY,
      image_hash TEXT NOT NULL,
      image_data_base64 TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users_auth(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS face_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      confidence REAL,
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users_auth(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reward_campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sponsor_name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      revenue_model TEXT NOT NULL,
      reward_ngn REAL NOT NULL,
      min_dwell_seconds INTEGER NOT NULL,
      daily_limit INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS reward_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      min_dwell_ms INTEGER NOT NULL,
      claimed INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users_auth(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reward_claims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      claim_date TEXT NOT NULL,
      amount_ngn REAL NOT NULL,
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, campaign_id, claim_date)
    );

    CREATE TABLE IF NOT EXISTS server_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount_ngn REAL NOT NULL,
      received_ngn REAL NOT NULL,
      network_or_provider TEXT NOT NULL,
      reference_details TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_server_tx_user ON server_transactions (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS admin_ledger (
      id TEXT PRIMARY KEY,
      total_ad_revenue_ngn REAL NOT NULL DEFAULT 0,
      total_payouts_ngn REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  const ledger = sqlite.prepare('SELECT id FROM admin_ledger WHERE id = ?').get('revenue_ledger');
  if (!ledger) {
    sqlite
      .prepare('INSERT INTO admin_ledger (id, total_ad_revenue_ngn, total_payouts_ngn, updated_at) VALUES (?, ?, ?, ?)')
      .run('revenue_ledger', 0, 0, new Date().toISOString());
  }

  // Seed transparent sponsored reward campaigns (only revenue-backed engagement, zero fake traffic spoofing)
  const insertCampaign = sqlite.prepare(`
    INSERT OR IGNORE INTO reward_campaigns (id, title, sponsor_name, category, description, revenue_model, reward_ngn, min_dwell_seconds, daily_limit, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const campaigns = [
    [
      'camp_fintech_kyc_brief',
      'Nigerian Fintech Security & NUBAN Guide',
      'PayGate Partner Network',
      'sponsored_learning',
      'Review verified NUBAN transfer protection rules and confirm quiz completion to earn a sponsor-funded reward.',
      'Funded by partner fintech compliance education budget (CPV verified dwell).',
      25.0,
      20,
      1,
    ],
    [
      'camp_telco_promo_audit',
      'Carrier Data Bundle Transparency Survey',
      'Lagos Telecom Index',
      'partner_survey',
      'Verify your current Nigerian mobile network tariff tier and latency feedback for independent telecom benchmarking.',
      'Funded by anonymized telecom QoS research sponsorship.',
      35.0,
      25,
      1,
    ],
    [
      'camp_esports_showcase',
      'Tactical Mobile Esports Tournament Briefing',
      'West Africa Arena',
      'sponsored_media',
      'Engage with the seasonal mobile esports bracket rules and anti-cheat verification briefing.',
      'Funded by tournament sponsor ad impression allocation.',
      20.0,
      15,
      1,
    ],
    [
      'camp_bandwidth_consent_check',
      'Opt-In Residential Bandwidth Disclosure Audit',
      'Sub Trafficker Compliance',
      'network_disclosure',
      'Complete the ISP & legal compliance check explaining why browser background traffic cannot bypass carrier NAT or generate cash.',
      'Platform transparency bonus funded from ad revenue pool.',
      15.0,
      15,
      1,
    ],
  ];

  const tx = sqlite.transaction(() => {
    for (const c of campaigns) {
      insertCampaign.run(...c);
    }
  });
  tx();
}

initDatabase();
