import React, { useState, useMemo, useRef } from 'react';
import {
  Folder,
  Play,
  Sparkles,
  Copy,
  Search,
  Check,
  Loader2,
  FileText,
  Image as ImageIcon,
  Code2,
  Table as TableIcon,
  Archive,
  Film,
  Headphones,
  File,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Layers,
  UploadCloud,
  Eye,
  PieChart,
  List,
} from 'lucide-react';
import type { ScannedFileInfo, DuplicateGroup, WorkspaceStatus } from '../types/index.ts';
import { formatBytes, formatRelativeTime } from '../utils/format.ts';
import { FileInspectorModal } from './FileInspectorModal.tsx';
import { StorageVisualizer } from './StorageVisualizer.tsx';

interface WorkspaceViewProps {
  workspace: WorkspaceStatus;
  scannedFiles: ScannedFileInfo[];
  duplicateGroups: DuplicateGroup[];
  totalBytes: number;
  lastScannedAt: string | null;
  isScanning: boolean;
  isAnalyzing: boolean;
  isUploading?: boolean;
  onScan: () => Promise<void>;
  onAnalyze: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onUploadFiles?: (files: File[]) => Promise<void>;
  onNavigateToDuplicates: () => void;
  onNavigateToProposals: () => void;
  proposalsCount: number;
  configuredModel?: string;
  isAiOnline?: boolean;
}

type CategoryFilter = 'all' | 'documents' | 'images' | 'code' | 'archives' | 'duplicates';
type SortField = 'filename' | 'size' | 'modified';
type SortOrder = 'asc' | 'desc';

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  workspace,
  scannedFiles,
  duplicateGroups,
  totalBytes,
  lastScannedAt,
  isScanning,
  isAnalyzing,
  isUploading = false,
  onScan,
  onAnalyze,
  onDisconnect,
  onUploadFiles,
  onNavigateToDuplicates,
  onNavigateToProposals,
  proposalsCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortField, setSortField] = useState<SortField>('modified');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'visualizer'>('table');
  const [inspectedFile, setInspectedFile] = useState<ScannedFileInfo | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onUploadFiles) {
      onUploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const duplicateHashSet = useMemo(() => {
    return new Set(duplicateGroups.map((g) => g.hash));
  }, [duplicateGroups]);

  const redundantBytes = useMemo(() => {
    return duplicateGroups.reduce(
      (acc, g) => acc + (g.files.length - 1) * g.sizeBytes,
      0
    );
  }, [duplicateGroups]);

  const filteredFiles = useMemo(() => {
    return scannedFiles.filter((file) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = file.filename.toLowerCase().includes(query);
        const matchesPath = file.relativePath.toLowerCase().includes(query);
        if (!matchesName && !matchesPath) return false;
      }

      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'duplicates') {
        const fileHash = file.sha256Hash || file.sha256;
        return Boolean(fileHash && duplicateHashSet.has(fileHash));
      }

      const ext = (file.extension || '').toLowerCase();
      if (categoryFilter === 'documents') {
        return ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt', '.csv', '.xlsx'].includes(ext);
      }
      if (categoryFilter === 'images') {
        return ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.mp4', '.mov'].includes(ext);
      }
      if (categoryFilter === 'code') {
        return ['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.py', '.go', '.rs'].includes(ext);
      }
      if (categoryFilter === 'archives') {
        return ['.zip', '.tar', '.gz', '.7z', '.rar', '.bz2'].includes(ext);
      }
      return true;
    });
  }, [scannedFiles, searchQuery, categoryFilter, duplicateHashSet]);

  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'filename') {
        comparison = a.filename.localeCompare(b.filename);
      } else if (sortField === 'size') {
        comparison = a.sizeBytes - b.sizeBytes;
      } else if (sortField === 'modified') {
        comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredFiles, sortField, sortOrder]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1800);
  };

  const getFileBadge = (ext: string) => {
    const e = ext.toLowerCase();
    if (['.pdf', '.doc', '.docx', '.txt', '.md'].includes(e)) {
      return {
        icon: <FileText className="w-4 h-4 text-emerald-400" />,
        color: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
        label: 'DOC',
      };
    }
    if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(e)) {
      return {
        icon: <ImageIcon className="w-4 h-4 text-blue-400" />,
        color: 'bg-blue-950/60 text-blue-300 border-blue-500/40',
        label: 'IMG',
      };
    }
    if (['.mp4', '.mkv', '.mov', '.avi'].includes(e)) {
      return {
        icon: <Film className="w-4 h-4 text-purple-400" />,
        color: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
        label: 'VID',
      };
    }
    if (['.mp3', '.wav', '.flac', '.ogg'].includes(e)) {
      return {
        icon: <Headphones className="w-4 h-4 text-pink-400" />,
        color: 'bg-pink-950/60 text-pink-300 border-pink-500/40',
        label: 'AUD',
      };
    }
    if (['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.py', '.rs', '.go'].includes(e)) {
      return {
        icon: <Code2 className="w-4 h-4 text-cyan-400" />,
        color: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40',
        label: 'CODE',
      };
    }
    if (['.csv', '.xlsx', '.xls'].includes(e)) {
      return {
        icon: <TableIcon className="w-4 h-4 text-teal-400" />,
        color: 'bg-teal-950/60 text-teal-300 border-teal-500/40',
        label: 'DATA',
      };
    }
    if (['.zip', '.tar', '.gz', '.7z', '.rar'].includes(e)) {
      return {
        icon: <Archive className="w-4 h-4 text-amber-400" />,
        color: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
        label: 'ZIP',
      };
    }
    return {
      icon: <File className="w-4 h-4 text-slate-400" />,
      color: 'bg-slate-900 text-slate-300 border-slate-700',
      label: ext.replace('.', '').toUpperCase() || 'FILE',
    };
  };

  const totalCount = scannedFiles.length;
  const organizedEstimate = totalCount > 0 ? Math.max(0, totalCount - proposalsCount) : 0;
  const progressPercent = totalCount > 0 ? Math.round((organizedEstimate / totalCount) * 100) : 100;

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header Card */}
      <div className="relative rounded-2xl border border-[#1b2d56] bg-gradient-to-b from-[#0c152d] to-[#080e22] p-5 sm:p-6 shadow-xl shadow-black/40 overflow-hidden">
        {/* Glowing corner accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-orange-500/10 via-cyan-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Workspace Status */}
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <HardDrive className="w-4 h-4 text-[#ff6a00] shrink-0" />
              <span className="font-semibold text-slate-200 bg-[#060a17] px-2.5 py-1 rounded-md border border-[#17274f] flex items-center gap-1.5 font-mono text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <span>Active Local Workspace</span>
              </span>
              <button
                onClick={onDisconnect}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors hover:underline shrink-0 ml-1 cursor-pointer"
                title="Clear current workspace session"
              >
                Clear / New Session
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white font-sans tracking-tight flex items-center gap-2">
                  <span>Files</span>
                  <span className="text-xs font-mono font-medium text-emerald-400">
                    · Connected
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span>
                    {lastScannedAt ? `Updated ${formatRelativeTime(lastScannedAt)}` : 'Ready to scan'}
                  </span>
                  <span>·</span>
                  <span className="font-mono text-cyan-400">
                    {scannedFiles.length} files ({formatBytes(totalBytes)})
                  </span>
                </p>
              </div>

              {/* Progress Percentage */}
              <div className="text-right shrink-0">
                <span className="text-2xl sm:text-3xl font-black text-[#ff6a00] font-mono-numbers drop-shadow-[0_0_12px_rgba(255,106,0,0.5)]">
                  {progressPercent}%
                </span>
                <span className="text-[11px] font-bold text-slate-400 block tracking-wider uppercase">
                  Organized
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#060a17] h-3 rounded-full overflow-hidden border border-[#182649] p-0.5">
              <div
                className="bg-gradient-to-r from-orange-600 via-[#ff6a00] to-amber-400 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(255,106,0,0.6)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            {/* Upload Real Files */}
            {onUploadFiles && (
              <>
                <input
                  type="file"
                  multiple
                  ref={uploadInputRef}
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isScanning || isAnalyzing || isUploading}
                  className="flex-1 sm:flex-none px-4 py-3 rounded-xl border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/25 text-orange-300 hover:text-white active:scale-95 disabled:opacity-50 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  title="Upload real files from your PC into this workspace folder"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 text-orange-400" />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              </>
            )}

            {/* Primary Action: Scan */}
            <button
              onClick={onScan}
              disabled={isScanning || isAnalyzing || isUploading}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-[#ff6a00] hover:from-orange-500 hover:to-[#ff7f24] active:scale-95 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-600/30 hover:shadow-[0_0_25px_rgba(255,106,0,0.6)] border border-orange-400/40 transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white group-hover:scale-110 transition-transform" />
                  <span>Scan</span>
                </>
              )}
            </button>

            {/* Secondary Action: Organize */}
            <button
              onClick={onAnalyze}
              disabled={isScanning || isAnalyzing || scannedFiles.length === 0}
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl border border-cyan-500/40 bg-[#0c1a38] text-cyan-300 hover:bg-[#11244d] hover:border-cyan-400 hover:text-white active:scale-98 disabled:opacity-50 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-black/40 hover:shadow-[0_0_18px_rgba(6,182,212,0.35)] cursor-pointer"
              title="Generate organization plan"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Organize</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Compact Metric Cards with Easy Names */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-5 border-t border-[#172548]">
          {/* Card 1: Files */}
          <div className="p-3.5 rounded-xl bg-[#080e22]/90 border border-[#1a2b50] hover:border-slate-500/50 transition-all">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Files</span>
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-black text-white font-mono-numbers mt-1">
              {scannedFiles.length}
            </div>
          </div>

          {/* Card 2: Size */}
          <div className="p-3.5 rounded-xl bg-[#080e22]/90 border border-[#1a2b50] hover:border-slate-500/50 transition-all">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Size</span>
              <Layers className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-black text-white font-mono-numbers mt-1">
              {formatBytes(totalBytes)}
            </div>
          </div>

          {/* Card 3: Duplicates */}
          <div
            onClick={duplicateGroups.length > 0 ? onNavigateToDuplicates : undefined}
            className={`p-3.5 rounded-xl border transition-all ${
              duplicateGroups.length > 0
                ? 'bg-amber-950/20 border-amber-500/40 cursor-pointer hover:border-amber-400 hover:bg-amber-950/35 hover:shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                : 'bg-[#080e22]/90 border-[#1a2b50]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className={duplicateGroups.length > 0 ? 'text-amber-400' : ''}>Duplicates</span>
              {duplicateGroups.length > 0 && (
                <span className="text-amber-400 text-xs font-mono font-medium">
                  View &rarr;
                </span>
              )}
            </div>
            <div className="text-xl font-black text-amber-400 font-mono-numbers mt-1">
              {duplicateGroups.length}{' '}
              <span className="text-xs font-normal text-amber-300/80 font-mono">
                ({formatBytes(redundantBytes)} wasted)
              </span>
            </div>
          </div>

          {/* Card 4: Plan */}
          <div
            onClick={proposalsCount > 0 ? onNavigateToProposals : undefined}
            className={`p-3.5 rounded-xl border transition-all ${
              proposalsCount > 0
                ? 'bg-orange-950/25 border-orange-500/45 cursor-pointer hover:border-orange-400 hover:bg-orange-950/40 hover:shadow-[0_0_15px_rgba(255,106,0,0.3)]'
                : 'bg-[#080e22]/90 border-[#1a2b50]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className={proposalsCount > 0 ? 'text-orange-400' : ''}>Plan</span>
              {proposalsCount > 0 && (
                <span className="text-[#ff6a00] text-xs font-mono font-medium">
                  Review &rarr;
                </span>
              )}
            </div>
            <div className="text-xl font-black text-[#ff6a00] font-mono-numbers mt-1">
              {proposalsCount}{' '}
              <span className="text-xs font-normal text-orange-300/80 font-mono">to review</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Switcher: File Explorer vs Storage Visualizer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#142347]">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#070c1e] border border-[#172548]">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-[#142347] text-white shadow-xs border border-[#23386e]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5 text-cyan-400" />
            <span>File Explorer</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('visualizer')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'visualizer'
                ? 'bg-[#142347] text-white shadow-xs border border-[#23386e]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-[#ff6a00]" />
            <span>Storage Visualizer</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {viewMode === 'table'
            ? `Showing ${sortedFiles.length} of ${scannedFiles.length} files`
            : 'Interactive Disk Space & Clutter Analysis'}
        </div>
      </div>

      {viewMode === 'visualizer' ? (
        <StorageVisualizer
          files={scannedFiles}
          duplicateGroups={duplicateGroups}
          totalBytes={totalBytes}
          onInspectFile={(f) => setInspectedFile(f)}
          onNavigateToDuplicates={onNavigateToDuplicates}
          onNavigateToProposals={onNavigateToProposals}
        />
      ) : (
        <div className="space-y-4">
          {/* Filter Tabs & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all' as CategoryFilter, label: 'All', count: scannedFiles.length },
              { id: 'documents' as CategoryFilter, label: 'Docs', count: undefined },
              { id: 'code' as CategoryFilter, label: 'Code', count: undefined },
              { id: 'images' as CategoryFilter, label: 'Media', count: undefined },
              { id: 'archives' as CategoryFilter, label: 'Archives', count: undefined },
              { id: 'duplicates' as CategoryFilter, label: 'Duplicates', count: duplicateHashSet.size },
            ]
          ).map((tab) => {
            const isActive = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-600 to-[#ff6a00] text-white border-orange-400/50 shadow-[0_0_12px_rgba(255,106,0,0.4)]'
                    : 'bg-[#0a1226] text-slate-300 hover:text-white hover:bg-[#101c3d] border-[#1b2d56]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-black/35 text-white'
                        : 'bg-[#152347] text-slate-300 border border-[#213566]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a1226] border border-[#1b2d56] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:shadow-[0_0_10px_rgba(255,106,0,0.3)] font-sans"
            />
          </div>

          <div className="flex items-center rounded-lg border border-[#1b2d56] bg-[#0a1226] p-0.5 text-xs text-slate-400">
            <button
              onClick={() => {
                if (sortField === 'filename') {
                  setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                } else {
                  setSortField('filename');
                  setSortOrder('asc');
                }
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                sortField === 'filename'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'hover:text-slate-200'
              }`}
            >
              Name
            </button>
            <button
              onClick={() => {
                if (sortField === 'size') {
                  setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                } else {
                  setSortField('size');
                  setSortOrder('desc');
                }
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                sortField === 'size'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'hover:text-slate-200'
              }`}
            >
              Size
            </button>
            <button
              onClick={() => {
                if (sortField === 'modified') {
                  setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                } else {
                  setSortField('modified');
                  setSortOrder('desc');
                }
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                sortField === 'modified'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'hover:text-slate-200'
              }`}
            >
              Date
            </button>
          </div>
        </div>
      </div>

      {/* File Table with Drag & Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUploadFiles) {
            onUploadFiles(Array.from(e.dataTransfer.files));
          }
        }}
        className={`rounded-2xl border transition-all shadow-xl shadow-black/40 overflow-hidden ${
          isDragOver
            ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_25px_rgba(255,106,0,0.3)]'
            : 'border-[#1b2d56] bg-[#080e22]'
        }`}
      >
        {sortedFiles.length === 0 ? (
          <div className="p-12 text-center space-y-3.5">
            <div className="h-12 w-12 rounded-2xl bg-orange-500/15 border border-orange-500/35 text-orange-400 flex items-center justify-center mx-auto">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">
                {searchQuery ? 'No matching files found' : 'This folder is empty'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? 'Try adjusting your search query or category filter.'
                  : 'Drag and drop real files from your PC into this area, or click below to upload.'}
              </p>
            </div>
            {!searchQuery && onUploadFiles && (
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Real Files</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#172548] bg-[#0c142c]/90 text-slate-400 uppercase font-mono text-[10px] tracking-wider">
                  <th className="py-3 px-4 font-bold">File</th>
                  <th className="py-3 px-3 font-bold hidden sm:table-cell">Type</th>
                  <th className="py-3 px-3 font-bold text-right">Size</th>
                  <th className="py-3 px-3 font-bold hidden md:table-cell">Modified</th>
                  <th className="py-3 px-3 font-bold text-center">Status</th>
                  <th className="py-3 px-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131f3c]">
                {sortedFiles.map((file) => {
                  const badge = getFileBadge(file.extension);
                  const fileHash = file.sha256Hash || file.sha256 || '';
                  const isDup = fileHash && duplicateHashSet.has(fileHash);

                  return (
                    <tr
                      key={file.id || file.relativePath}
                      className="hover:bg-[#0e1938]/70 transition-colors group"
                    >
                      {/* Name & Relative Path */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setInspectedFile(file)}
                            className="p-2 rounded-lg bg-[#0d1630] border border-[#1e3056] shrink-0 cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-950/20 transition-colors"
                            title="Click to inspect content & metadata"
                          >
                            {badge.icon}
                          </button>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setInspectedFile(file)}
                              className="font-semibold text-slate-100 group-hover:text-orange-400 transition-colors block truncate max-w-xs sm:max-w-md font-sans text-left cursor-pointer hover:underline"
                              title="Inspect file"
                            >
                              {file.filename}
                            </button>
                            <span className="text-[11px] font-mono text-slate-400 block truncate max-w-xs sm:max-w-md">
                              {file.relativePath.includes('/') ? file.relativePath : 'Root folder'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3 hidden sm:table-cell">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="py-3 px-3 text-right font-mono text-slate-300 font-medium">
                        {formatBytes(file.sizeBytes)}
                      </td>

                      {/* Modified */}
                      <td className="py-3 px-3 hidden md:table-cell text-slate-400 font-sans">
                        {formatRelativeTime(file.modifiedAt)}
                      </td>

                      {/* Status / Hash */}
                      <td className="py-3 px-3 text-center">
                        {isDup ? (
                          <button
                            onClick={onNavigateToDuplicates}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors cursor-pointer"
                            title="Duplicate detected"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => fileHash && handleCopyHash(fileHash)}
                            className="text-[10px] font-mono text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded hover:bg-[#122046] transition-colors cursor-pointer"
                            title={fileHash ? `SHA-256: ${fileHash}` : 'No hash'}
                          >
                            {copiedHash === fileHash ? (
                              <span className="text-emerald-400 flex items-center gap-0.5">
                                <Check className="w-2.5 h-2.5" /> Copied
                              </span>
                            ) : (
                              'Verified'
                            )}
                          </button>
                        )}
                      </td>

                      {/* Actions: Inspect */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectedFile(file)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-cyan-400 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/50 hover:border-cyan-500 transition-all cursor-pointer shadow-xs"
                          title="Open Interactive Inspector"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}

  {/* Interactive File Inspector Modal */}
  <FileInspectorModal
    file={inspectedFile}
    isOpen={Boolean(inspectedFile)}
    onClose={() => setInspectedFile(null)}
    isDuplicate={Boolean(
      inspectedFile &&
        (inspectedFile.sha256Hash || inspectedFile.sha256) &&
        duplicateHashSet.has(inspectedFile.sha256Hash || inspectedFile.sha256 || '')
    )}
  />
</div>
);
};
