import React, { useMemo } from 'react';
import {
  PieChart,
  HardDrive,
  Copy,
  Sparkles,
  ArrowRight,
  Eye,
  FolderTree,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { ScannedFileInfo, DuplicateGroup } from '../types/index.ts';
import { formatBytes } from '../utils/format.ts';

interface StorageVisualizerProps {
  files: ScannedFileInfo[];
  duplicateGroups: DuplicateGroup[];
  totalBytes: number;
  onInspectFile: (file: ScannedFileInfo) => void;
  onNavigateToDuplicates: () => void;
  onNavigateToProposals: () => void;
}

interface CategorySlice {
  id: string;
  label: string;
  color: string;
  bgClass: string;
  bytes: number;
  count: number;
  percentage: number;
}

export const StorageVisualizer: React.FC<StorageVisualizerProps> = ({
  files,
  duplicateGroups,
  totalBytes,
  onInspectFile,
  onNavigateToDuplicates,
  onNavigateToProposals,
}) => {
  // 1. Calculate Category Distributions
  const categories = useMemo<CategorySlice[]>(() => {
    const map: Record<string, { bytes: number; count: number; color: string; bgClass: string }> = {
      Documents: { bytes: 0, count: 0, color: '#10b981', bgClass: 'bg-emerald-500' },
      Images: { bytes: 0, count: 0, color: '#3b82f6', bgClass: 'bg-blue-500' },
      Code: { bytes: 0, count: 0, color: '#06b6d4', bgClass: 'bg-cyan-500' },
      Spreadsheets: { bytes: 0, count: 0, color: '#14b8a6', bgClass: 'bg-teal-500' },
      Media: { bytes: 0, count: 0, color: '#a855f7', bgClass: 'bg-purple-500' },
      Archives: { bytes: 0, count: 0, color: '#f59e0b', bgClass: 'bg-amber-500' },
      Other: { bytes: 0, count: 0, color: '#64748b', bgClass: 'bg-slate-500' },
    };

    for (const f of files) {
      const ext = (f.extension || '').toLowerCase();
      if (['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt'].includes(ext)) {
        map.Documents.bytes += f.sizeBytes;
        map.Documents.count++;
      } else if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.bmp'].includes(ext)) {
        map.Images.bytes += f.sizeBytes;
        map.Images.count++;
      } else if (['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.py', '.rs', '.go', '.sh', '.sql'].includes(ext)) {
        map.Code.bytes += f.sizeBytes;
        map.Code.count++;
      } else if (['.xlsx', '.xls', '.csv', '.tsv', '.ods'].includes(ext)) {
        map.Spreadsheets.bytes += f.sizeBytes;
        map.Spreadsheets.count++;
      } else if (['.mp4', '.mov', '.avi', '.mp3', '.wav', '.flac', '.ogg'].includes(ext)) {
        map.Media.bytes += f.sizeBytes;
        map.Media.count++;
      } else if (['.zip', '.tar', '.gz', '.7z', '.rar', '.bz2'].includes(ext)) {
        map.Archives.bytes += f.sizeBytes;
        map.Archives.count++;
      } else {
        map.Other.bytes += f.sizeBytes;
        map.Other.count++;
      }
    }

    const total = totalBytes > 0 ? totalBytes : 1;

    return Object.entries(map)
      .map(([label, val]) => ({
        id: label.toLowerCase(),
        label,
        color: val.color,
        bgClass: val.bgClass,
        bytes: val.bytes,
        count: val.count,
        percentage: Math.round((val.bytes / total) * 100),
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.bytes - a.bytes);
  }, [files, totalBytes]);

  // 2. Top 5 Heaviest Files
  const largestFiles = useMemo(() => {
    return [...files].sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 5);
  }, [files]);

  // 3. Duplicate waste
  const redundantBytes = useMemo(() => {
    return duplicateGroups.reduce(
      (acc, g) => acc + (g.files.length - 1) * g.sizeBytes,
      0
    );
  }, [duplicateGroups]);

  // 4. Loose Root vs Structured Subfolders
  const looseRootCount = useMemo(() => {
    return files.filter((f) => !f.relativePath.includes('/')).length;
  }, [files]);

  const organizedPercent =
    files.length > 0 ? Math.round(((files.length - looseRootCount) / files.length) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Category Footprint Breakdown */}
      <div className="rounded-2xl border border-[#1b2d56] bg-[#080e22] p-5 sm:p-6 shadow-xl shadow-black/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white font-sans flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#ff6a00]" />
              <span>Storage Footprint by Category</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visual proportion of space consumed by different file formats
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-cyan-400">
            Total {formatBytes(totalBytes)} ({files.length} files)
          </span>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-[#050814] border border-[#162447] p-0.5">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`${cat.bgClass} h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full hover:brightness-125 cursor-pointer`}
              style={{ width: `${Math.max(2, cat.percentage)}%` }}
              title={`${cat.label}: ${formatBytes(cat.bytes)} (${cat.percentage}%)`}
            />
          ))}
        </div>

        {/* Category Legend & Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="p-2.5 rounded-xl border border-[#152345] bg-[#060a17] space-y-1"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {cat.label}
                </span>
              </div>
              <div className="text-xs font-bold text-white font-mono">
                {formatBytes(cat.bytes)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {cat.count} files ({cat.percentage}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Heaviest Files + Organization Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Heaviest Files Leaderboard (Span 2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-[#1b2d56] bg-[#080e22] p-5 sm:p-6 shadow-xl shadow-black/40 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span>Largest Files in Workspace</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Top storage consumers that impact disk space the most
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {largestFiles.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No files in current folder.</p>
            ) : (
              largestFiles.map((f, idx) => {
                const ratio = totalBytes > 0 ? (f.sizeBytes / totalBytes) * 100 : 0;
                return (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl border border-[#142347] bg-[#060a17] hover:border-orange-500/40 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-white truncate font-sans group-hover:text-orange-400 transition-colors">
                          {f.filename}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                          · {f.relativePath}
                        </span>
                      </div>

                      {/* File size relative bar */}
                      <div className="w-full bg-[#0d1733] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-[#ff6a00] h-full rounded-full transition-all"
                          style={{ width: `${Math.max(4, Math.min(100, ratio))}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs text-slate-200 font-bold text-right">
                        {formatBytes(f.sizeBytes)}
                      </span>
                      <button
                        onClick={() => onInspectFile(f)}
                        className="p-1.5 rounded-lg border border-[#1b2d56] bg-[#0c152d] text-slate-300 hover:text-white hover:border-orange-500/50 hover:bg-[#122046] transition-all cursor-pointer"
                        title="Inspect file details and preview"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Storage Optimization & Health Card */}
        <div className="rounded-2xl border border-[#1b2d56] bg-[#080e22] p-5 sm:p-6 shadow-xl shadow-black/40 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-emerald-400" />
                <span>Organization Health</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Structural distribution and clutter assessment
              </p>
            </div>

            {/* Metric 1: Structured vs Loose */}
            <div className="p-3.5 rounded-xl border border-[#162447] bg-[#060a17] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Structured in Subfolders</span>
                <span className="font-mono font-bold text-white">{organizedPercent}%</span>
              </div>
              <div className="w-full bg-[#0d1733] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all"
                  style={{ width: `${organizedPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {looseRootCount > 0
                  ? `${looseRootCount} loose files sitting unorganized in the root folder.`
                  : 'All files are categorized into structured subfolders.'}
              </p>
            </div>

            {/* Metric 2: Duplicate Waste */}
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/15 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Duplicate Space Waste</span>
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {formatBytes(redundantBytes)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {duplicateGroups.length > 0
                  ? `${duplicateGroups.length} duplicate groups discovered by streaming SHA-256.`
                  : 'Zero duplicate content discovered across scanned files.'}
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="pt-2">
            {duplicateGroups.length > 0 ? (
              <button
                onClick={onNavigateToDuplicates}
                className="w-full py-2.5 px-4 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Review {duplicateGroups.length} Duplicate Groups</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onNavigateToProposals}
                className="w-full py-2.5 px-4 rounded-xl border border-orange-500/40 bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#ff6a00]" />
                <span>Run Gemini AI Organization</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
