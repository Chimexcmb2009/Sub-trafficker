/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Transaction } from '../types';
import { Search, ArrowDownLeft, ArrowUpRight, Signal, AlertCircle, Calendar, CreditCard } from 'lucide-react';

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const [filterType, setFilterType] = useState<'all' | 'airtime_convert' | 'withdrawal' | 'traffic_cashout'>('all');
  const [search, setSearch] = useState('');

  // Sort: newest first
  const sortedTransactions = [...transactions].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const filtered = sortedTransactions.filter(tx => {
    const matchesFilter = filterType === 'all' || tx.type === filterType;
    const matchesSearch = tx.networkOrIsp.toLowerCase().includes(search.toLowerCase()) || 
                          tx.referenceDetails.toLowerCase().includes(search.toLowerCase()) ||
                          tx.id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden" id="transaction-history-panel">
      {/* Header & Filter Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-bold font-display text-slate-800 text-lg">Transaction History</h3>
          <p className="text-slate-500 text-xs">Full history of airtime conversions, data sharing rewards, and withdrawals</p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition text-xs"
            id="search-transactions-input"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100 pb-4 mb-4 overflow-x-auto">
        {(['all', 'airtime_convert', 'withdrawal', 'traffic_cashout'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${filterType === type ? 'bg-slate-100 text-blue-600 border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
            id={`filter-tx-${type}`}
          >
            {type === 'all' && 'All Activity'}
            {type === 'airtime_convert' && 'Airtime Swaps'}
            {type === 'withdrawal' && 'Withdrawals'}
            {type === 'traffic_cashout' && 'Data Sharing'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center text-slate-400 space-y-2">
            <AlertCircle size={32} className="text-slate-300 animate-pulse" />
            <p className="text-sm">No transactions found matching the selected filters.</p>
          </div>
        ) : (
          filtered.map((tx) => {
            const isCredit = tx.type === 'airtime_convert' || tx.type === 'traffic_cashout';
            const formattedDate = new Date(tx.timestamp).toLocaleString('en-NG', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div 
                key={tx.id}
                className="p-4 bg-slate-50/50 border border-slate-100 hover:bg-slate-50 hover:border-slate-250 rounded-2xl flex items-center justify-between transition-all"
                id={`tx-item-${tx.id}`}
              >
                {/* Left: Type Icon + Info */}
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${tx.type === 'airtime_convert' ? 'bg-blue-50 border-blue-100 text-blue-600' : tx.type === 'withdrawal' ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                    {tx.type === 'airtime_convert' && <ArrowDownLeft size={18} />}
                    {tx.type === 'withdrawal' && <ArrowUpRight size={18} />}
                    {tx.type === 'traffic_cashout' && <Signal size={18} />}
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      {tx.type === 'airtime_convert' && 'Airtime to Cash'}
                      {tx.type === 'withdrawal' && 'Bank Payout'}
                      {tx.type === 'traffic_cashout' && 'Cellular Harvesting'}
                      <span className="text-[10px] font-normal text-slate-400 font-mono">({tx.id})</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {tx.networkOrIsp} • {tx.referenceDetails}
                    </p>
                  </div>
                </div>

                {/* Right: Amount & Timestamp */}
                <div className="text-right space-y-1">
                  <p className={`text-sm font-bold font-mono ${isCredit ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {isCredit ? '+' : '-'} ₦{tx.receivedAmount.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400 flex items-center justify-end gap-1 font-mono">
                    <Calendar size={10} />
                    {formattedDate}
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
