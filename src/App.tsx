import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from './services/api.ts';
import type {
  GeminiStatus,
  WorkspaceStatus,
  ScannedFileInfo,
  DuplicateGroup,
  ProposalItem,
  OperationHistoryItem,
  AppSettings,
  TabType,
} from './types/index.ts';

import { ToastProvider, useToast } from './components/ui/Toast.tsx';
import { Navigation } from './components/Navigation.tsx';
import { WelcomeSetup } from './components/WelcomeSetup.tsx';
import { WorkspaceView } from './components/WorkspaceView.tsx';
import { ReviewPlanView } from './components/ReviewPlanView.tsx';
import { DuplicatesView } from './components/DuplicatesView.tsx';
import { ActivityHistoryView } from './components/ActivityHistoryView.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { AlertCircle } from 'lucide-react';

function AppContent() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('workspace');

  // Real backend state
  const [workspace, setWorkspace] = useState<WorkspaceStatus>({ connected: false });
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [scannedFiles, setScannedFiles] = useState<ScannedFileInfo[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [history, setHistory] = useState<OperationHistoryItem[]>([]);

  // Operational states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [checkingAi, setCheckingAi] = useState(false);

  // Modals & Errors
  const [showSettings, setShowSettings] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Initial load of real backend data
  useEffect(() => {
    async function init() {
      try {
        const [wsRes, aiRes, settingsRes, scanRes, propRes, histRes] = await Promise.allSettled([
          api.getWorkspaceStatus(),
          api.getGeminiStatus(),
          api.getSettings(),
          api.getCurrentScan(),
          api.getProposals(),
          api.getHistory(),
        ]);

        if (wsRes.status === 'fulfilled') setWorkspace(wsRes.value);
        if (aiRes.status === 'fulfilled') setGeminiStatus(aiRes.value);
        if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value);

        if (scanRes.status === 'fulfilled' && scanRes.value.hasScan) {
          setScannedFiles(scanRes.value.files || []);
          setDuplicateGroups(scanRes.value.duplicateGroups || []);
          setTotalBytes(scanRes.value.totalBytes || 0);
          setLastScannedAt(scanRes.value.scannedAt || null);
        }

        if (propRes.status === 'fulfilled') setProposals(propRes.value.proposals || []);
        if (histRes.status === 'fulfilled') setHistory(histRes.value.history || []);
      } catch (err: any) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, []);

  // Poll or refresh Gemini status
  const handleRefreshGemini = async () => {
    setCheckingAi(true);
    try {
      const status = await api.getGeminiStatus();
      setGeminiStatus(status);
      if (status.hasKey) {
        addToast({
          type: 'success',
          title: 'Gemini AI Active',
          description: `Connected to ${status.configuredModel}`,
        });
      } else {
        addToast({
          type: 'warning',
          title: 'Local Rule Engine',
          description: 'GEMINI_API_KEY not set in .env. Sorting via rule engine.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'AI Status Error',
        description: err.message,
      });
    } finally {
      setCheckingAi(false);
    }
  };

  // Save settings
  const handleSaveSettings = async (updates: Partial<AppSettings>) => {
    try {
      const merged: AppSettings = {
        gemini_model: updates.gemini_model ?? settings?.gemini_model ?? 'gemini-3.8-flash',
        extract_text_content: updates.extract_text_content ?? settings?.extract_text_content ?? false,
        max_scan_depth: updates.max_scan_depth ?? settings?.max_scan_depth ?? 6,
        allowed_root: updates.allowed_root ?? settings?.allowed_root ?? '',
      };
      const res = await api.updateSettings(merged);
      setSettings(res.settings);
      addToast({
        type: 'success',
        title: 'Settings Saved',
        description: 'Preferences saved successfully.',
      });
      await handleRefreshGemini();
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to save settings');
      throw err;
    }
  };

  // Connect folder
  const handleConnectPath = async (folderPath: string) => {
    setIsConnecting(true);
    setGlobalError(null);
    try {
      await api.connectWorkspace(folderPath);
      const wsStatus = await api.getWorkspaceStatus();
      setWorkspace(wsStatus);
      setActiveTab('workspace');
      addToast({
        type: 'success',
        title: 'Folder Connected',
        description: `Connected to ${folderPath.split('/').filter(Boolean).pop() || folderPath}`,
      });
      await handleScan();
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to connect folder');
      addToast({
        type: 'error',
        title: 'Connection Failed',
        description: err.message,
      });
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  // Create a clean, empty workspace directory on disk
  const handleCreateCleanFolder = async (folderName?: string) => {
    setIsConnecting(true);
    setGlobalError(null);
    try {
      const res = await api.createFolder(folderName);
      const wsStatus = await api.getWorkspaceStatus();
      setWorkspace(wsStatus);
      setScannedFiles([]);
      setDuplicateGroups([]);
      setTotalBytes(0);
      setLastScannedAt(null);
      setProposals([]);
      setActiveTab('workspace');
      addToast({
        type: 'success',
        title: 'Workspace Initialized',
        description: res.message || 'Clean workspace directory ready on disk.',
      });
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to create workspace directory');
      addToast({
        type: 'error',
        title: 'Folder Error',
        description: err.message,
      });
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  // Upload real files from local computer directly into active workspace
  const handleUploadFiles = async (files: File[]) => {
    setIsUploading(true);
    setGlobalError(null);
    try {
      const res = await api.uploadFiles(files);
      const wsStatus = await api.getWorkspaceStatus();
      setWorkspace(wsStatus);
      setActiveTab('workspace');
      addToast({
        type: 'success',
        title: 'Real Files Uploaded',
        description: `Uploaded ${res.uploadedCount} files. Scanning and computing SHA-256 hashes...`,
      });
      await handleScan();
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to upload files');
      addToast({
        type: 'error',
        title: 'Upload Error',
        description: err.message,
      });
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  // Clear SQLite history log
  const handleClearHistory = async () => {
    try {
      await api.clearHistory();
      setHistory([]);
      addToast({
        type: 'info',
        title: 'History Cleared',
        description: 'Operation history log has been cleared.',
      });
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to clear history');
      throw err;
    }
  };

  // Disconnect folder
  const handleDisconnect = async () => {
    try {
      await api.disconnectWorkspace();
      setWorkspace({ connected: false });
      setScannedFiles([]);
      setDuplicateGroups([]);
      setTotalBytes(0);
      setLastScannedAt(null);
      setProposals([]);
      addToast({
        type: 'info',
        title: 'Disconnected',
        description: 'Folder disconnected.',
      });
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to disconnect folder');
    }
  };

  // Run real filesystem scan
  const handleScan = async () => {
    setIsScanning(true);
    setGlobalError(null);

    try {
      const res = await api.startScan();
      setScannedFiles(res.files);
      setDuplicateGroups(res.duplicateGroups);
      setTotalBytes(res.totalBytes);
      setLastScannedAt(res.scannedAt);
      addToast({
        type: 'success',
        title: 'Scan Complete',
        description: `Indexed ${res.fileCount} files (${res.duplicateGroupsCount} duplicate groups found).`,
      });
    } catch (err: any) {
      setGlobalError(err.message || 'Scan failed');
      addToast({
        type: 'error',
        title: 'Scan Error',
        description: err.message,
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Generate AI organization proposals
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setGlobalError(null);

    try {
      const res = await api.analyzeWithAi();
      setProposals(res.proposals);
      setActiveTab('proposals');
      addToast({
        type: 'success',
        title: 'Plan Ready',
        description: `Generated ${res.count} file organization proposals.`,
      });
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to generate plan');
      addToast({
        type: 'error',
        title: 'Plan Error',
        description: err.message,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Update proposal status or target
  const handleUpdateProposal = async (
    id: string,
    updates: { status?: string; targetRelativePath?: string; proposedFilename?: string }
  ) => {
    try {
      await api.updateProposal(id, updates);
      const res = await api.getProposals();
      setProposals(res.proposals);
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to update proposal');
    }
  };

  // Execute approved file operations
  const handleExecute = async (approvedIds: string[]) => {
    setIsExecuting(true);
    setGlobalError(null);

    try {
      const res = await api.executeProposals(approvedIds);
      const successfulCount = res.results.filter((r) => r.success).length;
      const failedCount = res.results.filter((r) => !r.success).length;

      // Reload fresh scan and proposals from real filesystem and database
      const [propRes, histRes, scanRes] = await Promise.all([
        api.getProposals(),
        api.getHistory(),
        api.startScan(),
      ]);

      setProposals(propRes.proposals);
      setHistory(histRes.history);
      setScannedFiles(scanRes.files);
      setDuplicateGroups(scanRes.duplicateGroups);
      setTotalBytes(scanRes.totalBytes);
      setLastScannedAt(scanRes.scannedAt);

      if (failedCount === 0) {
        addToast({
          type: 'success',
          title: 'Operations Executed',
          description: `Successfully moved ${successfulCount} files.`,
        });
        setActiveTab('history');
      } else {
        addToast({
          type: 'warning',
          title: 'Execution Completed with Errors',
          description: `Moved ${successfulCount} files, ${failedCount} failed. Check History for details.`,
        });
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Execution failed');
      addToast({
        type: 'error',
        title: 'Execution Failed',
        description: err.message,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Undo previous file move
  const handleUndo = async (operationId: string) => {
    setIsUndoing(true);
    try {
      await api.undoOperation(operationId);
      const [histRes, scanRes] = await Promise.all([api.getHistory(), api.startScan()]);
      setHistory(histRes.history);
      setScannedFiles(scanRes.files);
      setDuplicateGroups(scanRes.duplicateGroups);
      setTotalBytes(scanRes.totalBytes);
      setLastScannedAt(scanRes.scannedAt);

      addToast({
        type: 'success',
        title: 'Move Undone',
        description: 'File safely moved back to its original location.',
      });
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to undo operation');
      addToast({
        type: 'error',
        title: 'Undo Failed',
        description: err.message,
      });
      throw err;
    } finally {
      setIsUndoing(false);
    }
  };

  const pendingProposalsCount = proposals.filter((p) => p.status === 'pending').length;

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#060913] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span>Starting SlowSort AI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col font-sans selection:bg-[#ff6a00]/30 selection:text-white">
      {/* Top Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        workspace={workspace}
        geminiStatus={geminiStatus}
        pendingProposalsCount={pendingProposalsCount}
        duplicateGroupsCount={duplicateGroups.length}
        historyCount={history.length}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Global Error Banner */}
      {globalError && (
        <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 pt-4">
          <div className="rounded-xl border border-red-500/40 bg-red-950/50 p-3 text-xs text-red-200 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{globalError}</span>
            </div>
            <button
              onClick={() => setGlobalError(null)}
              className="text-xs text-red-300 font-semibold hover:underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {!workspace.connected ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <WelcomeSetup
                geminiStatus={geminiStatus}
                onCreateCleanWorkspace={() => handleCreateCleanFolder()}
                onUploadFiles={handleUploadFiles}
                isConnecting={isConnecting}
                isUploading={isUploading}
              />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'workspace' && (
                <WorkspaceView
                  workspace={workspace}
                  scannedFiles={scannedFiles}
                  duplicateGroups={duplicateGroups}
                  totalBytes={totalBytes}
                  lastScannedAt={lastScannedAt}
                  isScanning={isScanning}
                  isAnalyzing={isAnalyzing}
                  isUploading={isUploading}
                  onScan={handleScan}
                  onAnalyze={handleAnalyze}
                  onDisconnect={handleDisconnect}
                  onUploadFiles={handleUploadFiles}
                  onNavigateToDuplicates={() => setActiveTab('duplicates')}
                  onNavigateToProposals={() => setActiveTab('proposals')}
                  proposalsCount={pendingProposalsCount}
                  configuredModel={settings?.gemini_model || 'gemini-3.8-flash'}
                  isAiOnline={geminiStatus?.hasKey ?? false}
                />
              )}

              {activeTab === 'proposals' && (
                <ReviewPlanView
                  proposals={proposals}
                  isExecuting={isExecuting}
                  onUpdateProposal={handleUpdateProposal}
                  onExecute={handleExecute}
                  onNavigateToHistory={() => setActiveTab('history')}
                />
              )}

              {activeTab === 'duplicates' && (
                <DuplicatesView
                  duplicateGroups={duplicateGroups}
                  onNavigateToWorkspace={() => setActiveTab('workspace')}
                />
              )}

              {activeTab === 'history' && (
                <ActivityHistoryView
                  history={history}
                  isUndoing={isUndoing}
                  onUndo={handleUndo}
                  onClearHistory={handleClearHistory}
                  onRefreshHistory={async () => {
                    const h = await api.getHistory();
                    setHistory(h.history);
                  }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#152342] bg-[#070c1e] px-6 py-3.5 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-white">
            Slow<span className="text-[#ff6a00]">Sort</span> AI
          </span>
          <span>·</span>
          <span>Local File Organizer</span>
        </div>
        <div className="font-mono text-[11px] text-slate-400 hidden sm:block">
          Fast, local, and private
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            settings={settings}
            geminiStatus={geminiStatus}
            onSave={handleSaveSettings}
            onTestAi={handleRefreshGemini}
            isTestingAi={checkingAi}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
