import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, HardDrive, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { assetManager, AssetPackManifestEntry } from '../lib/assetManager';

interface AssetCacheModalProps {
  onClose: () => void;
}

export const AssetCacheModal: React.FC<AssetCacheModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    packs: Array<AssetPackManifestEntry & { cached: boolean; sizeBytes: number; sha256?: string; storedAt?: string }>;
    totalCachedBytes: number;
    quotaUsageBytes?: number;
    quotaLimitBytes?: number;
  } | null>(null);

  const refresh = async () => {
    setLoading(true);
    const data = await assetManager.getStatusOverview();
    setStatus(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDownloadPack = async (entry: AssetPackManifestEntry) => {
    setBusyId(entry.id);
    await assetManager.downloadOrVerifyPack(entry);
    setBusyId(null);
    await refresh();
  };

  const handleClearAll = async () => {
    setBusyId('all');
    await assetManager.clearAllAssets();
    setBusyId(null);
    await refresh();
  };

  const handleSyncAll = async () => {
    setBusyId('sync');
    await assetManager.ensureBootAssets();
    setBusyId(null);
    await refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-white">Local 3D Asset Storage &amp; Cache</h2>
              <p className="text-xs text-slate-400">
                Assets are stored once in IndexedDB + Cache Storage and verified via SHA-256 checksums so subsequent launches start instantly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !status ? (
          <div className="h-48 rounded-2xl skeleton-shimmer border border-slate-800" />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
                <p className="text-[11px] text-slate-400">Cached 3D Assets</p>
                <p className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                  {(status.totalCachedBytes / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
                <p className="text-[11px] text-slate-400">Browser Origin Storage</p>
                <p className="text-base font-bold font-mono text-white mt-0.5">
                  {status.quotaUsageBytes ? `${(status.quotaUsageBytes / (1024 * 1024)).toFixed(2)} MB` : 'IndexedDB Active'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5">
                <p className="text-[11px] text-slate-400">Manifest Version</p>
                <p className="text-base font-bold font-mono text-amber-400 mt-0.5">v2.4.0</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {status.packs.map((pack) => (
                <div
                  key={pack.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{pack.name}</span>
                      <span className="text-[11px] font-mono text-slate-500">v{pack.version}</span>
                    </div>
                    <p className="text-xs text-slate-400">{pack.description}</p>
                    {pack.cached && pack.sha256 && (
                      <p className="text-[11px] font-mono text-emerald-400">
                        SHA-256: {pack.sha256.slice(0, 16)}... ({(pack.sizeBytes / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadPack(pack)}
                    disabled={busyId !== null}
                    className={`min-h-[42px] rounded-xl px-3.5 text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 ${
                      pack.cached
                        ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    {busyId === pack.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : pack.cached ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {pack.cached ? 'Verified' : 'Cache Locally'}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={busyId !== null}
                className="min-h-[44px] flex-1 rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400 inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${busyId === 'sync' ? 'animate-spin' : ''}`} />
                Verify &amp; Sync Required Packs
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={busyId !== null}
                className="min-h-[44px] rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-xs font-bold text-red-200 hover:bg-red-500/20 inline-flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear Local Cache
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
