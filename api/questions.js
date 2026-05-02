const { getActor, requireRole } = require("./_lib/auth");
const { supabaseFetch, sendJson } = require("./_lib/supabase-rest");
const {
  normalizeQuestion,
  findQuestion,
  questionToSupabaseRow,
  saveAsset,
  saveOptionImage
} = require("./_lib/questions");

async function readQuestions(includeDrafts) {
  const statusFilter = includeDrafts ? "" : "&status=eq.published-ready";
  const rows = await supabaseFetch(
    `/rest/v1/questions?select=payload&order=year.desc,paper.asc,question_number.asc${statusFilter}`,
    { headers: { Accept: "application/json" } }
  );
  return rows.map((row) => row.payload).filter(Boolean);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const actor = await getActor(req);
      const includeDrafts = actor && ["admin", "editor"].includes(actor.role);
      const questions = await readQuestions(includeDrafts);
      return sendJson(res, 200, {
        schemaVersion: 1,
        backend: "supabase",
        updatedAt: new Date().toISOString(),
        questions
      });
    }

    if (req.method === "POST") {
      const actor = await requireRole(req, ["admin", "editor"]);
      const input = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const existing = await findQuestion(input.id);
      const question = normalizeQuestion(input, existing);
      question.figures = await Promise.all((input.figures || []).map((figure, index) => saveAsset(question.id, figure, index)));
      question.options = await Promise.all(question.options.map((option, index) => saveOptionImage(question.id, option, index)));

      await supabaseFetch("/rest/v1/questions?on_conflict=id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify(questionToSupabaseRow(question, actor))
      });
      return sendJson(res, 200, { question });
    }

    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "40mb"
    }
  }
};
