import React, { useState } from 'react';
import {
  RotateCcw,
  ArrowRight,
  Loader2,
  AlertCircle,
  History,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { OperationHistoryItem } from '../types/index.ts';
import { formatBytes, formatRelativeTime } from '../utils/format.ts';

interface ActivityHistoryViewProps {
  history: OperationHistoryItem[];
  isUndoing: boolean;
  onUndo: (operationId: string) => Promise<void>;
  onRefreshHistory: () => Promise<void>;
  onClearHistory?: () => Promise<void>;
}

type FilterTab = 'all' | 'success' | 'undone';

export const ActivityHistoryView: React.FC<ActivityHistoryViewProps> = ({
  history,
  isUndoing,
  onUndo,
  onRefreshHistory,
  onClearHistory,
}) => {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const filteredHistory = history.filter((item) => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const handleClearHistory = async () => {
    if (!onClearHistory) return;
    if (!window.confirm('Clear all operation history from database?')) return;
    setIsClearing(true);
    try {
      await onClearHistory();
    } catch (err: any) {
      setUndoError(err.message || 'Failed to clear history');
    } finally {
      setIsClearing(false);
    }
  };

  const handleUndoClick = async (opId: string) => {
    setUndoingId(opId);
    setUndoError(null);
    try {
      await onUndo(opId);
    } catch (err: any) {
      setUndoError(err.message || 'Failed to undo');
    } finally {
      setUndoingId(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshHistory();
    } finally {
      setIsRefreshing(false);
    }
  };

  const activeCount = history.filter((h) => h.status === 'success').length;
  const undoneCount = history.filter((h) => h.status === 'undone').length;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#172548]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white font-sans tracking-tight flex items-center gap-2">
              <span>History</span>
              <span className="text-xs font-mono font-medium text-[#ff7f24]">
                · {history.length} Actions
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Past file moves and changes. Click undo to revert any move instantly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && onClearHistory && (
            <button
              onClick={handleClearHistory}
              disabled={isClearing}
              className="px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-950/20 text-xs font-semibold text-red-300 hover:text-white hover:border-red-500/60 hover:bg-red-950/40 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>{isClearing ? 'Clearing...' : 'Clear History'}</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl border border-[#1b2d56] bg-[#0c152d] text-xs font-semibold text-slate-300 hover:text-white hover:border-orange-500/50 hover:bg-[#122046] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {undoError && (
        <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{undoError}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all' as FilterTab, label: 'All', count: history.length },
              { id: 'success' as FilterTab, label: 'Active', count: activeCount },
              { id: 'undone' as FilterTab, label: 'Undone', count: undoneCount },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                filter === t.id
                  ? 'bg-gradient-to-r from-orange-600 to-[#ff6a00] text-white border-orange-400/50 shadow-[0_0_12px_rgba(255,106,0,0.4)]'
                  : 'bg-[#0a1226] text-slate-300 hover:text-white border-[#1b2d56] hover:bg-[#101c3d]'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  filter === t.id
                    ? 'bg-black/40 text-white'
                    : 'bg-[#152347] text-slate-300 border border-[#213566]'
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Timeline List */}
      {filteredHistory.length === 0 ? (
        <div className="rounded-2xl border border-[#1b2d56] bg-[#080e22] p-12 text-center space-y-3 shadow-md">
          <div className="h-12 w-12 rounded-2xl bg-[#0c152d] text-slate-400 border border-[#1a2b50] flex items-center justify-center mx-auto">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">
            No history recorded
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Executed file reorganizations will appear here with instant 1-click undo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            const isUndone = item.status === 'undone';
            const isFailed = item.status === 'failed';
            const isThisUndoing = isUndoing && undoingId === item.id;
            const sourceFilename = item.sourcePath.split('/').pop() || item.sourcePath;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 sm:p-5 bg-[#080e22] shadow-md shadow-black/30 transition-all ${
                  isUndone
                    ? 'border-[#152038] opacity-65 bg-[#070c1a]'
                    : isFailed
                    ? 'border-red-500/40 bg-red-950/15'
                    : 'border-[#1b2d56] hover:border-orange-500/40 hover:bg-[#0c1633]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Operation Details */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Operation Type */}
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/40">
                        {item.operationType}
                      </span>

                      {/* Status */}
                      {item.status === 'success' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Success</span>
                        </span>
                      )}

                      {isUndone && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Undone
                        </span>
                      )}

                      {isFailed && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                          Failed
                        </span>
                      )}

                      <span className="text-xs text-slate-400 font-mono">
                        {formatBytes(item.fileSize)}
                      </span>

                      <span className="text-xs text-slate-400 font-sans ml-auto sm:ml-0">
                        {formatRelativeTime(item.executedAt)}
                      </span>
                    </div>

                    {/* Path Changes */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-mono pt-1">
                      <div className="bg-[#0b1328] px-3 py-1.5 rounded-lg border border-[#1b2d56] text-slate-300 truncate max-w-sm">
                        <span className="text-slate-400 text-[9px] block font-sans">FROM</span>
                        <span className="font-semibold text-white block truncate">
                          {sourceFilename}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {item.sourcePath}
                        </span>
                      </div>

                      {item.destinationPath && (
                        <>
                          <div className="text-orange-400 shrink-0 self-center hidden sm:block">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>

                          <div className="flex-1 min-w-0 bg-[#0e1938] px-3 py-1.5 rounded-lg border border-orange-500/25 text-white">
                            <span className="text-orange-400 text-[9px] block font-sans font-bold">
                              TO
                            </span>
                            <span className="font-semibold text-emerald-400 block truncate">
                              {item.destinationPath}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Undone Timestamp */}
                    {item.undoneAt && (
                      <p className="text-[11px] text-slate-400 italic">
                        Reverted back on {new Date(item.undoneAt).toLocaleTimeString()}
                      </p>
                    )}

                    {/* Error Message */}
                    {item.errorMessage && (
                      <div className="p-2 rounded bg-red-950/30 border border-red-500/30 text-[11px] text-red-300">
                        Error: {item.errorMessage}
                      </div>
                    )}
                  </div>

                  {/* Right: Undo Action Button */}
                  {item.status === 'success' && (
                    <div className="shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleUndoClick(item.id)}
                        disabled={isThisUndoing}
                        className="px-3.5 py-1.5 rounded-xl border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/25 text-[#ff7f24] hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-[0_0_12px_rgba(255,106,0,0.4)] disabled:opacity-40 cursor-pointer"
                        title="Revert this move"
                      >
                        {isThisUndoing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Undoing...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Undo Move</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
