import { describe, it, expect } from 'vitest';
import { AiClassificationSchema } from '../server/types/schemas.ts';
import {
  deterministicClassify,
  sanitizeFolderName,
  sanitizeFilename,
  checkGeminiStatus,
  classifyFileWithGemini,
} from '../server/services/geminiService.ts';

describe('Gemini AI & Classification Resiliency', () => {
  it('validates strictly structured AI response JSON', () => {
    const validJson = {
      category: 'Finance',
      suggested_folder: 'Finance/Invoices',
      suggested_filename: 'aws_invoice_2026.pdf',
      explanation: 'Detected AWS invoice from metadata',
      confidence: 0.95,
      potential_conflict: null,
    };

    const parsed = AiClassificationSchema.safeParse(validJson);
    expect(parsed.success).toBe(true);
  });

  it('rejects malformed AI responses missing required fields or having wrong types', () => {
    const invalidJson = {
      category: 'Finance',
      // missing suggested_folder
      confidence: 'ninety-five', // wrong type
    };

    const parsed = AiClassificationSchema.safeParse(invalidJson);
    expect(parsed.success).toBe(false);
  });

  it('sanitizes folder names to eliminate path traversal and null bytes', () => {
    expect(sanitizeFolderName('../../../etc/evil')).toBe('etc/evil');
    expect(sanitizeFolderName('/absolute/path')).toBe('absolute/path');
    expect(sanitizeFolderName('Documents/Finances/*special?')).toBe('Documents/Finances/_special_');
    expect(sanitizeFolderName('')).toBe('Unsorted');
  });

  it('sanitizes filenames and preserves original extension', () => {
    expect(sanitizeFilename('my_report', '.pdf')).toBe('my_report.pdf');
    expect(sanitizeFilename('dangerous/../../file.txt', '.txt')).toBe('file.txt');
    expect(sanitizeFilename('invalid:name*bad?.docx', '.docx')).toBe('invalid_name_bad_.docx');
  });

  it('accurately categorizes common file types with deterministic engine fallback', () => {
    const invoiceFile = {
      filename: 'invoice_march_2026.pdf',
      relativePath: 'invoice_march_2026.pdf',
      extension: '.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10240,
      modifiedAt: '2026-10-19T00:00:00Z',
    };
    const invClass = deterministicClassify(invoiceFile);
    expect(invClass.category).toBe('Finance');
    expect(invClass.suggested_folder).toBe('Finance/Receipts');

    const screenshotFile = {
      filename: 'Screenshot 2026-10-19 at 9.00.00 AM.png',
      relativePath: 'Screenshot 2026-10-19 at 9.00.00 AM.png',
      extension: '.png',
      mimeType: 'image/png',
      sizeBytes: 250000,
      modifiedAt: '2026-10-19T00:00:00Z',
    };
    const scrClass = deterministicClassify(screenshotFile);
    expect(scrClass.category).toBe('Images');
    expect(scrClass.suggested_folder).toBe('Images/Screenshots');

    const codeFile = {
      filename: 'apiRouter.ts',
      relativePath: 'apiRouter.ts',
      extension: '.ts',
      mimeType: 'text/typescript',
      sizeBytes: 4096,
      modifiedAt: '2026-10-19T00:00:00Z',
    };
    const codeClass = deterministicClassify(codeFile);
    expect(codeClass.category).toBe('Code');
  });

  it('returns honest status when checking Gemini API key without crashing', async () => {
    const status = await checkGeminiStatus('gemini-3.8-flash');
    expect(status.configuredModel).toBe('gemini-3.8-flash');
    expect(typeof status.hasKey).toBe('boolean');
    if (!status.hasKey) {
      expect(status.error).toMatch(/GEMINI_API_KEY/i);
    }
  });

  it('falls back to rule engine honestly if key is absent or call fails', async () => {
    const result = await classifyFileWithGemini('gemini-3.8-flash', {
      filename: 'quarterly_taxes_2026.pdf',
      relativePath: 'quarterly_taxes_2026.pdf',
      extension: '.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12000,
      modifiedAt: '2026-10-20T00:00:00Z',
    });
    expect(result.classification).toBeDefined();
    expect(result.classification.suggested_folder).toBeDefined();
    expect(['gemini', 'rule_fallback']).toContain(result.source);
  }, 15000);
});
