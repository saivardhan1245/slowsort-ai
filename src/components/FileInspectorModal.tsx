import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Copy,
  Check,
  FileText,
  ShieldCheck,
  Calendar,
  Hash,
  HardDrive,
  Eye,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { ScannedFileInfo } from '../types/index.ts';
import { formatBytes, formatRelativeTime } from '../utils/format.ts';

interface FileInspectorModalProps {
  file: ScannedFileInfo | null;
  isOpen: boolean;
  onClose: () => void;
  isDuplicate?: boolean;
}

interface FilePreviewData {
  relativePath: string;
  filename: string;
  sizeBytes: number;
  modifiedAt: string;
  extension: string;
  isImage: boolean;
  isText: boolean;
  textContent: string | null;
  rawUrl: string;
}

export const FileInspectorModal: React.FC<FileInspectorModalProps> = ({
  file,
  isOpen,
  onClose,
  isDuplicate,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [previewData, setPreviewData] = useState<FilePreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setPreviewData(null);
      setLoadError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    api
      .getFilePreview(file.relativePath)
      .then((data) => {
        if (isMounted) {
          setPreviewData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setLoadError(err.message || 'Could not load preview');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(file.sha256Hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 1800);
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.relativePath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 1800);
  };

  const handleCopyText = () => {
    if (previewData?.textContent) {
      navigator.clipboard.writeText(previewData.textContent);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 1800);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-[#1d2f59] bg-[#091126] shadow-2xl shadow-black/80 overflow-hidden text-slate-100"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#182649] bg-[#0c152d]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-orange-500/15 border border-orange-500/35 text-orange-400 flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate font-sans">
                  {file.filename}
                </h3>
                <p className="text-[11px] font-mono text-slate-400 truncate">
                  {file.relativePath}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* Live Content Preview Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Content Preview</span>
                </span>
                {previewData?.textContent && (
                  <button
                    onClick={handleCopyText}
                    className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy snippet</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="h-44 rounded-xl border border-[#172548] bg-[#060a17] flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                  <span>Loading file stream from disk...</span>
                </div>
              ) : loadError ? (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-xs text-red-300">
                  {loadError}
                </div>
              ) : previewData?.isImage ? (
                <div className="rounded-xl border border-[#172548] bg-[#060a17] p-3 flex flex-col items-center justify-center max-h-72 overflow-hidden">
                  <img
                    src={previewData.rawUrl}
                    alt={file.filename}
                    className="max-h-64 object-contain rounded-lg shadow-md"
                  />
                </div>
              ) : previewData?.isText && previewData.textContent ? (
                <div className="rounded-xl border border-[#172548] bg-[#050814] p-3.5 max-h-56 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                  {previewData.textContent}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-[#172548] bg-[#060a17] text-center space-y-1.5 text-slate-400">
                  <p className="text-xs font-semibold text-slate-300">
                    Binary / Non-text File ({file.extension.toUpperCase().replace('.', '') || 'FILE'})
                  </p>
                  <p className="text-[11px]">
                    This file is stored safely on disk. Inspect cryptographic hash and metadata below.
                  </p>
                </div>
              )}
            </div>

            {/* Cryptographic Verification Card */}
            <div className="p-4 rounded-xl border border-[#172548] bg-[#0c152d]/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>SHA-256 Cryptographic Checksum</span>
                </div>
                <button
                  onClick={handleCopyHash}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium border border-[#1f325c] bg-[#070d1e] hover:bg-[#122247] text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedHash ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Hash</span>
                    </>
                  )}
                </button>
              </div>

              <div className="font-mono text-xs text-emerald-300/90 bg-[#050916] p-2.5 rounded-lg border border-[#142347] break-all select-all">
                {file.sha256Hash}
              </div>

              {isDuplicate && (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-500/40 p-2.5 rounded-lg">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Identical content duplicate detected. Another file in your folder shares this exact SHA-256 hash.
                  </span>
                </div>
              )}
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border border-[#172548] bg-[#080e22]">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Size</span>
                </div>
                <div className="text-sm font-bold text-white font-mono mt-1">
                  {formatBytes(file.sizeBytes)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {file.sizeBytes.toLocaleString()} B
                </div>
              </div>

              <div className="p-3 rounded-xl border border-[#172548] bg-[#080e22]">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Hash className="w-3.5 h-3.5" />
                  <span>Format</span>
                </div>
                <div className="text-sm font-bold text-white font-mono mt-1">
                  {file.extension.toUpperCase().replace('.', '') || 'UNKNOWN'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {file.mimeType || 'binary'}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-[#172548] bg-[#080e22]">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Modified</span>
                </div>
                <div className="text-sm font-bold text-white font-sans mt-1">
                  {formatRelativeTime(file.modifiedAt)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {new Date(file.modifiedAt).toLocaleDateString()}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-[#172548] bg-[#080e22]">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>Reversible</span>
                </div>
                <div className="text-sm font-bold text-emerald-400 font-sans mt-1">
                  Protected
                </div>
                <div className="text-[10px] text-slate-400">
                  1-Click Undoable
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#182649] bg-[#070c1e] text-xs">
            <button
              onClick={handleCopyPath}
              className="text-slate-400 hover:text-white flex items-center gap-1.5 font-mono cursor-pointer transition-colors"
            >
              {copiedPath ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Path copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy relative path</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#142347] hover:bg-[#1a2d59] text-white font-medium cursor-pointer transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
