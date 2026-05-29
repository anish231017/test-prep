# Test Prep Extractor - Codebase Architecture

This document serves as a comprehensive overview of the `Test_prep` repository to help LLMs and developers quickly understand the project structure, stack, and core logic without needing to scan multiple files.

## High-Level Overview

**Test Prep Extractor** is a full-stack web application designed for parsing, structuring, and practicing exam questions (specifically Indian competitive exams like JEE Advanced). 
It features two primary frontend interfaces:
1. **Data Extractor (`/`)**: An admin dashboard used to manually extract questions from source PDFs, insert figure markers, upload images, write LaTeX, and save records.
2. **Practice App (`/practice`)**: A student-facing interface that renders the extracted questions with MathJax (LaTeX), interactive multiple-choice/integer inputs, and reveals answers/solutions dynamically.

The backend supports a dual-mode storage system:
- **Local JSON Mode**: Stores data in `data/questions.json` and images in `data/assets/`.
- **Supabase Mode**: Uses PostgreSQL for structured data and Supabase Storage for assets.

## Directory Structure

```text
Test_prep/
├── api/                # Vercel Serverless Functions (Production Backend)
│   ├── _lib/           # Shared backend logic (Auth, Supabase helpers, Question processing)
│   ├── export/         # API routes for exporting data (NDJSON/JSON)
│   ├── questions/      # API routes for individual question operations (GET, PUT, DELETE)
│   └── *.js            # API routes (e.g., questions.js, papers.js, exams.js)
├── app/                # Local Development Server & Frontend Client
│   ├── public/         # Frontend assets (HTML, JS, CSS)
│   └── server.js       # Local Node.js Express-like server
├── data/               # Local Storage Directory (used if Supabase is disabled)
│   ├── assets/         # Locally uploaded images
│   ├── questions.json  # Database dump
│   └── questions.ndjson
├── Jee Advance/        # Source PDFs of exam papers organized by year
├── scripts/            # Utility scripts (e.g., migrating local JSON to Supabase)
├── supabase/           # Supabase local config & migrations
├── .env                # Environment variables (Supabase keys, PORT)
├── vercel.json         # Vercel deployment configuration
└── package.json        # Node dependencies and scripts (`npm run dev`)
```

## Key Files & Responsibilities

### 1. Frontend (`app/public/`)
Vanilla JavaScript, HTML, and CSS. No heavy frameworks like React.

*   **`index.html` & `app.js` (Data Extractor)**: 
    *   Admin UI.
    *   Reads PDFs from the `Jee Advance/` folder (via local dev API) into an iframe.
    *   Form handles rich metadata (Subject, Topic, Difficulty, Marks).
    *   Supports inserting Markdown-like figure markers (e.g., `[[fig:ray-diagram]]`) into the `questionText` and `solutionText`.
    *   Uploads local images and converts them to data URLs before sending to the API.
*   **`practice.html` & `practice.js` (Practice Platform)**:
    *   Student UI.
    *   Fetches the JSON database and renders a filterable list of questions.
    *   Uses **MathJax** to render `$inline$` and `$$display$$` LaTeX math.
    *   Parses the `[[fig:marker]]` strings and replaces them with actual `<img>` blocks referenced from the `figures` or `solutionFigures` arrays.
    *   Handles interactive answer submission and solution revealing.
*   **`auth.js`**: 
    *   Injects a Supabase authentication UI bar at the top of the app. Secures the admin extractor.

### 2. Backend Server & API
The app uses `app/server.js` for local development and the `api/` directory for Vercel serverless production.

*   **`app/server.js`**:
    *   A custom `http` Node.js server (no Express).
    *   Serves static files from `app/public/`.
    *   Routes `/api/*` to handle local operations.
    *   Implements `normalizeQuestion()` which sanitizes frontend payloads, processes image data URLs, uploads them to Supabase Storage (if configured) or local disk, and generates unique IDs.
*   **`api/_lib/questions.js` & `api/_lib/supabase-rest.js`**:
    *   The Vercel equivalent of `server.js`'s database logic. Uses Supabase's REST API directly using `fetch` with the `SUPABASE_SERVICE_ROLE_KEY`.

## Core Data Model (`Question`)

The JSON schema for a question record:

```json
{
  "id": "jee-advanced-2023-paper-1-q1",
  "exam": "JEE Advanced",
  "year": 2023,
  "paper": "Paper 1",
  "questionNumber": "1",
  "subject": "Physics",
  "topic": "Mechanics",
  "subtopic": "Kinematics",
  "difficulty": "Medium",
  "type": "Single Correct",
  "marks": { "correct": 3, "negative": -1, "partial": 0 },
  "tags": ["pyq", "concept-heavy"],
  "questionText": "A particle moves such that... [[fig:graph-1]]",
  "options": [
    { "label": "A", "text": "$v = u + at$", "isCorrect": true, "image": null }
  ],
  "figures": [
    { "marker": "graph-1", "url": "https://...", "placement": "inline" }
  ],
  "solutionFigures": [
    { "marker": "sol-graph-1", "url": "https://...", "placement": "below" }
  ],
  "answer": {
    "value": "A",
    "explanation": "Derived from Newton's laws."
  },
  "solutionText": "Full step-by-step solution here. [[fig:sol-graph-1]]",
  "status": "published-ready" // draft, reviewed, published-ready, deleted
}
```

## Important Workflows

*   **Adding Figures**: The UI adds `figures` (for questions) and `solutionFigures` (for solutions). Images are intercepted in the frontend as Data URLs, pushed via POST to `/api/questions`. The backend extracts the Base64, generates a safe filename, uploads it to Supabase Storage, and replaces the `dataUrl` with the public `url` before saving the JSON row.
*   **Soft Deletion**: Records are deleted by setting their `"status": "deleted"` instead of hard deleting the row from the database (handled in `app.js` and `practice.js` filtering).
*   **Rendering Math**: `practice.js` uses `typesetMath()` to parse LaTeX asynchronously via MathJax. It also includes a custom `applyLatexFallback()` that translates symbols via basic HTML spans if MathJax fails to load.

## Environment Variables
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Admin API key for bypassing Row Level Security.
- `SUPABASE_STORAGE_BUCKET`: Defaults to `question-assets`.
- `PORT`: Local dev server port (default `5173`).
