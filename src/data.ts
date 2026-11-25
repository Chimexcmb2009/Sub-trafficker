/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ISPConfig } from './types';

export const NIGERIAN_ISPS: ISPConfig[] = [
  {
    name: 'MTN',
    color: '#F9D915', // Yellow
    badgeBg: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    rate: 0.85, // 85% conversion rate
    trafficRate: 0.15, // 0.15 NGN per MB
    logo: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=100&auto=format&fit=crop&q=60' // Tech geometric
  },
  {
    name: 'Airtel',
    color: '#FF0000', // Red
    badgeBg: 'bg-red-500/10 text-red-500 border-red-500/20',
    rate: 0.82, // 82% conversion rate
    trafficRate: 0.18, // 0.18 NGN per MB
    logo: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=100&auto=format&fit=crop&q=60' // Red abstract
  },
  {
    name: 'Glo',
    color: '#2E8B57', // Green
    badgeBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    rate: 0.80, // 80% conversion rate
    trafficRate: 0.20, // 0.20 NGN per MB
    logo: 'https://images.unsplash.com/photo-1557683311-eac922347aa1?w=100&auto=format&fit=crop&q=60' // Green abstract
  },
  {
    name: '9mobile',
    color: '#006400', // Dark Green
    badgeBg: 'bg-green-600/10 text-green-600 border-green-600/20',
    rate: 0.78, // 78% conversion rate
    trafficRate: 0.22, // 0.22 NGN per MB
    logo: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=100&auto=format&fit=crop&q=60' // Teal abstract
  }
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
  'VFD Microfinance Bank'
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
  'VFD Microfinance Bank': '566'
};

export const AVATAR_TEMPLATES = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Chijioke',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Tunde',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Francisca',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Olawale'
];
