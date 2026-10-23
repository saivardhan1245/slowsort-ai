import express, { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { getDb, saveDb } from '../db/database.js';
import {
  ConnectWorkspaceSchema,
  UpdateSettingsSchema,
  ExecuteOperationsSchema,
  UndoOperationSchema,
  type ScannedFileInfo,
  type ProposalItem,
  type OperationHistoryItem,
  type DuplicateGroup,
} from '../types/schemas.js';
import {
  checkGeminiStatus,
  classifyFileWithGemini,
  sanitizeFolderName,
  sanitizeFilename,
} from '../services/geminiService.js';
import {
  scanDirectory,
  executeFileOperation,
  undoFileOperation,
  createEmptyWorkspaceFolder,
  getFileSnippet,
  assertPathWithinRoot,
  computeFileHash,
} from '../services/filesystemService.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file max
});

export const apiRouter = express.Router();

function getSetting(db: any, key: string, defaultVal: string): string {
  try {
    const res = db.exec(`SELECT value FROM settings WHERE key = '${key}'`);
    if (res.length > 0 && res[0].values.length > 0) {
      return String(res[0].values[0][0]);
    }
  } catch (err) {
    console.warn(`Error getting setting ${key}:`, err);
  }
  return defaultVal;
}

function setSetting(db: any, key: string, value: string): void {
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
  saveDb();
}

/**
 * AI status check - Gemini API
 */
apiRouter.get('/ai/status', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const geminiModel = getSetting(db, 'gemini_model', process.env.GEMINI_MODEL || 'gemini-3.8-flash');

    const status = await checkGeminiStatus(geminiModel);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check Gemini status' });
  }
});

/**
 * Get and update settings
 */
apiRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const settings = {
      gemini_model: getSetting(db, 'gemini_model', process.env.GEMINI_MODEL || 'gemini-3.8-flash'),
      extract_text_content: getSetting(db, 'extract_text_content', 'false') === 'true',
      max_scan_depth: parseInt(getSetting(db, 'max_scan_depth', '6'), 10),
      allowed_root: getSetting(db, 'allowed_root', process.cwd()),
    };
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings', async (req: Request, res: Response) => {
  try {
    const parsed = UpdateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid settings data', details: parsed.error.issues });
    }

    const db = await getDb();
    setSetting(db, 'gemini_model', parsed.data.gemini_model);
    setSetting(db, 'extract_text_content', parsed.data.extract_text_content ? 'true' : 'false');
    setSetting(db, 'max_scan_depth', String(parsed.data.max_scan_depth));
    setSetting(db, 'allowed_root', parsed.data.allowed_root);

    res.json({ success: true, settings: parsed.data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Workspace connection status
 */
apiRouter.get('/workspace/status', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const resRow = db.exec('SELECT folder_path, connected_at FROM workspace WHERE id = 1');
    if (resRow.length === 0 || resRow[0].values.length === 0) {
      return res.json({ connected: false });
    }

    const folderPath = String(resRow[0].values[0][0]);
    const connectedAt = String(resRow[0].values[0][1]);
    const exists = fs.existsSync(folderPath);

    let fileCount = 0;
    if (exists) {
      try {
        const stats = await fs.promises.stat(folderPath);
        if (stats.isDirectory()) {
          const files = await fs.promises.readdir(folderPath);
          fileCount = files.length;
        }
      } catch {
        // ignore
      }
    }

    res.json({
      connected: true,
      folderPath,
      connectedAt,
      exists,
      immediateItemsCount: fileCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Connect folder
 */
apiRouter.post('/workspace/connect', async (req: Request, res: Response) => {
  try {
    const parsed = ConnectWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'folderPath is required' });
    }

    const targetFolder = path.resolve(parsed.data.folderPath);
    if (!fs.existsSync(targetFolder)) {
      return res.status(404).json({ error: `Directory not found: ${targetFolder}` });
    }

    const stat = await fs.promises.stat(targetFolder);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: `Path is not a directory: ${targetFolder}` });
    }

    const db = await getDb();
    const allowedRoot = getSetting(db, 'allowed_root', process.cwd());

    // Validate path within allowed boundary
    try {
      assertPathWithinRoot(targetFolder, allowedRoot);
    } catch {
      // If the user deliberately selected a folder outside current cwd, allow updating allowed_root
      // if it's an accessible directory on their local machine
      setSetting(db, 'allowed_root', targetFolder);
    }

    const now = new Date().toISOString();
    db.run('INSERT OR REPLACE INTO workspace (id, folder_path, connected_at) VALUES (1, ?, ?)', [
      targetFolder,
      now,
    ]);
    saveDb();

    res.json({
      success: true,
      folderPath: targetFolder,
      connectedAt: now,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Disconnect folder
 */
apiRouter.post('/workspace/disconnect', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM workspace WHERE id = 1');
    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Directory browser for local selection
 */
apiRouter.get('/workspace/browse', async (req: Request, res: Response) => {
  try {
    const queryPath = (req.query.path as string) || process.cwd();
    const resolved = path.resolve(queryPath);

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Directory does not exist' });
    }

    const stat = await fs.promises.stat(resolved);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Target is not a directory' });
    }

    const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
    const directories: string[] = [];
    const files: string[] = [];

    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      if (e.isDirectory()) {
        directories.push(e.name);
      } else {
        files.push(e.name);
      }
    }

    res.json({
      currentPath: resolved,
      parentPath: path.dirname(resolved) !== resolved ? path.dirname(resolved) : null,
      directories: directories.sort(),
      filesCount: files.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * File preview & content inspection endpoint
 */
apiRouter.get('/workspace/file-preview', async (req: Request, res: Response) => {
  try {
    const relPath = req.query.path as string;
    const raw = req.query.raw === 'true';

    if (!relPath) {
      return res.status(400).json({ error: 'path query parameter is required' });
    }

    const db = await getDb();
    const wsRow = db.exec('SELECT folder_path FROM workspace WHERE id = 1');
    if (wsRow.length === 0 || wsRow[0].values.length === 0) {
      return res.status(400).json({ error: 'No workspace folder connected' });
    }

    const rootPath = String(wsRow[0].values[0][0]);
    const absPath = assertPathWithinRoot(relPath, rootPath);

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: `File not found: ${relPath}` });
    }

    const stat = await fs.promises.stat(absPath);
    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Path is a directory, not a file' });
    }

    const ext = path.extname(relPath).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext);
    const isText = [
      '.txt',
      '.md',
      '.json',
      '.csv',
      '.html',
      '.css',
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.py',
      '.sh',
      '.yml',
      '.yaml',
      '.sql',
      '.log',
    ].includes(ext);

    if (raw) {
      return res.sendFile(absPath);
    }

    let textContent: string | null = null;
    if (isText && stat.size <= 2 * 1024 * 1024) {
      // Read up to 4000 characters
      const buffer = await fs.promises.readFile(absPath, 'utf-8');
      textContent = buffer.slice(0, 4000);
    }

    res.json({
      relativePath: relPath,
      filename: path.basename(relPath),
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      extension: ext,
      isImage,
      isText,
      textContent,
      rawUrl: `/api/workspace/file-preview?path=${encodeURIComponent(relPath)}&raw=true`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create a fresh, empty workspace folder without any fake dummy files
 */
apiRouter.post('/workspace/create-folder', async (req: Request, res: Response) => {
  try {
    const rawPath = req.body?.folderPath || req.body?.folderName;
    const folderPath = rawPath
      ? path.resolve(rawPath)
      : path.resolve(process.cwd(), 'workspace');

    await createEmptyWorkspaceFolder(folderPath);

    const db = await getDb();
    const now = new Date().toISOString();
    db.run('INSERT OR REPLACE INTO workspace (id, folder_path, connected_at) VALUES (1, ?, ?)', [
      folderPath,
      now,
    ]);
    // Clear past scans so the new workspace starts fresh
    db.run('DELETE FROM scans');
    db.run('DELETE FROM scanned_files');
    db.run('DELETE FROM proposals');
    saveDb();

    res.json({
      success: true,
      folderPath,
      message: 'Created fresh, clean workspace directory.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Backward compatibility alias for create-sandbox: creates a clean folder with zero fake files
 */
apiRouter.post('/workspace/create-sandbox', async (req: Request, res: Response) => {
  try {
    const folderPath = path.resolve(process.cwd(), 'workspace');
    await createEmptyWorkspaceFolder(folderPath);

    const db = await getDb();
    const now = new Date().toISOString();
    db.run('INSERT OR REPLACE INTO workspace (id, folder_path, connected_at) VALUES (1, ?, ?)', [
      folderPath,
      now,
    ]);
    db.run('DELETE FROM scans');
    db.run('DELETE FROM scanned_files');
    db.run('DELETE FROM proposals');
    saveDb();

    res.json({
      success: true,
      folderPath,
      message: 'Created clean workspace directory.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Upload real files from the user's computer directly into the active workspace
 */
apiRouter.post('/workspace/upload', upload.array('files', 100), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const db = await getDb();
    let wsRow = db.exec('SELECT folder_path FROM workspace WHERE id = 1');
    let targetFolder: string;

    if (wsRow.length === 0 || wsRow[0].values.length === 0) {
      // If no workspace is connected yet, auto-create a clean workspace directory
      targetFolder = path.resolve(process.cwd(), 'workspace');
      await createEmptyWorkspaceFolder(targetFolder);
      const now = new Date().toISOString();
      db.run('INSERT OR REPLACE INTO workspace (id, folder_path, connected_at) VALUES (1, ?, ?)', [
        targetFolder,
        now,
      ]);
      saveDb();
    } else {
      targetFolder = String(wsRow[0].values[0][0]);
    }

    if (!fs.existsSync(targetFolder)) {
      await fs.promises.mkdir(targetFolder, { recursive: true });
    }

    const savedFiles: Array<{ filename: string; size: number; path: string }> = [];

    for (const file of files) {
      // Sanitize filename to prevent directory traversal
      const safeBasename = path.basename(file.originalname).replace(/[\0\r\n\t]/g, '');
      const cleanName = safeBasename || `upload_${Date.now()}`;

      let finalFilename = cleanName;
      let destPath = assertPathWithinRoot(finalFilename, targetFolder);

      // If file already exists, create distinct copy to prevent accidental data loss
      // and allow testing real duplicate detection
      if (fs.existsSync(destPath)) {
        const ext = path.extname(cleanName);
        const base = path.basename(cleanName, ext);
        let counter = 1;
        while (fs.existsSync(destPath)) {
          finalFilename = `${base} (copy ${counter})${ext}`;
          destPath = assertPathWithinRoot(finalFilename, targetFolder);
          counter++;
        }
      }

      // Write real file buffer to disk
      await fs.promises.writeFile(destPath, file.buffer);
      savedFiles.push({
        filename: finalFilename,
        size: file.buffer.length,
        path: destPath,
      });
    }

    res.json({
      success: true,
      uploadedCount: savedFiles.length,
      files: savedFiles,
      folderPath: targetFolder,
      message: `Uploaded ${savedFiles.length} real files to ${targetFolder}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Reset workspace and clear scan state
 */
apiRouter.post('/workspace/reset', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM workspace WHERE id = 1');
    db.run('DELETE FROM scans');
    db.run('DELETE FROM scanned_files');
    db.run('DELETE FROM proposals');
    saveDb();
    res.json({ success: true, message: 'Workspace reset successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Clear operation history
 */
apiRouter.post('/history/clear', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM operations_history');
    saveDb();
    res.json({ success: true, message: 'History cleared successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * Start scanning the connected folder
 */
apiRouter.post('/scan/start', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const wsRow = db.exec('SELECT folder_path FROM workspace WHERE id = 1');
    if (wsRow.length === 0 || wsRow[0].values.length === 0) {
      return res.status(400).json({ error: 'No workspace folder connected. Connect a folder first.' });
    }

    const folderPath = String(wsRow[0].values[0][0]);
    const maxDepth = parseInt(getSetting(db, 'max_scan_depth', '6'), 10);

    const scanResult = await scanDirectory(folderPath, maxDepth);

    const scanId = `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const scannedAt = new Date().toISOString();

    // Store scan record in SQLite
    db.run(
      `INSERT INTO scans (id, folder_path, scanned_at, file_count, total_bytes, duplicate_groups_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        scanId,
        folderPath,
        scannedAt,
        scanResult.files.length,
        scanResult.totalBytes,
        scanResult.duplicateGroups.length,
      ]
    );

    // Clear old proposals for clean new scan session
    db.run('DELETE FROM scanned_files');
    db.run('DELETE FROM proposals WHERE status = "pending"');

    // Batch insert scanned files
    for (const f of scanResult.files) {
      db.run(
        `INSERT INTO scanned_files (id, scan_id, relative_path, filename, extension, mime_type, size_bytes, modified_at, sha256_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.id,
          scanId,
          f.relativePath,
          f.filename,
          f.extension,
          f.mimeType,
          f.sizeBytes,
          f.modifiedAt,
          f.sha256Hash,
        ]
      );
    }
    saveDb();

    res.json({
      scanId,
      folderPath,
      scannedAt,
      fileCount: scanResult.files.length,
      totalBytes: scanResult.totalBytes,
      duplicateGroupsCount: scanResult.duplicateGroups.length,
      files: scanResult.files,
      duplicateGroups: scanResult.duplicateGroups,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get current scan files and stats
 */
apiRouter.get('/scan/current', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const scanRow = db.exec('SELECT id, folder_path, scanned_at, file_count, total_bytes, duplicate_groups_count FROM scans ORDER BY scanned_at DESC LIMIT 1');

    if (scanRow.length === 0 || scanRow[0].values.length === 0) {
      return res.json({ hasScan: false });
    }

    const row = scanRow[0].values[0];
    const scanId = String(row[0]);
    const folderPath = String(row[1]);
    const scannedAt = String(row[2]);
    const fileCount = Number(row[3]);
    const totalBytes = Number(row[4]);
    const duplicateGroupsCount = Number(row[5]);

    const filesQuery = db.exec(`SELECT id, relative_path, filename, extension, mime_type, size_bytes, modified_at, sha256_hash FROM scanned_files WHERE scan_id = '${scanId}'`);

    const files: ScannedFileInfo[] = [];
    const hashMap = new Map<string, ScannedFileInfo[]>();

    if (filesQuery.length > 0) {
      for (const val of filesQuery[0].values) {
        const item: ScannedFileInfo = {
          id: String(val[0]),
          relativePath: String(val[1]),
          filename: String(val[2]),
          extension: String(val[3]),
          mimeType: String(val[4] || ''),
          sizeBytes: Number(val[5]),
          modifiedAt: String(val[6]),
          sha256Hash: String(val[7]),
        };
        files.push(item);

        const group = hashMap.get(item.sha256Hash) || [];
        group.push(item);
        hashMap.set(item.sha256Hash, group);
      }
    }

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

    res.json({
      hasScan: true,
      scanId,
      folderPath,
      scannedAt,
      fileCount,
      totalBytes,
      duplicateGroupsCount,
      files,
      duplicateGroups,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Generate AI organization proposals
 */
apiRouter.post('/ai/analyze', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const wsRow = db.exec('SELECT folder_path FROM workspace WHERE id = 1');
    if (wsRow.length === 0 || wsRow[0].values.length === 0) {
      return res.status(400).json({ error: 'No workspace folder connected' });
    }

    const rootPath = String(wsRow[0].values[0][0]);
    const scanRow = db.exec('SELECT id FROM scans ORDER BY scanned_at DESC LIMIT 1');
    if (scanRow.length === 0 || scanRow[0].values.length === 0) {
      return res.status(400).json({ error: 'No scan completed yet. Run a scan first.' });
    }
    const scanId = String(scanRow[0].values[0][0]);

    const geminiModel = getSetting(db, 'gemini_model', process.env.GEMINI_MODEL || 'gemini-3.8-flash');
    const extractText = getSetting(db, 'extract_text_content', 'false') === 'true';

    // Get scanned files
    const filesQuery = db.exec(`SELECT id, relative_path, filename, extension, mime_type, size_bytes, modified_at, sha256_hash FROM scanned_files WHERE scan_id = '${scanId}'`);
    if (filesQuery.length === 0 || filesQuery[0].values.length === 0) {
      return res.status(400).json({ error: 'No files in current scan' });
    }

    // Clear previous proposals for this scan
    db.run(`DELETE FROM proposals WHERE scan_id = ?`, [scanId]);

    const proposals: ProposalItem[] = [];

    for (const val of filesQuery[0].values) {
      const relPath = String(val[1]);
      const filename = String(val[2]);
      const ext = String(val[3]);
      const mime = String(val[4] || '');
      const sizeBytes = Number(val[5]);
      const modifiedAt = String(val[6]);

      let snippet: string | undefined;
      if (extractText) {
        const fullPath = path.join(rootPath, relPath);
        snippet = await getFileSnippet(fullPath, ext);
      }

      const { classification, source, notice } = await classifyFileWithGemini(
        geminiModel,
        {
          filename,
          relativePath: relPath,
          extension: ext,
          mimeType: mime,
          sizeBytes,
          modifiedAt,
          snippet,
        }
      );

      const targetFolder = sanitizeFolderName(classification.suggested_folder);
      const targetFilename = sanitizeFilename(classification.suggested_filename, ext);
      const targetRelPath = `${targetFolder}/${targetFilename}`.replace(/\/+/g, '/');

      // Determine operation type
      let opType: 'move' | 'rename' | 'keep' | 'move_and_rename' = 'move';
      const curFolder = path.dirname(relPath).replace(/\\+/g, '/');
      const sameFolder = (curFolder === '.' && targetFolder === '') || curFolder === targetFolder;
      const sameName = filename === targetFilename;

      if (sameFolder && sameName) {
        opType = 'keep';
      } else if (sameFolder && !sameName) {
        opType = 'rename';
      } else if (!sameFolder && sameName) {
        opType = 'move';
      } else {
        opType = 'move_and_rename';
      }

      // Check conflict if target file already exists in filesystem
      let conflictWarning: string | null = null;
      const fullTarget = path.join(rootPath, targetRelPath);
      const fullSource = path.join(rootPath, relPath);
      if (fullTarget !== fullSource && fs.existsSync(fullTarget)) {
        conflictWarning = `File already exists at '${targetRelPath}'. Overwrite is blocked.`;
      }

      const proposalId = `prop_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();
      const reasonLabel =
        classification.explanation +
        (source === 'gemini'
          ? ` (Gemini AI: ${geminiModel})`
          : notice
          ? ` (${notice})`
          : ' (Local rule engine)');

      db.run(
        `INSERT INTO proposals (id, scan_id, source_relative_path, target_relative_path, original_filename, proposed_filename, category, reason, confidence, operation_type, conflict_warning, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          proposalId,
          scanId,
          relPath,
          targetRelPath,
          filename,
          targetFilename,
          classification.category,
          reasonLabel,
          classification.confidence,
          opType,
          conflictWarning,
          opType === 'keep' ? 'rejected' : 'pending',
          now,
        ]
      );

      proposals.push({
        id: proposalId,
        scanId,
        sourceRelativePath: relPath,
        targetRelativePath: targetRelPath,
        originalFilename: filename,
        proposedFilename: targetFilename,
        category: classification.category,
        reason: reasonLabel,
        confidence: classification.confidence,
        operationType: opType,
        conflictWarning,
        status: opType === 'keep' ? 'rejected' : 'pending',
        createdAt: now,
      });
    }

    saveDb();
    res.json({ proposals, count: proposals.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * List proposals
 */
apiRouter.get('/proposals', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const query = db.exec(`
      SELECT id, scan_id, source_relative_path, target_relative_path, original_filename, proposed_filename, category, reason, confidence, operation_type, conflict_warning, status, created_at
      FROM proposals
      ORDER BY created_at DESC
    `);

    if (query.length === 0) {
      return res.json({ proposals: [] });
    }

    const proposals: ProposalItem[] = query[0].values.map((v) => ({
      id: String(v[0]),
      scanId: String(v[1]),
      sourceRelativePath: String(v[2]),
      targetRelativePath: String(v[3]),
      originalFilename: String(v[4]),
      proposedFilename: String(v[5]),
      category: String(v[6]),
      reason: String(v[7]),
      confidence: Number(v[8]),
      operationType: String(v[9]) as any,
      conflictWarning: v[10] ? String(v[10]) : null,
      status: String(v[11]) as any,
      createdAt: String(v[12]),
    }));

    res.json({ proposals });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update proposal status or target path
 */
apiRouter.patch('/proposals/:id', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;
    const { status, targetRelativePath, proposedFilename } = req.body;

    const db = await getDb();
    const existing = db.exec(`SELECT id FROM proposals WHERE id = '${proposalId}'`);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (status) {
      db.run(`UPDATE proposals SET status = ? WHERE id = ?`, [status, proposalId]);
    }
    if (targetRelativePath) {
      db.run(`UPDATE proposals SET target_relative_path = ? WHERE id = ?`, [
        targetRelativePath,
        proposalId,
      ]);
    }
    if (proposedFilename) {
      db.run(`UPDATE proposals SET proposed_filename = ? WHERE id = ?`, [
        proposedFilename,
        proposalId,
      ]);
    }
    saveDb();

    res.json({ success: true, proposalId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Execute approved proposals
 */
apiRouter.post('/proposals/execute', async (req: Request, res: Response) => {
  try {
    const parsed = ExecuteOperationsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid operation execution request' });
    }

    const db = await getDb();
    const wsRow = db.exec('SELECT folder_path FROM workspace WHERE id = 1');
    if (wsRow.length === 0 || wsRow[0].values.length === 0) {
      return res.status(400).json({ error: 'No workspace folder connected' });
    }
    const rootPath = String(wsRow[0].values[0][0]);

    const batchId = `batch_${Date.now()}`;
    const results: Array<{ proposalId: string; success: boolean; error?: string }> = [];

    for (const proposalId of parsed.data.proposalIds) {
      const propQuery = db.exec(`
        SELECT p.id, p.source_relative_path, p.target_relative_path, p.operation_type, s.sha256_hash, s.size_bytes
        FROM proposals p
        LEFT JOIN scanned_files s ON s.relative_path = p.source_relative_path
        WHERE p.id = '${proposalId}'
      `);

      if (propQuery.length === 0 || propQuery[0].values.length === 0) {
        results.push({ proposalId, success: false, error: 'Proposal not found' });
        continue;
      }

      const row = propQuery[0].values[0];
      const sourceRel = String(row[1]);
      const targetRel = String(row[2]);
      const opType = String(row[3]);
      const expectedHash = String(row[4] || '');
      const fileSize = Number(row[5] || 0);

      // Execute safely
      const opResult = await executeFileOperation(rootPath, sourceRel, targetRel, expectedHash);

      const opHistoryId = `op_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();

      if (opResult.success) {
        db.run(`UPDATE proposals SET status = 'executed' WHERE id = ?`, [proposalId]);
        db.run(
          `INSERT INTO operations_history (id, proposal_id, batch_id, operation_type, source_path, destination_path, file_hash, file_size, status, error_message, executed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', NULL, ?)`,
          [
            opHistoryId,
            proposalId,
            batchId,
            opType,
            sourceRel,
            targetRel,
            expectedHash,
            fileSize,
            now,
          ]
        );
        results.push({ proposalId, success: true });
      } else {
        db.run(`UPDATE proposals SET status = 'failed' WHERE id = ?`, [proposalId]);
        db.run(
          `INSERT INTO operations_history (id, proposal_id, batch_id, operation_type, source_path, destination_path, file_hash, file_size, status, error_message, executed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?)`,
          [
            opHistoryId,
            proposalId,
            batchId,
            opType,
            sourceRel,
            targetRel,
            expectedHash,
            fileSize,
            opResult.error || 'Unknown execution error',
            now,
          ]
        );
        results.push({ proposalId, success: false, error: opResult.error });
      }
    }

    saveDb();
    res.json({ batchId, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get operation history
 */
apiRouter.get('/history', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const query = db.exec(`
      SELECT id, proposal_id, batch_id, operation_type, source_path, destination_path, file_hash, file_size, status, error_message, executed_at, undone_at
      FROM operations_history
      ORDER BY executed_at DESC
    `);

    if (query.length === 0) {
      return res.json({ history: [] });
    }

    const history: OperationHistoryItem[] = query[0].values.map((v) => ({
      id: String(v[0]),
      proposalId: v[1] ? String(v[1]) : null,
      batchId: String(v[2]),
      operationType: String(v[3]),
      sourcePath: String(v[4]),
      destinationPath: String(v[5]),
      fileHash: String(v[6]),
      fileSize: Number(v[7]),
      status: String(v[8]) as any,
      errorMessage: v[9] ? String(v[9]) : null,
      executedAt: String(v[10]),
      undoneAt: v[11] ? String(v[11]) : null,
    }));

    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Undo operation
 */
apiRouter.post('/history/undo', async (req: Request, res: Response) => {
  try {
    const parsed = UndoOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'operationId is required' });
    }

    const db = await getDb();
    const wsRow = db.exec('SELECT folder_path FROM workspace WHERE id = 1');
    if (wsRow.length === 0 || wsRow[0].values.length === 0) {
      return res.status(400).json({ error: 'No workspace folder connected' });
    }
    const rootPath = String(wsRow[0].values[0][0]);

    const opQuery = db.exec(`
      SELECT id, source_path, destination_path, file_hash, status
      FROM operations_history
      WHERE id = '${parsed.data.operationId}'
    `);

    if (opQuery.length === 0 || opQuery[0].values.length === 0) {
      return res.status(404).json({ error: 'Operation record not found' });
    }

    const row = opQuery[0].values[0];
    const opId = String(row[0]);
    const originalRel = String(row[1]);
    const currentRel = String(row[2]);
    const expectedHash = String(row[3]);
    const status = String(row[4]);

    if (status === 'undone') {
      return res.status(400).json({ error: 'Operation has already been undone' });
    }
    if (status !== 'success') {
      return res.status(400).json({ error: 'Cannot undo a failed operation' });
    }

    const undoResult = await undoFileOperation(rootPath, currentRel, originalRel, expectedHash);

    if (!undoResult.success) {
      return res.status(400).json({ error: undoResult.error });
    }

    const now = new Date().toISOString();
    db.run(`UPDATE operations_history SET status = 'undone', undone_at = ? WHERE id = ?`, [
      now,
      opId,
    ]);
    saveDb();

    res.json({ success: true, operationId: opId, undoneAt: now });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
