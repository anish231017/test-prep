const http = require("http");
const fs = require("fs/promises");
const fss = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(__dirname, "public");
const MATHJAX_DIR = path.join(ROOT, "node_modules", "mathjax");
const PAPERS_DIR = path.join(ROOT, "Jee Advance");
const DATA_DIR = path.join(ROOT, "data");
const ASSET_DIR = path.join(DATA_DIR, "assets");
const DB_FILE = path.join(DATA_DIR, "questions.json");
const EXPORT_FILE = path.join(DATA_DIR, "questions.ndjson");
const PORT = Number(process.env.PORT || 5173);

loadEnvFile();

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const SUPABASE_STORAGE_BUCKET = cleanEnv(process.env.SUPABASE_STORAGE_BUCKET) || "question-assets";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

async function ensureStore() {
  await fs.mkdir(ASSET_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    const initial = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      questions: []
    };
    await fs.writeFile(DB_FILE, JSON.stringify(initial, null, 2));
    await fs.writeFile(EXPORT_FILE, "");
  }
}

async function readStore() {
  await ensureStore();
  if (USE_SUPABASE) {
    return readSupabaseStore();
  }
  return JSON.parse(await fs.readFile(DB_FILE, "utf8"));
}

async function writeStore(store) {
  store.updatedAt = new Date().toISOString();
  store.questions.sort((a, b) => {
    return `${a.exam}|${a.year}|${a.paper}|${a.questionNumber || ""}`.localeCompare(
      `${b.exam}|${b.year}|${b.paper}|${b.questionNumber || ""}`,
      undefined,
      { numeric: true }
    );
  });
  await fs.writeFile(DB_FILE, JSON.stringify(store, null, 2));
  await fs.writeFile(EXPORT_FILE, store.questions.map((q) => JSON.stringify(q)).join("\n"));
}

function cleanEnv(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fss.existsSync(envPath)) return;
  const lines = fss.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = cleanEnv(trimmed.slice(index + 1));
    if (!process.env[key]) process.env[key] = value;
  }
}

async function supabaseFetch(route, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${route}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Supabase request failed: ${response.status}`);
  }
  return data;
}

async function readSupabaseStore() {
  const rows = await supabaseFetch(
    "/rest/v1/questions?select=payload&order=year.desc,paper.asc,question_number.asc",
    { headers: { Accept: "application/json" } }
  );
  return {
    schemaVersion: 1,
    backend: "supabase",
    updatedAt: new Date().toISOString(),
    questions: rows.map((row) => row.payload).filter(Boolean)
  };
}

async function findQuestion(id) {
  if (!id) return null;
  if (USE_SUPABASE) {
    const rows = await supabaseFetch(`/rest/v1/questions?id=eq.${encodeURIComponent(id)}&select=payload&limit=1`);
    return rows[0]?.payload || null;
  }
  const store = await readStore();
  return store.questions.find((question) => question.id === id) || null;
}

async function saveQuestion(question) {
  if (USE_SUPABASE) {
    const row = questionToSupabaseRow(question);
    await supabaseFetch("/rest/v1/questions?on_conflict=id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(row)
    });
    return;
  }

  const store = await readStore();
  const duplicate = store.questions.findIndex((item) => item.id === question.id);
  if (duplicate >= 0) {
    store.questions[duplicate] = question;
  } else {
    store.questions.push(question);
  }
  await writeStore(store);
}

async function deleteQuestion(id) {
  if (USE_SUPABASE) {
    const deleted = await supabaseFetch(`/rest/v1/questions?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" }
    });
    return deleted.length > 0;
  }

  const store = await readStore();
  const before = store.questions.length;
  store.questions = store.questions.filter((question) => question.id !== id);
  await writeStore(store);
  return before !== store.questions.length;
}

function questionToSupabaseRow(question) {
  return {
    id: question.id,
    exam: question.exam,
    source_exam: question.sourceExam,
    year: question.year,
    paper: question.paper,
    paper_file: question.paperFile,
    question_number: question.questionNumber,
    subject: question.subject,
    topic: question.topic,
    subtopic: question.subtopic,
    difficulty: question.difficulty,
    question_type: question.type,
    status: question.status,
    language: question.language,
    tags: question.tags || [],
    payload: question,
    created_at: question.createdAt,
    updated_at: question.updatedAt
  };
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 40 * 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function cleanText(value) {
  return String(value || "").trim();
}

function toSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function safePaperPath(year, file) {
  const yearPart = String(year || "");
  const filePart = String(file || "");
  if (!/^\d{4}$/.test(yearPart) || filePart.includes("..") || /[\\/]/.test(filePart)) {
    return null;
  }
  const resolved = path.join(PAPERS_DIR, yearPart, filePart);
  return resolved.startsWith(PAPERS_DIR) ? resolved : null;
}

async function listPapers() {
  const years = await fs.readdir(PAPERS_DIR, { withFileTypes: true });
  const result = [];
  for (const year of years.filter((entry) => entry.isDirectory())) {
    const files = await fs.readdir(path.join(PAPERS_DIR, year.name), { withFileTypes: true });
    for (const file of files.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))) {
      result.push({
        exam: "JEE Advanced",
        year: Number(year.name),
        paper: file.name.replace(/\.pdf$/i, ""),
        fileName: file.name,
        url: `/papers/${year.name}/${encodeURIComponent(file.name)}`
      });
    }
  }
  return result.sort((a, b) => b.year - a.year || a.paper.localeCompare(b.paper, undefined, { numeric: true }));
}

function normalizeQuestion(input, existing = {}) {
  existing = existing || {};
  const now = new Date().toISOString();
  const exam = cleanText(input.exam) || "JEE Advanced";
  const year = Number(input.year);
  const paper = cleanText(input.paper);
  const subject = cleanText(input.subject);
  const topic = cleanText(input.topic);
  const questionNumber = cleanText(input.questionNumber);
  const id =
    existing.id ||
    input.id ||
    [
      toSlug(exam),
      year || "year",
      toSlug(paper) || "paper",
      questionNumber ? `q${toSlug(questionNumber)}` : crypto.randomUUID().slice(0, 8)
    ].join("-");

  return {
    id,
    exam,
    sourceExam: cleanText(input.sourceExam) || "JEE Advanced",
    year,
    paper,
    paperFile: cleanText(input.paperFile),
    questionNumber,
    subject,
    topic,
    subtopic: cleanText(input.subtopic),
    difficulty: cleanText(input.difficulty),
    type: cleanText(input.type),
    marks: {
      correct: Number(input.marks?.correct || 0),
      negative: Number(input.marks?.negative || 0),
      partial: Number(input.marks?.partial || 0)
    },
    language: cleanText(input.language) || "English",
    tags: Array.isArray(input.tags) ? input.tags.map(cleanText).filter(Boolean) : [],
    questionText: cleanText(input.questionText),
    options: Array.isArray(input.options)
      ? input.options
          .map((option) => ({
            label: cleanText(option.label),
            text: cleanText(option.text),
            isCorrect: Boolean(option.isCorrect),
            image: option.image || null
          }))
          .filter((option) => option.label || option.text || option.image)
      : [],
    figures: Array.isArray(input.figures) ? input.figures : [],
    answer: {
      value: cleanText(input.answer?.value),
      explanation: cleanText(input.answer?.explanation)
    },
    solutionText: cleanText(input.solutionText),
    source: {
      page: cleanText(input.source?.page),
      pdfUrl: cleanText(input.source?.pdfUrl)
    },
    status: cleanText(input.status) || "draft",
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

async function saveAsset(questionId, figure, index) {
  const normalized = {
    id: figure?.id || crypto.randomUUID(),
    url: cleanText(figure?.url),
    alt: cleanText(figure?.alt),
    caption: cleanText(figure?.caption),
    marker: toSlug(figure?.marker) || `fig-${index + 1}`,
    placement: figure?.placement === "inline" ? "inline" : "below",
    positionAfterParagraph: Number(figure?.positionAfterParagraph || 0),
    originalName: cleanText(figure?.originalName)
  };

  if (!figure || !figure.dataUrl || figure.url) {
    return normalized;
  }
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/i.exec(figure.dataUrl);
  if (!match) {
    throw new Error(`Figure ${index + 1} is not a supported image.`);
  }
  const ext = match[1].includes("png")
    ? "png"
    : match[1].includes("webp")
      ? "webp"
      : match[1].includes("svg")
        ? "svg"
        : "jpg";
  const safeName = `${questionId}-fig-${index + 1}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  if (USE_SUPABASE) {
    const assetPath = `${questionId}/${safeName}`;
    const bytes = Buffer.from(match[2], "base64");
    await supabaseFetch(`/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${encodeURI(assetPath)}`, {
      method: "POST",
      headers: {
        "Content-Type": match[1],
        "x-upsert": "true"
      },
      body: bytes
    });
    return {
      ...normalized,
      url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${assetPath}`,
      originalName: cleanText(figure.originalName)
    };
  }

  const filePath = path.join(ASSET_DIR, safeName);
  await fs.writeFile(filePath, Buffer.from(match[2], "base64"));
  return {
    ...normalized,
    url: `/assets/${safeName}`,
    originalName: cleanText(figure.originalName)
  };
}

async function saveOptionImage(questionId, option, index) {
  if (!option?.image) return option;
  const saved = await saveAsset(`${questionId}-option-${toSlug(option.label) || index + 1}`, option.image, index);
  return {
    ...option,
    image: saved
  };
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/papers" && req.method === "GET") {
    return send(res, 200, { papers: await listPapers() });
  }

  if (url.pathname === "/api/questions" && req.method === "GET") {
    const store = await readStore();
    return send(res, 200, store);
  }

  if (url.pathname === "/api/questions" && req.method === "POST") {
    const raw = await parseBody(req);
    const input = JSON.parse(raw || "{}");
    const existing = await findQuestion(input.id);
    let question = normalizeQuestion(input, existing);
    question.figures = await Promise.all((input.figures || []).map((figure, index) => saveAsset(question.id, figure, index)));
    question.options = await Promise.all(question.options.map((option, index) => saveOptionImage(question.id, option, index)));
    await saveQuestion(question);
    return send(res, 200, { question });
  }

  if (url.pathname.startsWith("/api/questions/") && req.method === "DELETE") {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const deleted = await deleteQuestion(id);
    return send(res, deleted ? 200 : 404, { deleted });
  }

  if (url.pathname === "/api/backend" && req.method === "GET") {
    return send(res, 200, {
      backend: USE_SUPABASE ? "supabase" : "local-json",
      storage: USE_SUPABASE ? "supabase-storage" : "local-assets",
      bucket: USE_SUPABASE ? SUPABASE_STORAGE_BUCKET : null
    });
  }

  return send(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res, url) {
  if (url.pathname === "/export/questions.ndjson") {
    const store = await readStore();
    return send(res, 200, store.questions.map((question) => JSON.stringify(question)).join("\n"), "application/x-ndjson; charset=utf-8");
  }

  if (url.pathname.startsWith("/vendor/mathjax/")) {
    const relative = decodeURIComponent(url.pathname.replace("/vendor/mathjax/", ""));
    if (relative.includes("..") || path.isAbsolute(relative)) {
      return send(res, 400, "Bad vendor path.", "text/plain; charset=utf-8");
    }
    const filePath = path.join(MATHJAX_DIR, relative);
    if (!filePath.startsWith(MATHJAX_DIR)) return send(res, 403, "Forbidden.", "text/plain; charset=utf-8");
    return streamFile(res, filePath);
  }

  if (url.pathname.startsWith("/papers/")) {
    const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
    const filePath = safePaperPath(parts[1], parts.slice(2).join("/"));
    if (!filePath) return send(res, 400, "Bad paper path.", "text/plain; charset=utf-8");
    return streamFile(res, filePath);
  }

  if (url.pathname.startsWith("/assets/")) {
    const fileName = decodeURIComponent(url.pathname.replace("/assets/", ""));
    if (fileName.includes("..") || /[\\/]/.test(fileName)) {
      return send(res, 400, "Bad asset path.", "text/plain; charset=utf-8");
    }
    return streamFile(res, path.join(ASSET_DIR, fileName));
  }

  const requested = url.pathname === "/" ? "/index.html" : url.pathname === "/practice" ? "/practice.html" : url.pathname;
  const filePath = path.join(PUBLIC_DIR, decodeURIComponent(requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden.", "text/plain; charset=utf-8");
  return streamFile(res, filePath);
}

function streamFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!fss.existsSync(filePath)) {
    return send(res, 404, "Not found.", "text/plain; charset=utf-8");
  }
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fss.createReadStream(filePath).pipe(res);
}

async function main() {
  await ensureStore();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
      } else {
        await serveStatic(req, res, url);
      }
    } catch (error) {
      send(res, 500, { error: error.message });
    }
  });

  server.listen(PORT, () => {
    console.log(`Data extraction app running at http://localhost:${PORT}`);
    console.log(`Backend: ${USE_SUPABASE ? "Supabase" : "local JSON"}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
