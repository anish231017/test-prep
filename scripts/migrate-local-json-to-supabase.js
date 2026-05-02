const fs = require("fs/promises");
const fss = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DB_FILE = path.join(ROOT, "data", "questions.json");
const ASSET_DIR = path.join(ROOT, "data", "assets");

loadEnvFile();

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const SUPABASE_STORAGE_BUCKET = cleanEnv(process.env.SUPABASE_STORAGE_BUCKET) || "question-assets";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.");
  process.exit(1);
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

async function uploadLocalAsset(questionId, asset) {
  if (!asset?.url?.startsWith("/assets/")) return asset;
  const fileName = decodeURIComponent(asset.url.replace("/assets/", ""));
  const localPath = path.join(ASSET_DIR, fileName);
  if (!localPath.startsWith(ASSET_DIR) || !fss.existsSync(localPath)) return asset;

  const ext = path.extname(fileName).toLowerCase();
  const contentType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".svg"
          ? "image/svg+xml"
          : "image/jpeg";
  const remotePath = `${questionId}/${fileName}`;
  const bytes = await fs.readFile(localPath);
  await supabaseFetch(`/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${encodeURI(remotePath)}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: bytes
  });

  return {
    ...asset,
    url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${remotePath}`
  };
}

async function migrateQuestion(question) {
  const migrated = structuredClone(question);
  migrated.figures = await Promise.all((migrated.figures || []).map((asset) => uploadLocalAsset(migrated.id, asset)));
  migrated.options = await Promise.all(
    (migrated.options || []).map(async (option) => ({
      ...option,
      image: option.image ? await uploadLocalAsset(migrated.id, option.image) : null
    }))
  );

  await supabaseFetch("/rest/v1/questions?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(questionToSupabaseRow(migrated))
  });
  return migrated.id;
}

async function main() {
  const store = JSON.parse(await fs.readFile(DB_FILE, "utf8"));
  const questions = store.questions || [];
  console.log(`Migrating ${questions.length} questions to Supabase...`);
  for (const question of questions) {
    const id = await migrateQuestion(question);
    console.log(`Migrated ${id}`);
  }
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
