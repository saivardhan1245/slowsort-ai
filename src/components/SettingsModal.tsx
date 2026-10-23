import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Sparkles,
  RefreshCw,
  Check,
  AlertTriangle,
  Loader2,
  Flame,
  ShieldCheck,
  FolderLock,
  FileCode,
} from 'lucide-react';
import type { AppSettings, GeminiStatus } from '../types/index.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  geminiStatus: GeminiStatus | null;
  onSave: (settings: Partial<AppSettings>) => Promise<void>;
  onTestAi: () => Promise<void>;
  isTestingAi: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  geminiStatus,
  onSave,
  onTestAi,
  isTestingAi,
}) => {
  const [geminiModel, setGeminiModel] = useState('gemini-3.8-flash');
  const [extractText, setExtractText] = useState(false);
  const [maxScanDepth, setMaxScanDepth] = useState(6);
  const [allowedRoot, setAllowedRoot] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setGeminiModel(settings.gemini_model || 'gemini-3.8-flash');
      setExtractText(Boolean(settings.extract_text_content));
      setMaxScanDepth(settings.max_scan_depth || 6);
      setAllowedRoot(settings.allowed_root || '');
    }
  }, [settings]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      await onSave({
        gemini_model: geminiModel.trim(),
        extract_text_content: extractText,
        max_scan_depth: maxScanDepth,
        allowed_root: allowedRoot.trim(),
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const hasApiKey = geminiStatus?.hasKey ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg rounded-2xl border border-[#1d2f59] bg-[#0c142c] p-6 shadow-2xl shadow-black/90 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#18274d]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-[#ff6a00] border border-orange-500/35 shadow-[0_0_15px_rgba(255,106,0,0.25)]">
              <Flame className="w-5 h-5 fill-orange-500/30" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-sans tracking-tight">
                Settings
              </h2>
              <p className="text-[11px] text-slate-400">
                Gemini AI engine &amp; filesystem guardrails
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#14234f] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Gemini AI Engine Section */}
          <div className="space-y-3 rounded-xl border border-[#192b54] bg-[#070e22] p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-[#ff6a00]" />
                Google Gemini AI
              </span>
              <button
                type="button"
                onClick={onTestAi}
                disabled={isTestingAi}
                className="flex items-center gap-1 text-orange-400 hover:text-orange-300 font-semibold cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isTestingAi ? 'animate-spin' : ''}`} />
                <span>Check Status</span>
              </button>
            </div>

            {/* API Key Status Notice */}
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 transition-colors ${
                hasApiKey
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                  : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                  hasApiKey
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse'
                    : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]'
                }`}
              />
              <div className="space-y-1">
                <p className="font-semibold text-xs text-white">
                  {hasApiKey
                    ? 'Backend GEMINI_API_KEY Configured'
                    : 'GEMINI_API_KEY Not Detected in Backend'}
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {hasApiKey
                    ? 'AI organization suggestions will be generated remotely by Gemini. File contents stay on your machine by default.'
                    : 'Add GEMINI_API_KEY=your_key in your .env file on the backend. When no key is set, SlowSort AI uses its built-in rule engine so file sorting still works.'}
                </p>
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Model Identifier</label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full rounded-xl border border-[#1e3466] bg-[#0b142d] px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended — Fast &amp; Accurate)</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash (Supported)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Fast)</option>
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                API keys are kept strictly on the server backend and never exposed to the frontend.
              </p>
            </div>
          </div>

          {/* Filesystem Security & Guardrails */}
          <div className="space-y-3 rounded-xl border border-[#192b54] bg-[#070e22] p-4">
            <span className="font-bold text-white flex items-center gap-2 text-xs">
              <FolderLock className="w-4 h-4 text-cyan-400" />
              Filesystem Guardrails
            </span>

            <div className="p-3 rounded-xl bg-[#0b142d] border border-[#1e3466] flex items-center justify-between">
              <div>
                <span className="text-slate-200 font-semibold block">Filesystem Sandbox Protection</span>
                <span className="text-[11px] text-slate-400">Path traversal protection active</span>
              </div>
              <span className="text-emerald-400 font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/40">
                Enforced
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Max Scan Depth</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={maxScanDepth}
                  onChange={(e) => setMaxScanDepth(Math.max(1, parseInt(e.target.value, 10) || 6))}
                  className="w-full rounded-xl border border-[#1e3466] bg-[#0b142d] px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-[#0b142d] border border-[#1e3466] hover:border-slate-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={extractText}
                    onChange={(e) => setExtractText(e.target.checked)}
                    className="accent-orange-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-300 font-medium select-none">
                    Extract Text Snippets
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#18274d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#1b2d56] bg-[#091127] text-slate-300 hover:text-white hover:bg-[#111f42] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-[#ff6a00] hover:from-orange-500 hover:to-[#ff7f24] text-white font-bold shadow-lg shadow-orange-600/30 border border-orange-400/40 hover:shadow-[0_0_20px_rgba(255,106,0,0.5)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
