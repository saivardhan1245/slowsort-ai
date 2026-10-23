import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  scanDirectory,
  computeFileHash,
  executeFileOperation,
  undoFileOperation,
  assertPathWithinRoot,
} from '../server/services/filesystemService.ts';

describe('Filesystem Service & Security', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'slowsort-test-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('scans an actual directory and computes accurate SHA-256 hashes', async () => {
    // Create actual test files in temp directory
    const file1 = path.join(tempDir, 'document.txt');
    const file2 = path.join(tempDir, 'subfolder', 'data.csv');
    await fs.promises.mkdir(path.join(tempDir, 'subfolder'), { recursive: true });
    await fs.promises.writeFile(file1, 'Hello World Test Content', 'utf-8');
    await fs.promises.writeFile(file2, 'col1,col2\nval1,val2', 'utf-8');

    const result = await scanDirectory(tempDir);
    expect(result.files).toHaveLength(2);
    expect(result.totalBytes).toBeGreaterThan(0);

    const txtFile = result.files.find((f) => f.filename === 'document.txt');
    expect(txtFile).toBeDefined();
    expect(txtFile?.extension).toBe('.txt');
    expect(txtFile?.sha256Hash).toBeDefined();
    expect(txtFile?.sha256Hash.length).toBe(64); // standard sha256 hex length
  });

  it('detects exact duplicate groups based on streaming SHA-256 hashes', async () => {
    const identicalContent = 'EXACT_DUPLICATE_PAYLOAD_12345';
    const fileA = path.join(tempDir, 'original.pdf');
    const fileB = path.join(tempDir, 'copy_of_original.pdf');
    const uniqueFile = path.join(tempDir, 'different.pdf');

    await fs.promises.writeFile(fileA, identicalContent, 'utf-8');
    await fs.promises.writeFile(fileB, identicalContent, 'utf-8');
    await fs.promises.writeFile(uniqueFile, 'UNIQUE_CONTENT_98765', 'utf-8');

    const result = await scanDirectory(tempDir);
    expect(result.files).toHaveLength(3);
    expect(result.duplicateGroups).toHaveLength(1);
    expect(result.duplicateGroups[0].files).toHaveLength(2);
    expect(result.duplicateGroups[0].files.map((f) => f.filename)).toEqual(
      expect.arrayContaining(['original.pdf', 'copy_of_original.pdf'])
    );
  });

  it('prevents path traversal outside allowed root directory', () => {
    expect(() => {
      assertPathWithinRoot('../../../etc/passwd', tempDir);
    }).toThrow(/Security Violation/);

    expect(() => {
      assertPathWithinRoot('sub/../../../../secret.txt', tempDir);
    }).toThrow(/Security Violation/);
  });

  it('safely moves a file and verifies post-execution state', async () => {
    const sourceName = 'unorganized_report.txt';
    const sourceAbs = path.join(tempDir, sourceName);
    const content = 'Monthly performance metrics report for testing';
    await fs.promises.writeFile(sourceAbs, content, 'utf-8');
    const hash = await computeFileHash(sourceAbs);

    const targetRel = 'Reports/2026/monthly_report.txt';
    const op = await executeFileOperation(tempDir, sourceName, targetRel, hash);

    expect(op.success).toBe(true);
    expect(fs.existsSync(sourceAbs)).toBe(false); // original is moved
    expect(fs.existsSync(path.join(tempDir, targetRel))).toBe(true); // new file exists

    // Re-verify hash of moved file
    const targetHash = await computeFileHash(path.join(tempDir, targetRel));
    expect(targetHash).toBe(hash);
  });

  it('refuses to overwrite an existing target file (collision prevention)', async () => {
    const file1 = path.join(tempDir, 'file1.txt');
    const targetFile = path.join(tempDir, 'already_exists.txt');
    await fs.promises.writeFile(file1, 'Source File', 'utf-8');
    await fs.promises.writeFile(targetFile, 'Existing Target File', 'utf-8');

    const hash1 = await computeFileHash(file1);
    const op = await executeFileOperation(tempDir, 'file1.txt', 'already_exists.txt', hash1);

    expect(op.success).toBe(false);
    expect(op.error).toMatch(/already exists/i);
    // verify target file was not damaged or overwritten
    expect(await fs.promises.readFile(targetFile, 'utf-8')).toBe('Existing Target File');
  });

  it('supports safe undo and rejects undo if target file was mutated', async () => {
    const file = path.join(tempDir, 'task.txt');
    await fs.promises.writeFile(file, 'Initial Content', 'utf-8');
    const hash = await computeFileHash(file);

    // Execute move
    const targetRel = 'Archive/task.txt';
    await executeFileOperation(tempDir, 'task.txt', targetRel, hash);

    // Now undo
    const undoRes = await undoFileOperation(tempDir, targetRel, 'task.txt', hash);
    expect(undoRes.success).toBe(true);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(path.join(tempDir, targetRel))).toBe(false);

    // Now test refusal if content mutated
    await executeFileOperation(tempDir, 'task.txt', targetRel, hash);
    await fs.promises.writeFile(path.join(tempDir, targetRel), 'MUTATED_NEW_CONTENT', 'utf-8');

    const badUndo = await undoFileOperation(tempDir, targetRel, 'task.txt', hash);
    expect(badUndo.success).toBe(false);
    expect(badUndo.error).toMatch(/modified/i);
  });

  it('handles empty directories and unusual filenames safely', async () => {
    const emptySub = path.join(tempDir, 'empty_dir');
    await fs.promises.mkdir(emptySub, { recursive: true });

    // Unusual filenames: spaces, unicode, special safe chars
    const unusualName = 'Report #1 [Final] - 2026.10 & Notes.pdf';
    await fs.promises.writeFile(path.join(tempDir, unusualName), '%PDF-1.4 test', 'utf-8');

    const result = await scanDirectory(tempDir);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].filename).toBe(unusualName);
  });
});
