import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Check,
  X,
  Edit3,
  AlertTriangle,
  Play,
  Loader2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { ProposalItem } from '../types/index.ts';

interface ReviewPlanViewProps {
  proposals: ProposalItem[];
  isExecuting: boolean;
  onUpdateProposal: (
    id: string,
    updates: { status?: string; targetRelativePath?: string; proposedFilename?: string }
  ) => Promise<void>;
  onExecute: (approvedIds: string[]) => Promise<void>;
  onNavigateToHistory: () => void;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export const ReviewPlanView: React.FC<ReviewPlanViewProps> = ({
  proposals,
  isExecuting,
  onUpdateProposal,
  onExecute,
}) => {
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTargetPath, setEditTargetPath] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (filter === 'all') return true;
      return p.status === filter;
    });
  }, [proposals, filter]);

  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const approvedCount = proposals.filter((p) => p.status === 'approved').length;
  const collisionCount = proposals.filter((p) => p.conflictWarning).length;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredProposals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProposals.map((p) => p.id)));
    }
  };

  const handleApprove = async (id: string) => {
    await onUpdateProposal(id, { status: 'approved' });
  };

  const handleReject = async (id: string) => {
    await onUpdateProposal(id, { status: 'rejected' });
  };

  const handleBatchApprove = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await onUpdateProposal(id, { status: 'approved' });
    }
    setSelectedIds(new Set());
  };

  const handleBatchReject = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await onUpdateProposal(id, { status: 'rejected' });
    }
    setSelectedIds(new Set());
  };

  const handleStartEdit = (proposal: ProposalItem) => {
    setEditingId(proposal.id);
    setEditTargetPath(proposal.targetRelativePath);
  };

  const handleSaveEdit = async (id: string) => {
    const filename = editTargetPath.split('/').pop() || '';
    await onUpdateProposal(id, {
      targetRelativePath: editTargetPath,
      proposedFilename: filename,
    });
    setEditingId(null);
  };

  const handleExecuteConfirmed = async () => {
    setShowConfirmModal(false);
    const toExecute = proposals
      .filter((p) => p.status === 'approved' || (selectedIds.has(p.id) && p.status !== 'rejected'))
      .map((p) => p.id);
    if (toExecute.length > 0) {
      await onExecute(toExecute);
    }
  };

  const approvedToExecuteCount = proposals.filter(
    (p) => p.status === 'approved' || selectedIds.has(p.id)
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#172548]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-white font-sans tracking-tight flex items-center gap-2">
              <span>Plan</span>
              <span className="text-xs font-mono font-medium text-[#ff7f24]">
                · {proposals.length} Items
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review proposed moves before applying changes.
          </p>
        </div>

        {/* Primary Execution Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isExecuting || approvedToExecuteCount === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-[#ff6a00] hover:from-orange-500 hover:to-[#ff7f24] active:scale-95 disabled:opacity-40 text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-600/30 hover:shadow-[0_0_20px_rgba(255,106,0,0.55)] border border-orange-400/40 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Execute ({approvedToExecuteCount})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Collision Alert if any */}
      {collisionCount > 0 && (
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 text-xs text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Collision protection active: {collisionCount} target file{collisionCount > 1 ? 's' : ''} will use unique suffixes to prevent overwrites.
          </span>
        </div>
      )}

      {/* Filter Tabs & Selection Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'pending', label: 'Pending', count: pendingCount },
              { id: 'approved', label: 'Approved', count: approvedCount },
              { id: 'all', label: 'All', count: proposals.length },
            ] as const
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
                  filter === t.id ? 'bg-black/40 text-white' : 'bg-[#152347] text-slate-300 border border-[#213566]'
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Batch Selection Controls */}
        {filteredProposals.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1.5 rounded-lg border border-[#1b2d56] bg-[#0a1226] text-slate-300 hover:text-white font-semibold transition-colors cursor-pointer"
            >
              {selectedIds.size === filteredProposals.length ? 'Deselect All' : 'Select All'}
            </button>

            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={handleBatchApprove}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold hover:bg-emerald-500/30 transition-colors cursor-pointer"
                >
                  Approve ({selectedIds.size})
                </button>
                <button
                  onClick={handleBatchReject}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Reject ({selectedIds.size})
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Proposals List */}
      {proposals.length === 0 ? (
        <div className="rounded-2xl border border-[#1b2d56] bg-[#080e22] p-12 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-orange-500/20 text-[#ff6a00] flex items-center justify-center mx-auto border border-orange-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">
            No plan created yet
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Go to Files and click &ldquo;Organize&rdquo; to generate a plan with local AI.
          </p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="rounded-2xl border border-[#1b2d56] bg-[#080e22] p-8 text-center text-xs text-slate-400">
          No items match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProposals.map((proposal) => {
            const isSelected = selectedIds.has(proposal.id);
            const isEditing = editingId === proposal.id;

            return (
              <div
                key={proposal.id}
                className={`rounded-2xl border transition-all p-4 sm:p-5 bg-[#080e22] shadow-md shadow-black/30 ${
                  proposal.status === 'approved'
                    ? 'border-emerald-500/50 bg-[#081525]/90 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                    : proposal.status === 'rejected'
                    ? 'border-[#17223b] opacity-60'
                    : 'border-[#1b2d56] hover:border-orange-500/50 hover:bg-[#0c1633]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Checkbox & File Details */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(proposal.id)}
                      className="mt-1 h-4 w-4 rounded text-orange-600 focus:ring-orange-500 border-slate-700 bg-[#0a1228] cursor-pointer"
                    />

                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Category & Status Pills */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/35">
                          {proposal.category}
                        </span>

                        {proposal.status === 'approved' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Approved</span>
                          </span>
                        )}

                        {proposal.status === 'rejected' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            Rejected
                          </span>
                        )}

                        {proposal.conflictWarning && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1" title={proposal.conflictWarning}>
                            <AlertTriangle className="w-3 h-3" />
                            <span>Collision Safe</span>
                          </span>
                        )}
                      </div>

                      {/* Source to Destination Comparison */}
                      <div className="flex flex-col md:flex-row md:items-center gap-2 pt-1 font-mono text-xs">
                        <div className="bg-[#0b1328] px-3 py-2 rounded-lg border border-[#1b2d56] text-slate-300 truncate max-w-sm">
                          <span className="text-slate-400 text-[10px] block font-sans">CURRENT</span>
                          <span className="font-semibold text-white">
                            {proposal.originalFilename}
                          </span>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {proposal.sourceRelativePath}
                          </span>
                        </div>

                        <div className="text-orange-400 shrink-0 self-center hidden md:block">
                          <ArrowRight className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0 bg-[#0e1938] px-3 py-2 rounded-lg border border-orange-500/30 text-white">
                          <span className="text-orange-400 text-[10px] block font-sans font-bold">
                            NEW
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="text"
                                value={editTargetPath}
                                onChange={(e) => setEditTargetPath(e.target.value)}
                                className="w-full bg-[#070c1e] border border-orange-400 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveEdit(proposal.id)}
                                className="px-2.5 py-1 rounded bg-[#ff6a00] text-white font-sans text-xs font-bold cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-sans text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <span className="font-semibold text-emerald-400 truncate">
                                {proposal.targetRelativePath}
                              </span>
                              <button
                                onClick={() => handleStartEdit(proposal)}
                                className="text-slate-400 hover:text-orange-400 p-1 rounded hover:bg-[#152347] transition-colors shrink-0 cursor-pointer"
                                title="Edit destination"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reason */}
                      <p className="text-xs text-slate-400 font-sans italic pt-0.5">
                        &ldquo;{proposal.reason}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {proposal.status !== 'approved' && (
                      <button
                        onClick={() => handleApprove(proposal.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Approve move"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}

                    {proposal.status !== 'rejected' && (
                      <button
                        onClick={() => handleReject(proposal.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#0e1836] text-slate-400 hover:text-white hover:bg-red-950/30 hover:border-red-500/40 border border-[#1b2d56] text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                        title="Reject move"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-orange-500/40 bg-[#0c152d] p-6 shadow-2xl shadow-black/80 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/20 text-[#ff6a00] border border-orange-500/40 flex items-center justify-center shrink-0">
                  <Play className="w-5 h-5 fill-[#ff6a00]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-sans">
                    Apply Changes?
                  </h3>
                  <p className="text-xs text-slate-400">
                    Executing {approvedToExecuteCount} approved move{approvedToExecuteCount === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#070c1e] border border-[#172548] text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Reversible with 1-click undo</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Files are moved atomically. Every change is logged in History.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#1b2d56] bg-[#080e22] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteConfirmed}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-[#ff6a00] hover:from-orange-500 hover:to-[#ff7f24] text-white text-xs font-bold shadow-lg shadow-orange-500/30 border border-orange-400/40 transition-all cursor-pointer"
                >
                  Confirm &amp; Move
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
