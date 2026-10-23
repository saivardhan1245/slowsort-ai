import type {
  GeminiStatus,
  WorkspaceStatus,
  ScannedFileInfo,
  DuplicateGroup,
  ProposalItem,
  OperationHistoryItem,
  AppSettings,
} from '../types/index.ts';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }
  return data as T;
}

export const api = {
  getGeminiStatus: () => fetchJson<GeminiStatus>('/api/ai/status'),

  getSettings: () => fetchJson<AppSettings>('/api/settings'),

  updateSettings: (settings: AppSettings) =>
    fetchJson<{ success: boolean; settings: AppSettings }>('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  getWorkspaceStatus: () => fetchJson<WorkspaceStatus>('/api/workspace/status'),

  connectWorkspace: (folderPath: string) =>
    fetchJson<{ success: boolean; folderPath: string; connectedAt: string }>('/api/workspace/connect', {
      method: 'POST',
      body: JSON.stringify({ folderPath }),
    }),

  disconnectWorkspace: () =>
    fetchJson<{ success: boolean }>('/api/workspace/disconnect', {
      method: 'POST',
    }),

  createSandbox: () =>
    fetchJson<{ success: boolean; folderPath: string; message: string }>('/api/workspace/create-folder', {
      method: 'POST',
    }),

  createFolder: (folderName?: string) =>
    fetchJson<{ success: boolean; folderPath: string; message: string }>('/api/workspace/create-folder', {
      method: 'POST',
      body: JSON.stringify({ folderName }),
    }),

  uploadFiles: async (files: File[]) => {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    const res = await fetch('/api/workspace/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload files');
    }
    return data as { success: boolean; uploadedCount: number; folderPath: string; message: string };
  },

  resetWorkspace: () =>
    fetchJson<{ success: boolean; message: string }>('/api/workspace/reset', {
      method: 'POST',
    }),

  clearHistory: () =>
    fetchJson<{ success: boolean; message: string }>('/api/history/clear', {
      method: 'POST',
    }),

  browseDirectory: (pathQuery?: string) =>
    fetchJson<{
      currentPath: string;
      parentPath: string | null;
      directories: string[];
      filesCount: number;
    }>(`/api/workspace/browse${pathQuery ? `?path=${encodeURIComponent(pathQuery)}` : ''}`),

  getFilePreview: (relativePath: string) =>
    fetchJson<{
      relativePath: string;
      filename: string;
      sizeBytes: number;
      modifiedAt: string;
      extension: string;
      isImage: boolean;
      isText: boolean;
      textContent: string | null;
      rawUrl: string;
    }>(`/api/workspace/file-preview?path=${encodeURIComponent(relativePath)}`),

  startScan: () =>
    fetchJson<{
      scanId: string;
      folderPath: string;
      scannedAt: string;
      fileCount: number;
      totalBytes: number;
      duplicateGroupsCount: number;
      files: ScannedFileInfo[];
      duplicateGroups: DuplicateGroup[];
    }>('/api/scan/start', { method: 'POST' }),

  getCurrentScan: () =>
    fetchJson<{
      hasScan: boolean;
      scanId?: string;
      folderPath?: string;
      scannedAt?: string;
      fileCount?: number;
      totalBytes?: number;
      duplicateGroupsCount?: number;
      files?: ScannedFileInfo[];
      duplicateGroups?: DuplicateGroup[];
    }>('/api/scan/current'),

  analyzeWithAi: () =>
    fetchJson<{ proposals: ProposalItem[]; count: number }>('/api/ai/analyze', {
      method: 'POST',
    }),

  getProposals: () => fetchJson<{ proposals: ProposalItem[] }>('/api/proposals'),

  updateProposal: (
    id: string,
    updates: { status?: string; targetRelativePath?: string; proposedFilename?: string }
  ) =>
    fetchJson<{ success: boolean; proposalId: string }>(`/api/proposals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  executeProposals: (proposalIds: string[]) =>
    fetchJson<{ batchId: string; results: Array<{ proposalId: string; success: boolean; error?: string }> }>(
      '/api/proposals/execute',
      {
        method: 'POST',
        body: JSON.stringify({ proposalIds }),
      }
    ),

  getHistory: () => fetchJson<{ history: OperationHistoryItem[] }>('/api/history'),

  undoOperation: (operationId: string) =>
    fetchJson<{ success: boolean; operationId: string; undoneAt: string }>('/api/history/undo', {
      method: 'POST',
      body: JSON.stringify({ operationId }),
    }),
};
