export type TabType = 'workspace' | 'proposals' | 'duplicates' | 'history';

export interface GeminiStatus {
  connected: boolean;
  configuredModel: string;
  hasKey: boolean;
  error?: string;
  version?: string;
}

export interface WorkspaceStatus {
  connected: boolean;
  folderPath?: string;
  connectedAt?: string;
  exists?: boolean;
  immediateItemsCount?: number;
}

export interface ScannedFileInfo {
  id: string;
  relativePath: string;
  filename: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  modifiedAt: string;
  sha256Hash: string;
  sha256?: string;
}

export interface DuplicateGroup {
  hash: string;
  sizeBytes: number;
  files: ScannedFileInfo[];
}

export interface ProposalItem {
  id: string;
  scanId: string;
  sourceRelativePath: string;
  targetRelativePath: string;
  originalFilename: string;
  proposedFilename: string;
  category: string;
  reason: string;
  confidence: number;
  operationType: 'move' | 'rename' | 'keep' | 'move_and_rename';
  conflictWarning: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  createdAt: string;
}

export interface OperationHistoryItem {
  id: string;
  proposalId: string | null;
  batchId: string;
  operationType: string;
  sourcePath: string;
  destinationPath: string;
  fileHash: string;
  fileSize: number;
  status: 'success' | 'failed' | 'undone';
  errorMessage: string | null;
  executedAt: string;
  undoneAt: string | null;
}

export interface AppSettings {
  gemini_model: string;
  extract_text_content: boolean;
  max_scan_depth: number;
  allowed_root: string;
}
