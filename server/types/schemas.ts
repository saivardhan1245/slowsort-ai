import { z } from 'zod';

export const AiClassificationSchema = z.object({
  category: z.string().min(1).max(50),
  suggested_folder: z.string().min(1).max(100),
  suggested_filename: z.string().min(1).max(150),
  explanation: z.string().min(1).max(300),
  confidence: z.number().min(0).max(1),
  potential_conflict: z.string().nullable().optional(),
});

export type AiClassification = z.infer<typeof AiClassificationSchema>;

export const ConnectWorkspaceSchema = z.object({
  folderPath: z.string().min(1),
});

export const UpdateSettingsSchema = z.object({
  gemini_model: z.string().min(1).default('gemini-3.8-flash'),
  extract_text_content: z.boolean(),
  max_scan_depth: z.number().int().min(1).max(15),
  allowed_root: z.string().min(1),
});

export const ExecuteOperationsSchema = z.object({
  proposalIds: z.array(z.string()).min(1),
});

export const UndoOperationSchema = z.object({
  operationId: z.string().min(1),
});

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
