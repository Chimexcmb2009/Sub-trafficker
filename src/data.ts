/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ISPConfig } from './types';

function makeCarrierSvg(label: string, bg: string, fg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="20" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="22" fill="${fg}">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const NIGERIAN_ISPS: ISPConfig[] = [
  {
    name: 'MTN',
    color: '#FACC15',
    badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    rate: 0.85,
    trafficRate: 0.15,
    logo: makeCarrierSvg('MTN', '#FACC15', '#0F172A'),
  },
  {
    name: 'Airtel',
    color: '#EF4444',
    badgeBg: 'bg-red-500/15 text-red-400 border-red-500/30',
    rate: 0.82,
    trafficRate: 0.18,
    logo: makeCarrierSvg('AIR', '#DC2626', '#FFFFFF'),
  },
  {
    name: 'Glo',
    color: '#10B981',
    badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    rate: 0.80,
    trafficRate: 0.20,
    logo: makeCarrierSvg('GLO', '#059669', '#FFFFFF'),
  },
  {
    name: '9mobile',
    color: '#14B8A6',
    badgeBg: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    rate: 0.78,
    trafficRate: 0.22,
    logo: makeCarrierSvg('9MB', '#0F766E', '#FFFFFF'),
  },
];

export const NIGERIAN_BANKS = [
  'Access Bank',
  'First Bank of Nigeria',
  'GTBank (Guaranty Trust Bank)',
  'Zenith Bank',
  'United Bank for Africa (UBA)',
  'Fidelity Bank',
  'Union Bank',
  'Stanbic IBTC Bank',
  'Sterling Bank',
  'Wema Bank (ALAT)',
  'Kuda Bank',
  'OPay',
  'Palmpay',
  'Moniepoint',
  'VFD Microfinance Bank',
];

export const NIGERIAN_BANK_CODES: Record<string, string> = {
  'Access Bank': '044',
  'First Bank of Nigeria': '011',
  'GTBank (Guaranty Trust Bank)': '058',
  'Zenith Bank': '057',
  'United Bank for Africa (UBA)': '033',
  'Fidelity Bank': '070',
  'Union Bank': '032',
  'Stanbic IBTC Bank': '039',
  'Sterling Bank': '050',
  'Wema Bank (ALAT)': '094',
  'Kuda Bank': '50211',
  'OPay': '999992',
  'Palmpay': '999991',
  'Moniepoint': '50515',
  'VFD Microfinance Bank': '566',
};

export const AVATAR_TEMPLATES = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Chijioke',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Tunde',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Francisca',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Olawale',
];
