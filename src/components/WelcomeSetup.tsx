import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  Flame,
  ShieldCheck,
  History,
  UploadCloud,
  FileCheck2,
  FolderPlus,
  Info,
  CheckCircle,
} from 'lucide-react';
import type { GeminiStatus } from '../types/index.ts';

interface WelcomeSetupProps {
  geminiStatus: GeminiStatus | null;
  onUploadFiles: (files: File[]) => Promise<void>;
  onCreateCleanWorkspace: () => Promise<void>;
  isConnecting: boolean;
  isUploading: boolean;
}

export const WelcomeSetup: React.FC<WelcomeSetupProps> = ({
  geminiStatus,
  onUploadFiles,
  onCreateCleanWorkspace,
  isConnecting,
  isUploading,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateClean = async () => {
    setErrorMsg(null);
    try {
      await onCreateCleanWorkspace();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize workspace');
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    try {
      await onUploadFiles(Array.from(files));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload files');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const hasApiKey = geminiStatus?.hasKey ?? false;
  const modelName = geminiStatus?.configuredModel || 'gemini-3.8-flash';

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-4xl w-full space-y-7">
        {/* Brand Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center space-y-3"
        >
          {/* Brand Subhead */}
          <div className="flex items-center justify-center gap-2 text-xs font-mono font-semibold text-orange-400">
            <Flame className="w-3.5 h-3.5 fill-orange-500 stroke-orange-600 inline" />
            <span>SlowSort AI</span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-slate-300">Intelligent File Organizer</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-sans">
            Organize Your Files with <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-orange-500 via-[#ff6a00] to-amber-400 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(255,106,0,0.45)]">
              Real Intelligence
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed">
            Drop your messy files here. Detect exact byte duplicates with SHA-256 verification, and organize them into tidy categories with Gemini AI proposals and 1-click reversible undo.
          </p>
        </motion.div>

        {/* Primary Action Card: Drag & Drop Real Files */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="mx-auto max-w-2xl rounded-2xl border border-[#1d2f59] bg-[#0c152d] p-6 sm:p-8 shadow-2xl shadow-black/75 space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[#ff6a00] shadow-[0_0_15px_rgba(255,106,0,0.3)]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white font-sans">
                  Upload Files to Organize
                </h3>
                <p className="text-xs text-slate-400">
                  Select your own documents, images, code, or receipts
                </p>
              </div>
            </div>

            {/* AI Engine Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#070c1e] border border-[#172548] text-xs">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  hasApiKey
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse'
                    : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]'
                }`}
              />
              <span className="font-mono text-[11px] text-slate-300 font-medium">
                {hasApiKey ? `Gemini (${modelName})` : 'Local Rule Engine'}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {/* Big Interactive Drag-Drop Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-8 sm:p-10 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-3.5 ${
              isDragOver
                ? 'border-orange-500 bg-orange-500/15 shadow-[0_0_30px_rgba(255,106,0,0.35)] scale-[1.01]'
                : 'border-[#1e3466] bg-[#070c1e]/90 hover:border-orange-500/60 hover:bg-[#0b142d] hover:shadow-[0_0_20px_rgba(255,106,0,0.15)]'
            }`}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="w-9 h-9 text-orange-500 animate-spin" />
                <span className="text-sm font-bold text-slate-100">
                  Uploading files to your workspace...
                </span>
                <span className="text-xs text-slate-400">
                  Calculating cryptographic SHA-256 byte hashes
                </span>
              </div>
            ) : (
              <>
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-orange-500/20 to-amber-500/10 border border-orange-500/40 text-orange-400 flex items-center justify-center shadow-[0_0_20px_rgba(255,106,0,0.25)]">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-base sm:text-lg font-bold text-white">
                    Drop your files here, or{' '}
                    <span className="text-orange-400 underline underline-offset-4 hover:text-orange-300">
                      browse files
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1.5 leading-relaxed">
                    Select any documents, images, PDFs, code, spreadsheets, or archives. Real byte measurements and hashes are computed directly on disk.
                  </p>
                </div>

                <div className="pt-2">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-[#ff6a00] hover:from-orange-500 hover:to-[#ff7f24] text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-600/35 border border-orange-400/40">
                    <span>Choose Files from Computer</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Secondary Action: Start Blank Workspace */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#162345]">
            <span className="text-xs text-slate-400 text-center sm:text-left">
              Want to start with a blank folder and upload later?
            </span>
            <button
              type="button"
              onClick={handleCreateClean}
              disabled={isConnecting || isUploading}
              className="px-4 py-2 rounded-xl bg-[#091126] hover:bg-[#101e40] border border-[#1b2d56] hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>Preparing Workspace...</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Start Empty Workspace</span>
                </>
              )}
            </button>
          </div>

          {/* Zero Fake Data Guarantee */}
          <div className="p-3.5 rounded-xl bg-[#091126] border border-[#17254a] flex items-start gap-2.5 text-xs text-slate-400">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-200 text-xs">
                Zero Pre-Loaded or Fake Files
              </p>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Only the files you upload are stored and organized. No fake mock files, no simulated duplicates, and zero paths to type.
              </p>
            </div>
          </div>
        </motion.div>

        {/* 3 Core Value Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-2">
          {/* Pillar 1 */}
          <div className="p-4 rounded-xl border border-[#1b2d56] bg-[#0c152d]/80 text-left space-y-2 hover:border-orange-500/40 transition-all">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white font-sans">
              Local Files &amp; Privacy
            </h4>
            <p className="text-xs text-slate-400 leading-normal">
              Files are managed locally. Gemini receives only clean file metadata to recommend smart categories.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-4 rounded-xl border border-[#1b2d56] bg-[#0c152d]/80 text-left space-y-2 hover:border-orange-500/40 transition-all">
            <div className="h-8 w-8 rounded-lg bg-orange-500/20 text-[#ff6a00] border border-orange-500/35 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white font-sans">
              No Silent Deletion
            </h4>
            <p className="text-xs text-slate-400 leading-normal">
              Nothing moves or renames automatically. You preview, edit, and approve every proposed action.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-4 rounded-xl border border-[#1b2d56] bg-[#0c152d]/80 text-left space-y-2 hover:border-orange-500/40 transition-all">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/35 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white font-sans">
              Safe 1-Click Undo
            </h4>
            <p className="text-xs text-slate-400 leading-normal">
              Every operation is recorded in SQLite with cryptographic SHA-256 validation. Revert anytime with 1 click.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
