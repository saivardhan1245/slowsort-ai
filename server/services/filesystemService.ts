import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ScannedFileInfo, DuplicateGroup } from '../types/schemas.js';

// MIME map for common extensions
const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.ts': 'text/typescript',
  '.js': 'text/javascript',
  '.py': 'text/x-python',
};

const EXCLUDED_DIRS = new Set([
  '.git',
  '.slowsort',
  'node_modules',
  '.cache',
  'dist',
  'build',
  '.DS_Store',
]);

/**
 * Validates that a candidate path is inside the allowed root directory
 * and does not escape via traversal (..) or symlinks.
 */
export function assertPathWithinRoot(targetPath: string, rootPath: string): string {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(rootPath, targetPath);

  // Must start with resolved root + separator, or be exact root
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Security Violation: Path '${targetPath}' escapes root '${rootPath}'`);
  }

  // Prevent null bytes
  if (resolvedTarget.includes('\0')) {
    throw new Error('Security Violation: Path contains null bytes');
  }

  return resolvedTarget;
}

/**
 * Streaming SHA-256 hash calculation
 */
export async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('error', (err) => reject(err));
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Reads a brief text snippet for document classification if text extraction enabled
 */
export async function getFileSnippet(filePath: string, ext: string): Promise<string | undefined> {
  if (!['.txt', '.md', '.csv', '.json', '.html', '.yaml', '.yml'].includes(ext.toLowerCase())) {
    return undefined;
  }
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > 2 * 1024 * 1024) {
      return undefined; // skip if > 2MB
    }
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content.slice(0, 300);
  } catch {
    return undefined;
  }
}

/**
 * Scans a folder recursively and collects file metadata
 */
export async function scanDirectory(
  dirPath: string,
  maxDepth = 6,
  onProgress?: (scannedCount: number) => void
): Promise<{ files: ScannedFileInfo[]; duplicateGroups: DuplicateGroup[]; totalBytes: number }> {
  const root = path.resolve(dirPath);
  if (!fs.existsSync(root)) {
    throw new Error(`Directory does not exist: ${dirPath}`);
  }
  const rootStat = await fs.promises.stat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }

  const files: ScannedFileInfo[] = [];
  const hashMap = new Map<string, ScannedFileInfo[]>();
  let totalBytes = 0;

  async function walk(currentDir: string, currentDepth: number): Promise<void> {
    if (currentDepth > maxDepth) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      console.warn(`Could not read directory ${currentDir}:`, err);
      return;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      if (EXCLUDED_DIRS.has(entryName) || entryName.startsWith('.slowsort')) {
        continue;
      }

      const fullPath = path.join(currentDir, entryName);

      if (entry.isDirectory()) {
        await walk(fullPath, currentDepth + 1);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          const ext = path.extname(entryName).toLowerCase();
          const mimeType = MIME_MAP[ext] || 'application/octet-stream';
          const relativePath = path.relative(root, fullPath).replace(/\\+/g, '/');

          // Compute streaming SHA-256 hash
          const sha256Hash = await computeFileHash(fullPath);

          const fileInfo: ScannedFileInfo = {
            id: `file_${crypto.randomUUID()}`,
            relativePath,
            filename: entryName,
            extension: ext,
            mimeType,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            sha256Hash,
          };

          files.push(fileInfo);
          totalBytes += stat.size;

          const group = hashMap.get(sha256Hash) || [];
          group.push(fileInfo);
          hashMap.set(sha256Hash, group);

          if (onProgress && files.length % 10 === 0) {
            onProgress(files.length);
          }
        } catch (fileErr) {
          console.warn(`Skipping unreadable file ${fullPath}:`, fileErr);
        }
      }
    }
  }

  await walk(root, 0);

  // Collect duplicate groups (2 or more files with same SHA-256)
  const duplicateGroups: DuplicateGroup[] = [];
  for (const [hash, groupFiles] of hashMap.entries()) {
    if (groupFiles.length > 1) {
      duplicateGroups.push({
        hash,
        sizeBytes: groupFiles[0].sizeBytes,
        files: groupFiles,
      });
    }
  }

  return { files, duplicateGroups, totalBytes };
}

/**
 * Safely executes a file operation (move / rename) within root
 */
export async function executeFileOperation(
  rootPath: string,
  sourceRelativePath: string,
  targetRelativePath: string,
  expectedHash: string
): Promise<{ success: boolean; error?: string; actualDestPath: string }> {
  const resolvedRoot = path.resolve(rootPath);
  const sourceAbs = assertPathWithinRoot(sourceRelativePath, resolvedRoot);
  const targetAbs = assertPathWithinRoot(targetRelativePath, resolvedRoot);

  // 1. Verify source exists
  if (!fs.existsSync(sourceAbs)) {
    return { success: false, error: `Source file no longer exists at ${sourceRelativePath}`, actualDestPath: targetAbs };
  }

  // 2. Re-verify file hash hasn't mutated
  try {
    const currentHash = await computeFileHash(sourceAbs);
    if (currentHash !== expectedHash) {
      return { success: false, error: 'Source file was modified since scan (hash mismatch)', actualDestPath: targetAbs };
    }
  } catch (hashErr) {
    return { success: false, error: `Failed to re-verify source file hash: ${hashErr}`, actualDestPath: targetAbs };
  }

  // 3. Collision check: target must not exist (unless source == target)
  if (sourceAbs === targetAbs) {
    return { success: true, actualDestPath: targetAbs }; // No-op keep
  }

  if (fs.existsSync(targetAbs)) {
    return { success: false, error: `Target path already exists: ${targetRelativePath}. Refusing overwrite.`, actualDestPath: targetAbs };
  }

  // 4. Create target directory
  const targetDir = path.dirname(targetAbs);
  await fs.promises.mkdir(targetDir, { recursive: true });

  // 5. Execute move / rename
  try {
    await fs.promises.rename(sourceAbs, targetAbs);
  } catch (err: unknown) {
    // Cross-device link fallback
    const code = (err as { code?: string }).code;
    if (code === 'EXDEV') {
      await fs.promises.copyFile(sourceAbs, targetAbs);
      await fs.promises.unlink(sourceAbs);
    } else {
      return { success: false, error: `Failed to move file: ${err}`, actualDestPath: targetAbs };
    }
  }

  // 6. Post-execution verification
  if (!fs.existsSync(targetAbs)) {
    return { success: false, error: 'Post-check failed: target file does not exist after move', actualDestPath: targetAbs };
  }

  const postHash = await computeFileHash(targetAbs);
  if (postHash !== expectedHash) {
    return { success: false, error: 'Post-check failed: target file hash does not match original', actualDestPath: targetAbs };
  }

  return { success: true, actualDestPath: targetAbs };
}

/**
 * Reverses a previously executed move/rename
 */
export async function undoFileOperation(
  rootPath: string,
  currentAbsPath: string,
  originalAbsPath: string,
  expectedHash: string
): Promise<{ success: boolean; error?: string }> {
  const resolvedRoot = path.resolve(rootPath);
  const curAbs = assertPathWithinRoot(currentAbsPath, resolvedRoot);
  const origAbs = assertPathWithinRoot(originalAbsPath, resolvedRoot);

  if (!fs.existsSync(curAbs)) {
    return { success: false, error: `File no longer exists at destination '${currentAbsPath}'` };
  }

  // Check current hash
  const curHash = await computeFileHash(curAbs);
  if (curHash !== expectedHash) {
    return { success: false, error: 'File at destination has been modified; undo refused to prevent data loss.' };
  }

  // Verify original path is free
  if (fs.existsSync(origAbs)) {
    return { success: false, error: `Original path '${originalAbsPath}' is now occupied by another file. Collision prevented.` };
  }

  // Ensure original directory exists
  const origDir = path.dirname(origAbs);
  await fs.promises.mkdir(origDir, { recursive: true });

  // Rename back
  await fs.promises.rename(curAbs, origAbs);

  // Verify post-undo
  if (!fs.existsSync(origAbs)) {
    return { success: false, error: 'Post-undo verification failed.' };
  }

  return { success: true };
}

/**
 * Helper to initialize a clean, empty workspace folder on disk
 */
export async function createEmptyWorkspaceFolder(dirPath: string): Promise<string> {
  const root = path.resolve(dirPath);
  await fs.promises.mkdir(root, { recursive: true });
  return root;
}
