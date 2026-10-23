# SlowSort AI

> **"Your files. Your machine. Your time back."**

SlowSort AI is a local-first, privacy-respecting file organization application built to automate and simplify file management without risking your data.

It indexes local folders, uses Google Gemini AI (e.g. `gemini-3.8-flash`) to propose smart categories, sensible destination subfolders, and clean filenames, creates an editable, reviewable plan, and executes only what you explicitly approve — with cryptographic SHA-256 collision prevention and full 1-click reversible undo.

---

## Key Features

1. **Local Filesystem Connection & Boundary Security**
   - Connect any permitted local folder on your computer (e.g. `Downloads`, `Documents`, or custom sandbox).
   - Strict path traversal prevention: all source and destination operations are bounded inside the allowed root directory (`ALLOWED_ROOT`).
   - Interactive local folder browser and one-click sandbox generator.

2. **Real Filesystem Scanning & Metadata Extraction**
   - Collects actual filename, relative path, file extension, and detected MIME type.
   - Computes streaming SHA-256 hashes for all files.
   - Accurately measures exact byte sizes and filesystem timestamps.
   - Safely excludes internal directories (`.git`, `.slowsort`, `node_modules`).

3. **Google Gemini AI Inference**
   - AI organization suggestions powered by modern `@google/genai` TypeScript SDK.
   - Configured securely on the backend only via `GEMINI_API_KEY` and `GEMINI_MODEL`.
   - Maximum privacy: by default, only file metadata (names, sizes, types, paths) is sent to Gemini — private file contents stay on your machine.
   - Responses are validated against a strict typed Zod schema.
   - Built-in deterministic rule engine provides instant sorting fallback if the API key is missing or offline.

4. **Cryptographic Duplicate Detection**
   - Groups exact duplicates using streaming SHA-256 content hashes, not filename guesswork.
   - Computes redundant copy counts and wasted disk space.
   - Non-destructive policy: duplicates are never deleted automatically.

5. **Reviewable Plan & Inline Editing**
   - Every proposed move, rename, or keep operation is presented in a clear review table.
   - Inspect source path, proposed destination, category, confidence score, and rationale.
   - Edit proposed destination paths or filenames inline before approving.
   - Batch selection and individual approve/reject controls.

6. **Collision Prevention & Reversible Undo**
   - Re-verifies source existence and hash integrity before moving.
   - Strict collision prevention: refuses to overwrite existing files at destination.
   - Post-move verification confirms destination hash matches the source.
   - Every executed operation is persisted to a local SQLite database (`.slowsort/slowsort.sqlite`) and can be reversed with a single click.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Motion.
- **Backend:** Node.js, Express, native filesystem APIs, streaming crypto.
- **AI Engine:** Google Gemini API via `@google/genai` (`gemini-3.8-flash`).
- **Storage:** SQLite (`sql.js` WebAssembly with disk persistence to `.slowsort/slowsort.sqlite`).
- **Validation:** Zod 4.
- **Testing:** Vitest for filesystem, security, collision, and Gemini resiliency tests.

---

## Setup & Running Locally

The application backend must run locally on your PC to access your real files. Gemini handles AI inference remotely without reading private file contents.

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env` based on `.env.example`:

```bash
cp .env.example .env
```

Configure your variables in `.env`:
```env
# Google Gemini API Key for intelligent organization suggestions (backend only)
GEMINI_API_KEY=your_gemini_api_key

# Supported Gemini model (default: gemini-3.8-flash)
GEMINI_MODEL=gemini-3.8-flash

# Base directory boundary for filesystem safety enforcement
ALLOWED_ROOT=/path/to/your/files

# Port for local web server (default: 3000)
PORT=3000
```

### 3. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

### 4. Run Test Suite

```bash
npm test
```

---

## Cloud Preview vs. Local PC Execution

- **In Cloud Preview (AI Studio):** The preview runs inside an isolated container. You can click **"Create Test Sandbox"** to generate real documents, photos, and duplicate files on the container disk and test all scanning, Gemini suggestions, duplicate analysis, moves, and undo features.
- **On Your Local PC:** Clone this repository and run `npm run dev` to organize actual directories on your computer.
