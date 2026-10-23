import React, { useState } from 'react';
import {
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import type { DuplicateGroup } from '../types/index.ts';
import { formatBytes, formatRelativeTime } from '../utils/format.ts';

interface DuplicatesViewProps {
  duplicateGroups: DuplicateGroup[];
  onNavigateToWorkspace: () => void;
}

export const DuplicatesView: React.FC<DuplicatesViewProps> = ({
  duplicateGroups,
  onNavigateToWorkspace,
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [expandedHashes, setExpandedHashes] = useState<Set<string>>(
    new Set(duplicateGroups.map((g) => g.hash))
  );

  const redundantBytes = duplicateGroups.reduce(
    (acc, g) => acc + (g.files.length - 1) * g.sizeBytes,
    0
  );

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1800);
  };

  const toggleExpand = (hash: string) => {
    const next = new Set(expandedHashes);
    if (next.has(hash)) {
      next.delete(hash);
    } else {
      next.add(hash);
    }
    setExpandedHashes(next);
  };

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#172548]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white font-sans tracking-tight flex items-center gap-2">
              <span>Duplicates</span>
              <span className="text-xs font-mono font-medium text-amber-400">
                · {duplicateGroups.length} Groups
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Identical files found by content hash.
          </p>
        </div>

        {/* Wasted Storage Metric */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">
              Wasted Space
            </span>
            <span className="text-lg sm:text-2xl font-black text-amber-400 font-mono-numbers drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]">
              {formatBytes(redundantBytes)}
            </span>
          </div>
          <button
            onClick={onNavigateToWorkspace}
            className="px-3.5 py-2 rounded-xl border border-[#1b2d56] bg-[#0c152d] text-xs font-semibold text-slate-300 hover:text-white hover:border-orange-500/50 hover:bg-[#122046] transition-all shadow-xs cursor-pointer"
          >
            View in Files
          </button>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/25 to-[#0c152d] border border-amber-500/35 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-xs text-slate-300">
          <span className="font-bold text-amber-300 mr-1.5">Zero Silent Deletions:</span>
          Duplicates are never deleted automatically. Review identical copies below.
        </p>
      </div>

      {/* Duplicate Groups List */}
      {duplicateGroups.length === 0 ? (
        <div className="rounded-2xl border border-[#1b2d56] bg-[#080e22] p-12 text-center space-y-3 shadow-md">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">
            No duplicates found
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            All files in this folder have unique contents.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {duplicateGroups.map((group, idx) => {
            const isExpanded = expandedHashes.has(group.hash);
            const groupWasted = (group.files.length - 1) * group.sizeBytes;

            return (
              <div
                key={group.hash}
                className="rounded-2xl border border-[#1b2d56] bg-[#080e22] overflow-hidden shadow-lg shadow-black/30 transition-all hover:border-amber-500/40"
              >
                {/* Group Summary Header */}
                <div
                  onClick={() => toggleExpand(group.hash)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#0c1633] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      className="p-1 rounded text-slate-400 hover:text-white"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">
                          Group #{idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {group.files.length} Copies
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {formatBytes(group.sizeBytes)} each
                        </span>
                      </div>
                      <span className="text-xs text-amber-400/90 font-mono block mt-0.5">
                        Wasting {formatBytes(groupWasted)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyHash(group.hash);
                      }}
                      className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200 bg-[#0a1226] border border-[#1a2b50] hover:border-slate-500 transition-colors"
                      title="Copy SHA-256 Hash"
                    >
                      {copiedHash === group.hash ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{group.hash.slice(0, 10)}...</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded File List */}
                {isExpanded && (
                  <div className="border-t border-[#152342] bg-[#070c1e] divide-y divide-[#131f3c]">
                    {group.files.map((file, fileIdx) => (
                      <div
                        key={file.id || file.relativePath}
                        className="p-3.5 sm:px-5 flex items-center justify-between gap-4 text-xs hover:bg-[#0c152d] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-[#0d1730] text-slate-400 border border-[#1a2b50]">
                            {fileIdx === 0 ? 'Original' : `Copy ${fileIdx}`}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-200 block truncate">
                              {file.filename}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 block truncate">
                              {file.relativePath}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-slate-400 font-sans block text-[11px]">
                            {formatRelativeTime(file.modifiedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
