/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Calendar, Inbox, Search, Signal } from 'lucide-react';
import { Transaction } from '../types';

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const [filterType, setFilterType] = useState<'all' | 'airtime_convert' | 'withdrawal' | 'traffic_cashout'>('all');
  const [search, setSearch] = useState('');

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const filtered = sortedTransactions.filter((tx) => {
    const matchesFilter = filterType === 'all' || tx.type === filterType;
    const q = search.toLowerCase();
    const matchesSearch =
      tx.networkOrIsp.toLowerCase().includes(q) ||
      tx.referenceDetails.toLowerCase().includes(q) ||
      tx.id.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-6 space-y-5" id="transaction-history-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">Transaction History</h3>
          <p className="text-xs text-slate-400">
            Audited record of airtime conversions, sponsored engagement rewards, and verified bank payouts.
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference or network..."
            className="w-full min-h-[42px] rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'airtime_convert', 'withdrawal', 'traffic_cashout'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilterType(type)}
            className={`min-h-[40px] rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap border transition ${
              filterType === type
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            {type === 'all' && 'All Activity'}
            {type === 'airtime_convert' && 'Airtime Swaps'}
            {type === 'withdrawal' && 'Bank Payouts'}
            {type === 'traffic_cashout' && 'Sponsored Rewards'}
          </button>
        ))}
      </div>

      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-xl">
            <Inbox className="w-8 h-8 text-slate-600" />
            <p className="text-xs">No matching transactions found yet.</p>
          </div>
        ) : (
          filtered.map((tx) => {
            const isCredit = tx.type === 'airtime_convert' || tx.type === 'traffic_cashout';
            const formattedDate = new Date(tx.timestamp).toLocaleString('en-NG', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={tx.id}
                className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2.5 rounded-xl border shrink-0 ${
                      tx.type === 'airtime_convert'
                        ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                        : tx.type === 'withdrawal'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {tx.type === 'airtime_convert' && <ArrowDownLeft className="w-4 h-4" />}
                    {tx.type === 'withdrawal' && <ArrowUpRight className="w-4 h-4" />}
                    {tx.type === 'traffic_cashout' && <Signal className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {tx.type === 'airtime_convert' && 'Airtime to Cash'}
                      {tx.type === 'withdrawal' && 'Bank Payout'}
                      {tx.type === 'traffic_cashout' && 'Sponsored Engagement Reward'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {tx.networkOrIsp} • {tx.referenceDetails}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold font-mono tabular-nums ${isCredit ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {isCredit ? '+' : '-'}₦{Number(tx.receivedAmount || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-500 inline-flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3" /> {formattedDate}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
