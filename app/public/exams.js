const $ = (id) => document.getElementById(id);

let currentActor = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function loadExams() {
  const data = await PYQAuth.fetchJson("/api/exams");
  $("examList").innerHTML = (data.exams || [])
    .map((exam) => `
      <div class="recordCard">
        <strong>${escapeHtml(exam.name)}</strong>
        <span class="recordMeta">${escapeHtml(exam.slug)}${exam.description ? ` · ${escapeHtml(exam.description)}` : ""}</span>
      </div>
    `)
    .join("");
}

async function init() {
  PYQAuth.renderAuthBar({
    required: true,
    adminOnly: true,
    onChange: (actor) => {
      currentActor = actor;
      $("examForm").querySelectorAll("input, button").forEach((control) => {
        control.disabled = actor?.role !== "admin";
      });
    }
  });

  $("examName").addEventListener("input", () => {
    if (!$("examSlug").dataset.touched) $("examSlug").value = slugify($("examName").value);
  });
  $("examSlug").addEventListener("input", () => {
    $("examSlug").dataset.touched = "true";
  });
  $("refreshExams").addEventListener("click", loadExams);
  $("examForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (currentActor?.role !== "admin") return;
    await PYQAuth.fetchJson("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("examName").value,
        slug: $("examSlug").value,
        description: $("examDescription").value
      })
    });
    $("examForm").reset();
    $("examSlug").dataset.touched = "";
    await loadExams();
  });

  await loadExams();
}

init().catch((error) => {
  alert(error.message);
  console.error(error);
});
