import React from 'react';
import { motion } from 'motion/react';
import {
  Folder,
  Settings as SettingsIcon,
  Flame,
  Files,
  CheckSquare,
  Copy,
  History,
  Sparkles,
} from 'lucide-react';
import type { TabType, WorkspaceStatus, GeminiStatus } from '../types/index.ts';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  workspace: WorkspaceStatus;
  geminiStatus: GeminiStatus | null;
  pendingProposalsCount: number;
  duplicateGroupsCount: number;
  historyCount: number;
  onOpenSettings: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  workspace,
  geminiStatus,
  pendingProposalsCount,
  duplicateGroupsCount,
  historyCount,
  onOpenSettings,
}) => {
  const isAiOnline = geminiStatus?.hasKey ?? false;
  const modelName = geminiStatus?.configuredModel || 'gemini-3.8-flash';

  return (
    <header className="sticky top-0 z-40 border-b border-[#182649] bg-[#070d1e]/95 backdrop-blur-md shadow-xl shadow-black/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab('workspace')}
            className="flex items-center gap-2.5 text-left group transition-all active:scale-95 cursor-pointer"
            title="SlowSort AI"
          >
            {/* Glowing Flame Icon */}
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 via-[#ff6a00] to-amber-400 text-white shadow-md shadow-orange-500/35 group-hover:shadow-[0_0_22px_rgba(255,106,0,0.7)] transition-all">
              <Flame className="w-5 h-5 fill-white/20 stroke-[2.3]" />
              <div className="absolute inset-0 rounded-xl bg-orange-400/20 animate-pulse pointer-events-none" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white font-sans">
                  Slow<span className="text-[#ff6a00] drop-shadow-[0_0_12px_rgba(255,106,0,0.6)]">Sort</span> AI
                </span>
                <span className="text-xs font-mono text-cyan-400/90 font-bold ml-1">
                  v1.0
                </span>
              </div>
            </div>
          </button>

          {/* Active Workspace Status Indicator */}
          {workspace.connected && (
            <div className="hidden lg:flex items-center gap-1.5 pl-3 ml-1 border-l border-[#1a2b50]">
              <div className="flex items-center gap-2 text-slate-300 font-mono text-xs px-2.5 py-1 rounded-lg bg-[#0e1836] border border-[#1d3161]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <span className="font-semibold text-slate-200">Workspace Active</span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Gaming Navigation Tabs */}
        {workspace.connected && (
          <nav className="flex items-center rounded-xl bg-[#091127] p-1 border border-[#1b2d56] shadow-inner">
            {(
              [
                { id: 'workspace', label: 'Files', icon: Files, count: 0 },
                { id: 'proposals', label: 'Plan', icon: CheckSquare, count: pendingProposalsCount },
                { id: 'duplicates', label: 'Duplicates', icon: Copy, count: duplicateGroupsCount },
                { id: 'history', label: 'History', icon: History, count: historyCount },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative flex items-center gap-1.5 sm:gap-2 rounded-lg px-3 sm:px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e1938]/60'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeGamingTab"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-600 to-[#ff6a00] shadow-[0_0_18px_rgba(255,106,0,0.5)] border border-orange-400/40"
                      transition={{ type: 'spring', bounce: 0.18, duration: 0.28 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span
                        className={`font-mono-numbers text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                          isActive
                            ? 'bg-black/50 text-white border border-white/25'
                            : tab.id === 'proposals'
                            ? 'bg-orange-500/30 text-orange-300 border border-orange-500/40'
                            : tab.id === 'duplicates'
                            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right: AI Engine Pill & Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Gemini AI Status Pill */}
          <div
            onClick={onOpenSettings}
            role="button"
            tabIndex={0}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer border border-[#1b2d56] bg-[#0a1228] hover:border-orange-500/50 hover:bg-[#0e1938] transition-all"
            title={
              isAiOnline
                ? `Gemini API Active (${modelName})`
                : 'Local Rule Engine (Click to configure Gemini API Key)'
            }
          >
            <span className="relative flex h-2 w-2">
              {isAiOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isAiOnline
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]'
                    : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]'
                }`}
              />
            </span>
            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-200 font-medium">
              <Sparkles className="w-3 h-3 text-orange-400" />
              <span className="hidden sm:inline">
                {isAiOnline ? modelName : 'Local Rules'}
              </span>
            </div>
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-[#0e1836] hover:bg-[#14234f] border border-[#1d3161] hover:border-orange-500/60 transition-all shadow-xs cursor-pointer"
            title="Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden xl:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
