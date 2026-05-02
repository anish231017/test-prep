const crypto = require("crypto");
const { getSupabaseEnv } = require("./env");
const { supabaseFetch } = require("./supabase-rest");

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

function normalizeQuestion(input, existing = {}) {
  existing = existing || {};
  const now = new Date().toISOString();
  const exam = cleanText(input.exam) || "JEE Advanced";
  const year = Number(input.year);
  const paper = cleanText(input.paper);
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
    examId: cleanText(input.examId),
    sourceExam: cleanText(input.sourceExam) || exam,
    year,
    paper,
    paperFile: cleanText(input.paperFile),
    questionNumber,
    subject: cleanText(input.subject),
    topic: cleanText(input.topic),
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

async function findQuestion(id) {
  if (!id) return null;
  const rows = await supabaseFetch(`/rest/v1/questions?id=eq.${encodeURIComponent(id)}&select=payload&limit=1`);
  return rows[0]?.payload || null;
}

function questionToSupabaseRow(question, actor) {
  return {
    id: question.id,
    exam_id: question.examId || null,
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
    updated_at: question.updatedAt,
    updated_by: actor?.id || null
  };
}

async function saveAsset(questionId, figure, index) {
  const normalized = {
    id: figure?.id || crypto.randomUUID(),
    url: cleanText(figure?.url),
    alt: cleanText(figure?.alt),
    caption: cleanText(figure?.caption),
    marker: toSlug(figure?.marker) || `fig-${index + 1}`,
    placement: figure?.placement === "inline" ? "inline" : figure?.placement === "option" ? "option" : "below",
    positionAfterParagraph: Number(figure?.positionAfterParagraph || 0),
    originalName: cleanText(figure?.originalName)
  };

  if (!figure || !figure.dataUrl || figure.url) return normalized;

  const match = /^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/i.exec(figure.dataUrl);
  if (!match) throw new Error(`Figure ${index + 1} is not a supported image.`);

  const env = getSupabaseEnv();
  const ext = match[1].includes("png")
    ? "png"
    : match[1].includes("webp")
      ? "webp"
      : match[1].includes("svg")
        ? "svg"
        : "jpg";
  const safeName = `${questionId}-fig-${index + 1}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const assetPath = `${questionId}/${safeName}`;
  const bytes = Buffer.from(match[2], "base64");

  await supabaseFetch(`/storage/v1/object/${env.bucket}/${encodeURI(assetPath)}`, {
    method: "POST",
    headers: {
      "Content-Type": match[1],
      "x-upsert": "true"
    },
    body: bytes
  });

  return {
    ...normalized,
    url: `${env.url}/storage/v1/object/public/${env.bucket}/${assetPath}`,
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

module.exports = {
  normalizeQuestion,
  findQuestion,
  questionToSupabaseRow,
  saveAsset,
  saveOptionImage,
  toSlug,
  cleanText
};
