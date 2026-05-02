const $ = (id) => document.getElementById(id);

let papers = [];
let questions = [];
let exams = [];
let currentActor = null;

const fields = [
  "recordId",
  "exam",
  "year",
  "paper",
  "questionNumber",
  "subject",
  "topic",
  "subtopic",
  "difficulty",
  "type",
  "marksCorrect",
  "marksNegative",
  "marksPartial",
  "questionText",
  "answerValue",
  "tags",
  "answerExplanation",
  "solutionText",
  "sourcePage",
  "status",
  "language"
];

async function fetchJson(url, options) {
  const response = await PYQAuth.authFetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function selectedPaper() {
  const val = $("paperSelect").value;
  return papers.find((paper) => paper.url === val || `${paper.year}|${paper.fileName}` === val);
}

function setPaper(paper) {
  if (!paper) return;
  $("dropZone").style.display = "none";
  if (!$("examSelect").value && exams.length) {
    const match = exams.find((exam) => exam.name === paper.exam);
    if (match) $("examSelect").value = match.id;
  }
  syncExamInput();
  $("year").value = paper.year;
  $("paper").value = paper.paper;
  $("paperFrame").src = paper.url;
}

function selectedExam() {
  return exams.find((exam) => exam.id === $("examSelect").value);
}

function syncExamInput() {
  const exam = selectedExam();
  $("exam").value = exam?.name || "";
}

function addOption(option = {}) {
  const node = $("optionTemplate").content.firstElementChild.cloneNode(true);
  const preview = node.querySelector(".optionImagePreview");
  const fileInput = node.querySelector(".optionImageFile");

  node.dataset.imageUrl = option.image?.url || "";
  node.dataset.imageDataUrl = option.image?.dataUrl || "";
  node.dataset.imageOriginalName = option.image?.originalName || "";
  node.querySelector(".optionLabel").value = option.label || nextOptionLabel();
  node.querySelector(".optionText").value = option.text || "";
  node.querySelector(".optionCorrect").checked = Boolean(option.isCorrect);
  renderOptionImagePreview(preview, option.image?.url || option.image?.dataUrl);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    node.dataset.imageDataUrl = await fileToDataUrl(file);
    node.dataset.imageUrl = "";
    node.dataset.imageOriginalName = file.name;
    renderOptionImagePreview(preview, node.dataset.imageDataUrl);
  });

  node.querySelector(".remove").addEventListener("click", () => node.remove());
  $("options").appendChild(node);
}

function nextOptionLabel() {
  return String.fromCharCode(65 + document.querySelectorAll(".optionRow").length);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function addFigure(figure = {}) {
  const node = $("figureTemplate").content.firstElementChild.cloneNode(true);
  const preview = node.querySelector(".figurePreview");
  const fileInput = node.querySelector(".figureFile");
  const markerInput = node.querySelector(".figureMarker");

  node.dataset.figureId = figure.id || crypto.randomUUID();
  node.dataset.url = figure.url || "";
  node.dataset.dataUrl = figure.dataUrl || "";
  node.dataset.originalName = figure.originalName || "";
  node.querySelector(".figurePlacement").value = figure.placement || "below";
  markerInput.value = figure.marker || `fig-${document.querySelectorAll(".figureRow").length + 1}`;
  node.querySelector(".figurePosition").value = figure.positionAfterParagraph || 0;
  node.querySelector(".figureAlt").value = figure.alt || "";
  node.querySelector(".figureCaption").value = figure.caption || "";

  renderFigurePreview(preview, figure.url || figure.dataUrl);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    node.dataset.dataUrl = await fileToDataUrl(file);
    node.dataset.url = "";
    node.dataset.originalName = file.name;
    renderFigurePreview(preview, node.dataset.dataUrl);
  });

  node.querySelector(".insertMarker").addEventListener("click", () => {
    const marker = slugify(markerInput.value) || "fig-1";
    markerInput.value = marker;
    node.querySelector(".figurePlacement").value = "inline";
    insertAtCursor($("questionText"), `[[fig:${marker}]]`);
  });
  node.querySelector(".remove").addEventListener("click", () => node.remove());
  $("figures").appendChild(node);
}

function renderFigurePreview(container, source) {
  container.innerHTML = "";
  if (!source) {
    container.textContent = "No figure";
    return;
  }
  const image = document.createElement("img");
  image.src = source;
  image.alt = "";
  container.appendChild(image);
}



function renderOptionImagePreview(container, source) {
  container.innerHTML = "";
  if (!source) {
    container.textContent = "No image";
    return;
  }
  const image = document.createElement("img");
  image.src = source;
  image.alt = "";
  container.appendChild(image);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function insertAtCursor(input, text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
  input.focus();
  input.selectionStart = input.selectionEnd = start + text.length;
}

function readForm() {
  const paper = selectedPaper();
  const exam = selectedExam();
  return {
    id: $("recordId").value || undefined,
    examId: exam?.id || "",
    exam: exam?.name || $("exam").value,
    sourceExam: exam?.name || $("exam").value,
    year: $("year").value,
    paper: $("paper").value,
    paperFile: paper?.fileName || "",
    questionNumber: $("questionNumber").value,
    subject: $("subject").value,
    topic: $("topic").value,
    subtopic: $("subtopic").value,
    difficulty: $("difficulty").value,
    type: $("type").value,
    marks: {
      correct: $("marksCorrect").value,
      negative: $("marksNegative").value,
      partial: $("marksPartial").value
    },
    language: $("language").value,
    tags: $("tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    questionText: $("questionText").value,
    options: [...document.querySelectorAll(".optionRow")].map((row) => ({
      label: row.querySelector(".optionLabel").value,
      text: row.querySelector(".optionText").value,
      isCorrect: row.querySelector(".optionCorrect").checked,
      image: row.dataset.imageUrl || row.dataset.imageDataUrl ? {
        url: row.dataset.imageUrl,
        dataUrl: row.dataset.imageDataUrl,
        originalName: row.dataset.imageOriginalName,
        marker: `option-${row.querySelector(".optionLabel").value || "image"}`,
        placement: "option",
        alt: `Option ${row.querySelector(".optionLabel").value || ""} image`,
        caption: ""
      } : null
    })),
    figures: [...document.querySelectorAll(".figureRow")].map((row) => ({
      id: row.dataset.figureId,
      url: row.dataset.url,
      dataUrl: row.dataset.dataUrl,
      originalName: row.dataset.originalName,
      placement: row.querySelector(".figurePlacement").value,
      marker: slugify(row.querySelector(".figureMarker").value),
      positionAfterParagraph: row.querySelector(".figurePosition").value,
      alt: row.querySelector(".figureAlt").value,
      caption: row.querySelector(".figureCaption").value
    })),
    answer: {
      value: $("answerValue").value,
      explanation: $("answerExplanation").value
    },
    solutionText: $("solutionText").value,
    source: {
      page: $("sourcePage").value,
      pdfUrl: paper?.url || ""
    },
    status: $("status").value
  };
}

function writeForm(question) {
  $("recordId").value = question.id || "";
  $("exam").value = question.exam || "JEE Advanced";
  const exam = exams.find((item) => item.id === question.examId || item.name === question.exam);
  $("examSelect").value = exam?.id || "";
  $("year").value = question.year || "";
  $("paper").value = question.paper || "";
  $("questionNumber").value = question.questionNumber || "";
  $("subject").value = question.subject || "";
  $("topic").value = question.topic || "";
  $("subtopic").value = question.subtopic || "";
  $("difficulty").value = question.difficulty || "";
  $("type").value = question.type || "";
  $("marksCorrect").value = question.marks?.correct ?? "";
  $("marksNegative").value = question.marks?.negative ?? "";
  $("marksPartial").value = question.marks?.partial ?? "";
  $("questionText").value = question.questionText || "";
  $("answerValue").value = question.answer?.value || "";
  $("tags").value = (question.tags || []).join(", ");
  $("answerExplanation").value = question.answer?.explanation || "";
  $("solutionText").value = question.solutionText || "";
  $("sourcePage").value = question.source?.page || "";
  $("status").value = question.status || "draft";
  $("language").value = question.language || "English";

  $("options").innerHTML = "";
  (question.options || []).forEach(addOption);
  if (!question.options?.length) ["A", "B", "C", "D"].forEach((label) => addOption({ label }));

  $("figures").innerHTML = "";
  (question.figures || []).forEach(addFigure);
}

function resetForm() {
  const current = selectedPaper();
  fields.forEach((field) => {
    if ($(field)) $(field).value = "";
  });
  const jeeAdvanced = exams.find((exam) => exam.name === "JEE Advanced");
  $("examSelect").value = jeeAdvanced?.id || exams[0]?.id || "";
  syncExamInput();
  $("language").value = "English";
  $("status").value = "draft";
  $("options").innerHTML = "";
  $("figures").innerHTML = "";
  ["A", "B", "C", "D"].forEach((label) => addOption({ label }));
  if (current) setPaper(current);
}

function renderRecords() {
  const query = $("search").value.trim().toLowerCase();
  const statusFilter = $("statusFilter").value;
  const list = $("recordList");
  list.innerHTML = "";
  $("questionCount").textContent = `${questions.length} question${questions.length === 1 ? "" : "s"}`;

  questions
    .filter((q) => {
      const matchesSearch = !query || JSON.stringify(q).toLowerCase().includes(query);
      const matchesStatus = !statusFilter || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .slice()
    .reverse()
    .forEach((question) => {
      const card = document.createElement("div");
      card.className = "recordCard";
      card.innerHTML = `
        <strong>${question.year || ""} ${question.paper || ""} Q${question.questionNumber || ""}</strong>
        <span class="recordMeta">${question.subject || "No subject"} · ${question.topic || "No topic"} · ${question.status}</span>
        <span>${escapeHtml(question.questionText || "").slice(0, 120)}</span>
        <div class="recordActions">
          <button type="button" data-action="edit">Edit</button>
          <button type="button" data-action="delete" class="danger">Delete</button>
        </div>
      `;
      card.querySelector('[data-action="edit"]').addEventListener("click", () => writeForm(question));
      card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        if (!confirm("Delete this question record?")) return;
        await fetchJson(`/api/questions/${encodeURIComponent(question.id)}`, { method: "DELETE" });
        await loadQuestions();
        showToast("Question deleted.");
      });
      list.appendChild(card);
    });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function loadPapers() {
  const data = await fetchJson("/api/papers");
  papers = data.papers;
  $("paperSelect").innerHTML = papers
    .map((paper) => `<option value="${paper.year}|${paper.fileName}">${paper.year} · ${paper.paper}</option>`)
    .join("");
  setPaper(papers[0]);
}

async function loadExams() {
  const data = await fetchJson("/api/exams");
  exams = data.exams || [];
  $("examSelect").innerHTML = exams
    .map((exam) => `<option value="${exam.id}">${escapeHtml(exam.name)}</option>`)
    .join("");
  syncExamInput();
}

async function loadQuestions() {
  const data = await fetchJson("/api/questions");
  questions = data.questions || [];
  renderRecords();
}

async function init() {
  PYQAuth.renderAuthBar({
    required: true,
    onChange: async (actor) => {
      currentActor = actor;
      $("questionForm").querySelectorAll("input, select, textarea, button").forEach((control) => {
        control.disabled = !actor;
      });
      if (actor) await loadQuestions();
    }
  });
  $("paperSelect").addEventListener("change", () => setPaper(selectedPaper()));
  $("examSelect").addEventListener("change", syncExamInput);
  $("addOption").addEventListener("click", () => addOption());
  $("addFigure").addEventListener("click", () => addFigure());
  $("newButton").addEventListener("click", resetForm);
  $("search").addEventListener("input", renderRecords);
  $("statusFilter").addEventListener("change", renderRecords);

  initResizable();
  initSidebarToggle();

  // PDF Drag & Drop
  const dropZone = $("dropZone");
  const fileInput = $("paperFileInput");
  const folderInput = $("paperFolderInput");
  const uploadBtn = $("uploadPaperBtn");
  const folderBtn = $("uploadFolderBtn");

  uploadBtn.addEventListener("click", () => fileInput.click());
  folderBtn.addEventListener("click", () => folderInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) handleLocalPdfs([file]);
  });

  folderInput.addEventListener("change", () => {
    const files = Array.from(folderInput.files).filter((f) => f.type === "application/pdf");
    if (files.length) handleLocalPdfs(files);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  ["dragleave", "dragend"].forEach((type) => {
    dropZone.addEventListener(type, () => dropZone.classList.remove("dragover"));
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      handleLocalPdfs([file]);
    }
  });

  function handleLocalPdfs(files) {
    if (!files.length) return;
    
    // Clear the "No folder selected" option if it's the first time
    if ($("paperSelect").options[0]?.value === "") {
      $("paperSelect").innerHTML = "";
    }

    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const option = document.createElement("option");
      option.value = url;
      // Show relative path if available to support subfolders
      const displayPath = file.webkitRelativePath || file.name;
      option.textContent = `📄 ${displayPath}`;
      $("paperSelect").appendChild(option);
      
      // Store info in papers array
      papers.push({
        fileName: file.name,
        year: file.name.match(/\d{4}/)?.[0] || "",
        paper: file.name.replace(/\.pdf$/i, ""),
        url: url
      });
    });

    // Select the first one and load it
    $("paperSelect").selectedIndex = 0;
    setPaper(selectedPaper());
  }

  $("questionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const saved = await fetchJson("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readForm())
    });
    $("recordId").value = saved.question.id;
    await loadQuestions();
    showToast("Question saved successfully!");
  });

  await loadExams();
  // await loadPapers(); // Disabled by user request
  resetForm();
  if (currentActor) await loadQuestions();
}

function initResizable() {
  const r1 = $("resizer1");
  const r2 = $("resizer2");
  const sidebar = document.querySelector(".sidebar");
  const records = $("recordsSidebar");
  const editor = document.querySelector(".editor");

  r1.addEventListener("mousedown", (e) => startResizing(e, sidebar, "width", true));
  r2.addEventListener("mousedown", (e) => startResizing(e, records, "width", false));

  function startResizing(e, target, prop, isLeft) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = target.offsetWidth;
    const resizer = e.target;
    resizer.classList.add("resizing");

    const onMouseMove = (moveE) => {
      const delta = isLeft ? moveE.clientX - startX : startX - moveE.clientX;
      target.style[prop] = `${startWidth + delta}px`;
    };

    const onMouseUp = () => {
      resizer.classList.remove("resizing");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }
}

function initSidebarToggle() {
  const btn = $("toggleRecords");
  const sidebar = $("recordsSidebar");
  const resizer = $("resizer2");

  btn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    resizer.style.display = sidebar.classList.contains("collapsed") ? "none" : "block";
    btn.textContent = sidebar.classList.contains("collapsed") ? "▸◂" : "◂▸";
  });
}

init().catch((error) => {
  alert(error.message);
  console.error(error);
});
