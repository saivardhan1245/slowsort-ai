import { GoogleGenAI } from '@google/genai';
import { AiClassificationSchema, type AiClassification } from '../types/schemas.js';

export interface GeminiStatus {
  connected: boolean;
  configuredModel: string;
  hasKey: boolean;
  error?: string;
  version?: string;
}

export interface FileMetadataForClassification {
  filename: string;
  relativePath: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  modifiedAt: string;
  snippet?: string;
}

/**
 * Checks backend Gemini configuration and key availability
 */
export async function checkGeminiStatus(modelName = 'gemini-3.8-flash'): Promise<GeminiStatus> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const effectiveModel = modelName || process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  if (!apiKey) {
    return {
      connected: false,
      configuredModel: effectiveModel,
      hasKey: false,
      error: 'GEMINI_API_KEY is not configured in backend environment. AI suggestions will use the built-in deterministic rule engine until a key is added.',
    };
  }

  // Key is present
  return {
    connected: true,
    configuredModel: effectiveModel,
    hasKey: true,
    version: 'Gemini 3.8 Flash',
  };
}

/**
 * Sanitizes folder names to eliminate path traversal, absolute paths, and invalid characters
 */
export function sanitizeFolderName(folder: string): string {
  if (!folder) return 'Unsorted';
  let clean = folder
    .replace(/^(\.\.[\/\\])+/g, '')
    .replace(/^\/+/, '')
    .replace(/\\+/g, '/')
    .replace(/\0/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim();

  // Strip repeated parent traversal parts
  const segments = clean.split('/').filter((s) => s && s !== '.' && s !== '..');
  clean = segments.join('/');

  return clean || 'Unsorted';
}

/**
 * Sanitizes filename and ensures the original extension is retained
 */
export function sanitizeFilename(filename: string, originalExt: string): string {
  let clean = filename
    .replace(/^.*[\\\/]/, '')
    .replace(/\0/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim();

  if (!clean) {
    clean = 'unnamed_file';
  }

  if (originalExt && !clean.toLowerCase().endsWith(originalExt.toLowerCase())) {
    clean += originalExt;
  }
  return clean;
}

/**
 * Classifies a file using the Gemini API. Only file metadata is sent by default.
 */
export async function classifyFileWithGemini(
  modelName: string,
  fileMeta: FileMetadataForClassification
): Promise<{ classification: AiClassification; source: 'gemini' | 'rule_fallback'; notice?: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const effectiveModel = modelName || process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  if (!apiKey) {
    const fallback = deterministicClassify(fileMeta);
    return {
      classification: fallback,
      source: 'rule_fallback',
      notice: 'GEMINI_API_KEY missing: sorted using local rule engine',
    };
  }

  const prompt = `You are a professional local file organization assistant.
Analyze this file's metadata and propose a clean category, destination folder, and optional clearer filename.
Strict requirement: Respond ONLY with a valid JSON object matching this schema:
{
  "category": "Documents|Finance|Legal|Images|Audio|Video|Archives|Code|Spreadsheets|Presentations|Other",
  "suggested_folder": "string (subfolder name relative to root, e.g. 'Documents/Financial' or 'Images/Screenshots')",
  "suggested_filename": "string (clean, descriptive filename with original extension '${fileMeta.extension}', or keep unchanged)",
  "explanation": "brief reason for the recommendation (under 25 words)",
  "confidence": number between 0.1 and 1.0,
  "potential_conflict": null or string description
}

File metadata:
- Filename: ${fileMeta.filename}
- Current path: ${fileMeta.relativePath}
- Extension: ${fileMeta.extension}
- MIME type: ${fileMeta.mimeType}
- Size: ${fileMeta.sizeBytes} bytes
- Modified: ${fileMeta.modifiedAt}
${fileMeta.snippet ? `- Preview text snippet: "${fileMeta.snippet.slice(0, 150)}"` : ''}

Rules:
- Do not use absolute paths.
- Suggest sensible folder names like "Documents/Invoices", "Receipts", "Images/Wallpapers", "Projects/Code".
- If the file is already neatly organized in a specific subfolder, keep suggested_folder matching its parent folder.`;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const generatePromise = ai.models.generateContent({
      model: effectiveModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API call timed out after 8000ms')), 8000)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const text = response.text;
    if (text) {
      const rawJson = JSON.parse(text.trim());
      const parsed = AiClassificationSchema.safeParse(rawJson);
      if (parsed.success) {
        const cleanFolder = sanitizeFolderName(parsed.data.suggested_folder);
        const cleanName = sanitizeFilename(parsed.data.suggested_filename, fileMeta.extension);
        return {
          classification: {
            ...parsed.data,
            suggested_folder: cleanFolder,
            suggested_filename: cleanName,
          },
          source: 'gemini',
        };
      }
    }
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.warn(`Gemini API classification failed for ${fileMeta.filename}:`, errMessage);

    let notice = 'Gemini API call failed; fell back to rule engine';
    if (errMessage.includes('timed out')) {
      notice = 'Gemini API timed out; fell back to rule engine';
    } else if (errMessage.includes('429') || errMessage.toLowerCase().includes('rate limit')) {
      notice = 'Gemini API rate limit reached; fell back to rule engine';
    } else if (errMessage.includes('403') || errMessage.toLowerCase().includes('api_key_invalid')) {
      notice = 'Gemini API key invalid; fell back to rule engine';
    }

    const fallback = deterministicClassify(fileMeta);
    return {
      classification: fallback,
      source: 'rule_fallback',
      notice,
    };
  }

  const fallback = deterministicClassify(fileMeta);
  return { classification: fallback, source: 'rule_fallback' };
}

/**
 * Deterministic local rule engine fallback when API key is unavailable or fails
 */
export function deterministicClassify(fileMeta: FileMetadataForClassification): AiClassification {
  const ext = fileMeta.extension.toLowerCase();
  const name = fileMeta.filename.toLowerCase();

  const parts = fileMeta.relativePath.split('/');
  const isAlreadyInSubfolder = parts.length > 1;

  // Documents & Finance & Legal
  if (['.pdf', '.docx', '.doc', '.odt', '.rtf', '.txt', '.md'].includes(ext)) {
    if (name.includes('invoice') || name.includes('receipt') || name.includes('bill')) {
      return {
        category: 'Finance',
        suggested_folder: 'Finance/Receipts',
        suggested_filename: fileMeta.filename,
        explanation: 'Financial document detected by filename keywords.',
        confidence: 0.95,
      };
    }
    if (name.includes('contract') || name.includes('agreement') || name.includes('nda')) {
      return {
        category: 'Legal',
        suggested_folder: 'Legal/Agreements',
        suggested_filename: fileMeta.filename,
        explanation: 'Legal document identified by filename pattern.',
        confidence: 0.9,
      };
    }
    if (name.includes('resume') || name.includes('cv')) {
      return {
        category: 'Career',
        suggested_folder: 'Documents/Resumes',
        suggested_filename: fileMeta.filename,
        explanation: 'Career or resume document.',
        confidence: 0.95,
      };
    }
    return {
      category: 'Documents',
      suggested_folder: isAlreadyInSubfolder ? parts.slice(0, -1).join('/') : 'Documents',
      suggested_filename: fileMeta.filename,
      explanation: 'General text or document file format.',
      confidence: 0.85,
    };
  }

  // Spreadsheets
  if (['.xlsx', '.xls', '.csv', '.ods', '.tsv'].includes(ext)) {
    return {
      category: 'Spreadsheets',
      suggested_folder: 'Spreadsheets',
      suggested_filename: fileMeta.filename,
      explanation: 'Tabular data or spreadsheet format.',
      confidence: 0.9,
    };
  }

  // Presentations
  if (['.pptx', '.ppt', '.key', '.odp'].includes(ext)) {
    return {
      category: 'Presentations',
      suggested_folder: 'Presentations',
      suggested_filename: fileMeta.filename,
      explanation: 'Slide deck presentation format.',
      confidence: 0.9,
    };
  }

  // Images
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.bmp', '.tiff', '.heic', '.raw'].includes(ext)) {
    if (
      name.startsWith('screenshot') ||
      name.startsWith('screen shot') ||
      name.includes('scr_') ||
      name.includes('captura')
    ) {
      const cleanerName = name.replace(/\s+/g, '_');
      return {
        category: 'Images',
        suggested_folder: 'Images/Screenshots',
        suggested_filename: cleanerName,
        explanation: 'Screen capture detected from naming convention.',
        confidence: 0.95,
      };
    }
    if (name.includes('wallpaper') || name.includes('bg_') || name.includes('desktop')) {
      return {
        category: 'Images',
        suggested_folder: 'Images/Wallpapers',
        suggested_filename: fileMeta.filename,
        explanation: 'Background or wallpaper image.',
        confidence: 0.88,
      };
    }
    return {
      category: 'Images',
      suggested_folder: isAlreadyInSubfolder ? parts.slice(0, -1).join('/') : 'Images',
      suggested_filename: fileMeta.filename,
      explanation: 'Image graphic asset.',
      confidence: 0.85,
    };
  }

  // Audio
  if (['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.opus', '.aiff'].includes(ext)) {
    return {
      category: 'Audio',
      suggested_folder: 'Media/Audio',
      suggested_filename: fileMeta.filename,
      explanation: 'Audio recording or sound track.',
      confidence: 0.9,
    };
  }

  // Video
  if (['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.wmv'].includes(ext)) {
    return {
      category: 'Video',
      suggested_folder: 'Media/Video',
      suggested_filename: fileMeta.filename,
      explanation: 'Video recording or movie file.',
      confidence: 0.9,
    };
  }

  // Archives
  if (['.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar', '.xz'].includes(ext)) {
    return {
      category: 'Archives',
      suggested_folder: 'Archives',
      suggested_filename: fileMeta.filename,
      explanation: 'Compressed file archive.',
      confidence: 0.92,
    };
  }

  // Code
  if (
    [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.json',
      '.py',
      '.rs',
      '.go',
      '.html',
      '.css',
      '.sh',
      '.sql',
      '.yaml',
      '.yml',
    ].includes(ext)
  ) {
    return {
      category: 'Code',
      suggested_folder: isAlreadyInSubfolder ? parts.slice(0, -1).join('/') : 'Developer/Code',
      suggested_filename: fileMeta.filename,
      explanation: 'Source code or developer configuration.',
      confidence: 0.85,
    };
  }

  // Fallback
  return {
    category: 'Other',
    suggested_folder: isAlreadyInSubfolder ? parts.slice(0, -1).join('/') : 'Misc',
    suggested_filename: fileMeta.filename,
    explanation: 'General file type.',
    confidence: 0.7,
  };
}
