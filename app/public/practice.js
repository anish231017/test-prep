const $ = (id) => document.getElementById(id);

let questions = [];
let answerVisible = new Set();
let solutionVisible = new Set();
let submitted = new Set();
let selections = new Map();

const sampleQuestion = {
  id: "sample-inline-preview",
  exam: "JEE Advanced",
  year: 2025,
  paper: "Paper 1",
  questionNumber: "Sample",
  subject: "Physics",
  topic: "Mechanics",
  difficulty: "Medium",
  type: "Single Correct",
  marks: { correct: 4, negative: -1, partial: 0 },
  questionText: "A block is kept on a smooth incline as shown [[fig:incline]]. Which option gives the acceleration?",
  options: [
    { label: "A", text: "$g \\sin \\theta$", isCorrect: true },
    { label: "B", text: "$g \\cos \\theta$", isCorrect: false },
    { label: "C", text: "$g \\tan \\theta$", isCorrect: false },
    { label: "D", text: "$0$", isCorrect: false }
  ],
  figures: [
    {
      marker: "incline",
      placement: "inline",
      alt: "Block on incline sample",
      caption: "Inline figure placeholder",
      url: ""
    }
  ],
  answer: { value: "A", explanation: "The component of gravity along the plane is $g \\sin \\theta$." },
  solutionText: "Resolve $mg$ along the plane. Since the surface is smooth, acceleration is $g \\sin \\theta$.",
  status: "sample"
};

async function init() {
  const response = await fetch("/api/questions");
  const store = await response.json();
  questions = (store.questions || []).length ? store.questions || [] : [sampleQuestion];
  setupFilters();
  bindEvents();
  render();
}

function bindEvents() {
  ["examFilter", "subjectFilter", "yearFilter", "difficultyFilter", "typeFilter", "searchFilter"].forEach((id) => {
    $(id).addEventListener("input", render);
  });
  $("resetFilters").addEventListener("click", () => {
    ["examFilter", "subjectFilter", "yearFilter", "difficultyFilter", "typeFilter", "searchFilter"].forEach((id) => {
      $(id).value = "";
    });
    render();
  });
}

function setupFilters() {
  fillSelect("examFilter", "All exams", unique("exam"));
  fillSelect("subjectFilter", "All subjects", unique("subject"));
  fillSelect("yearFilter", "All years", unique("year").sort((a, b) => Number(b) - Number(a)));
  fillSelect("difficultyFilter", "All difficulty", unique("difficulty"));
  fillSelect("typeFilter", "All types", unique("type"));
}

function fillSelect(id, label, values) {
  $(id).innerHTML = [`<option value="">${label}</option>`, ...values.map((value) => `<option>${escapeHtml(String(value))}</option>`)].join("");
}

function unique(key) {
  return [...new Set(questions.map((question) => question[key]).filter(Boolean).map(String))];
}

function filteredQuestions() {
  const subject = $("subjectFilter").value;
  const exam = $("examFilter").value;
  const year = $("yearFilter").value;
  const difficulty = $("difficultyFilter").value;
  const type = $("typeFilter").value;
  const search = $("searchFilter").value.trim().toLowerCase();

  return questions.filter((question) => {
    if (question.status === "deleted") return false;
    if (exam && question.exam !== exam) return false;
    if (subject && question.subject !== subject) return false;
    if (year && String(question.year) !== year) return false;
    if (difficulty && question.difficulty !== difficulty) return false;
    if (type && question.type !== type) return false;
    if (search && !JSON.stringify(question).toLowerCase().includes(search)) return false;
    return true;
  });
}

function render() {
  const visible = filteredQuestions();
  $("visibleCount").textContent = visible.length;
  $("emptyState").hidden = visible.length > 0;
  
  const list = $("questionList");
  list.innerHTML = "";
  
  const CHUNK_SIZE = 6;
  let index = 0;

  function renderNextChunk() {
    const chunk = visible.slice(index, index + CHUNK_SIZE);
    if (!chunk.length) return;

    const fragment = document.createDocumentFragment();
    chunk.forEach((question) => {
      fragment.appendChild(renderQuestion(question));
    });
    list.appendChild(fragment);
    
    // Typeset the new content
    typesetMath(list);
    
    index += CHUNK_SIZE;
    updateLoadMoreButton();
  }

  function updateLoadMoreButton() {
    let btn = $("loadMoreBtn");
    if (index < visible.length) {
      if (!btn) {
        btn = document.createElement("button");
        btn.id = "loadMoreBtn";
        btn.className = "loadMoreBtn";
        btn.textContent = "Load More Questions";
        btn.addEventListener("click", renderNextChunk);
        list.after(btn);
      }
      btn.hidden = false;
    } else if (btn) {
      btn.hidden = true;
    }
  }

  renderNextChunk();
}

function renderQuestion(question) {
  const node = $("questionTemplate").content.firstElementChild.cloneNode(true);
  const mode = responseMode(question);
  node.querySelector(".questionMeta").innerHTML = [
    `${question.exam || "Exam"} ${question.year || ""}`,
    question.paper,
    question.questionNumber ? `Q${question.questionNumber}` : "",
    question.subject,
    question.topic,
    question.difficulty,
    question.type,
    marksLabel(question.marks),
    question.status === "sample" ? "Sample preview" : question.status
  ]
    .filter(Boolean)
    .map((item) => `<span class="pill">${escapeHtml(item)}</span>`)
    .join("");

  node.querySelector(".questionText").appendChild(renderQuestionText(question));
  renderBelowFigures(node.querySelector(".belowFigures"), question);
  renderResponseControl(node.querySelector(".options"), question, mode, answerVisible.has(question.id) || submitted.has(question.id));

  const submitButton = node.querySelector(".submitAnswer");
  submitButton.hidden = !["integer", "single", "multi"].includes(mode);
  submitButton.addEventListener("click", () => {
    submitted.add(question.id);
    render();
  });

  const attemptPanel = node.querySelector(".attemptPanel");
  renderAttemptPanel(attemptPanel, question, mode);

  const answerPanel = node.querySelector(".answerPanel");
  answerPanel.hidden = !answerVisible.has(question.id);
  answerPanel.innerHTML = `<strong>Answer:</strong> ${escapeHtml(question.answer?.value || "Not added yet")}${
    question.answer?.explanation ? `<br>${formatText(question.answer.explanation)}` : ""
  }`;

  const solutionPanel = node.querySelector(".solutionPanel");
  solutionPanel.hidden = !solutionVisible.has(question.id);
  solutionPanel.innerHTML = `<strong>Solution:</strong><br>${formatText(question.solutionText || "Solution has not been added yet.")}`;

  node.querySelector(".showAnswer").textContent = answerVisible.has(question.id) ? "Hide answer" : "Show answer";
  node.querySelector(".showAnswer").addEventListener("click", () => toggle(answerVisible, question.id));
  node.querySelector(".showSolution").textContent = solutionVisible.has(question.id) ? "Hide solution" : "Show solution";
  node.querySelector(".showSolution").addEventListener("click", () => toggle(solutionVisible, question.id));
  return node;
}

function renderQuestionText(question) {
  const wrapper = document.createElement("div");
  const figuresByMarker = new Map((question.figures || []).map((figure) => [figure.marker, figure]));
  const parts = normalizeLatexText(question.questionText).split(
    /(\[\[fig:[a-z0-9-]+\]\]|\$\$(?:.|\n)*?\$\$|\\\[(?:.|\n)*?\\\]|\$[^$]+\$|\\\((?:.|\n)*?\\\))/g
  );

  let paragraph = null;
  const ensureParagraph = () => {
    if (!paragraph) {
      paragraph = document.createElement("p");
      wrapper.appendChild(paragraph);
    }
    return paragraph;
  };

  parts.filter(Boolean).forEach((part) => {
    const markerMatch = /^\[\[fig:([a-z0-9-]+)\]\]$/.exec(part);
    if (markerMatch) {
      ensureParagraph().appendChild(renderFigure(figuresByMarker.get(markerMatch[1]), markerMatch[1], true));
      return;
    }

    const displayMath = /^\\\[((?:.|\n)*?)\\\]$/.exec(part) || /^\$\$((?:.|\n)*?)\$\$$/.exec(part);
    if (displayMath) {
      paragraph = null;
      wrapper.appendChild(createMathElement(displayMath[1], true));
      paragraph = null;
      return;
    }

    const inlineMath = /^\$([^$]+)\$$/.exec(part) || /^\\\((.*?)\\\)$/.exec(part);
    if (inlineMath) {
      ensureParagraph().appendChild(createMathElement(inlineMath[1], false));
      return;
    }

    part.split(/\n{2,}/).forEach((chunk, index) => {
      if (index > 0) {
        paragraph = document.createElement("p");
        wrapper.appendChild(paragraph);
      }
      ensureParagraph().appendChild(document.createTextNode(chunk));
    });
  });

  return wrapper;
}

function createMathElement(latex, block) {
  const element = document.createElement(block ? "div" : "span");
  element.className = block ? "mathSource block" : "mathSource";
  element.dataset.latex = latex;
  element.textContent = block ? `\\[${latex}\\]` : `\\(${latex}\\)`;
  return element;
}

function renderBelowFigures(container, question) {
  (question.figures || [])
    .filter((figure) => figure.placement !== "inline")
    .forEach((figure) => container.appendChild(renderFigure(figure, figure.marker, false)));
}

function renderFigure(figure, marker, inline) {
  const box = document.createElement("figure");
  box.className = inline ? "inlineFigure" : "figureBlock";

  if (figure?.url) {
    const image = document.createElement("img");
    image.src = figure.url;
    image.alt = figure.alt || marker || "Question figure";
    box.appendChild(image);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "figurePlaceholder";
    placeholder.textContent = `Figure: ${marker || "missing"}`;
    box.appendChild(placeholder);
  }

  if (figure?.caption) {
    const caption = document.createElement("figcaption");
    caption.className = "figureCaption";
    caption.textContent = figure.caption;
    box.appendChild(caption);
  }
  return box;
}

function renderResponseControl(container, question, mode, showCorrect) {
  if (mode === "integer") {
    renderIntegerInput(container, question);
    return;
  }

  if (!["single", "multi"].includes(mode)) return;

  const options = (question.options || []).filter((option) => option.text || option.image?.url);
  if (!options.length) return;
  const selected = getSelectionSet(question.id);

  options.forEach((option) => {
    const row = document.createElement("button");
    const isSelected = selected.has(option.label);
    row.type = "button";
    row.className = [
      "option",
      isSelected ? "selected" : "",
      showCorrect && option.isCorrect ? "correct" : "",
      showCorrect && isSelected && !option.isCorrect ? "incorrect" : ""
    ]
      .filter(Boolean)
      .join(" ");
    row.setAttribute("aria-pressed", isSelected ? "true" : "false");
    const label = document.createElement("span");
    label.className = "optionLabel";
    label.textContent = option.label || "";
    const body = document.createElement("span");
    body.className = "optionBody";
    if (option.text) {
      body.appendChild(renderInlineMathText(option.text));
    }
    if (option.image?.url) {
      const image = document.createElement("img");
      image.className = "optionImage";
      image.src = option.image.url;
      image.alt = option.image.alt || `Option ${option.label || ""}`;
      body.appendChild(image);
    }
    row.append(label, body);
    row.addEventListener("click", () => {
      if (mode === "single") {
        selections.set(question.id, new Set([option.label]));
      } else if (selected.has(option.label)) {
        selected.delete(option.label);
      } else {
        selected.add(option.label);
      }
      submitted.delete(question.id);
      render();
    });
    container.appendChild(row);
  });
}

function renderInlineMathText(text) {
  const wrapper = document.createElement("span");
  const value = normalizeLatexText(text).trim();
  if (looksLikeStandaloneLatex(value)) {
    wrapper.appendChild(createMathElement(value, false));
    return wrapper;
  }

  const parts = value.split(/(\$[^$]+\$|\\\((?:.|\n)*?\\\))/g);
  parts.filter(Boolean).forEach((part) => {
    const dollar = /^\$([^$]+)\$$/.exec(part);
    const paren = /^\\\((.*?)\\\)$/.exec(part);
    if (dollar || paren) {
      wrapper.appendChild(createMathElement((dollar || paren)[1], false));
    } else {
      wrapper.appendChild(document.createTextNode(part));
    }
  });
  return wrapper;
}

function looksLikeStandaloneLatex(value) {
  if (!/\\(?:frac|sqrt|alpha|beta|theta|pi|sin|cos|tan|omega|left|right|begin|text|times)/.test(value)) return false;
  const words = value.replace(/\\[a-zA-Z]+/g, "").match(/[A-Za-z]{3,}/g) || [];
  return words.length <= 2;
}

function renderIntegerInput(container, question) {
  const value = selections.get(question.id) || "";
  const wrapper = document.createElement("div");
  wrapper.className = "integerAnswer";
  wrapper.innerHTML = `
    <label>
      Your answer
      <input inputmode="decimal" value="${escapeHtml(String(value))}" placeholder="Type numerical answer" />
    </label>
  `;
  const input = wrapper.querySelector("input");
  input.addEventListener("input", () => {
    selections.set(question.id, input.value);
    submitted.delete(question.id);
  });
  container.appendChild(wrapper);
}

function renderAttemptPanel(panel, question, mode) {
  if (!submitted.has(question.id)) {
    panel.hidden = true;
    return;
  }
  const correct = isCorrect(question, mode);
  panel.hidden = false;
  panel.className = `attemptPanel ${correct ? "ok" : "bad"}`;
  panel.textContent = correct ? "Correct answer." : "Not correct. Review the answer or solution.";
}

function responseMode(question) {
  const type = String(question.type || "").toLowerCase();
  if (type.includes("integer") || type.includes("numerical")) return "integer";
  if (type.includes("multiple") || type.includes("multi")) return "multi";
  if (type.includes("single") || type.includes("match") || type.includes("matrix") || type.includes("paragraph")) return "single";
  return "none";
}

function getSelectionSet(id) {
  const existing = selections.get(id);
  if (existing instanceof Set) return existing;
  const fresh = new Set();
  selections.set(id, fresh);
  return fresh;
}

function isCorrect(question, mode) {
  if (mode === "integer") {
    return normalizeAnswer(selections.get(question.id)) === normalizeAnswer(question.answer?.value);
  }
  const selected = [...getSelectionSet(question.id)].sort();
  const correct = (question.options || [])
    .filter((option) => option.isCorrect)
    .map((option) => option.label)
    .sort();
  return selected.length > 0 && selected.join("|") === correct.join("|");
}

function toggle(set, id) {
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  render();
}

function marksLabel(marks = {}) {
  const correct = Number(marks.correct || 0);
  const negative = Number(marks.negative || 0);
  const partial = Number(marks.partial || 0);
  return `+${correct}${negative ? ` / ${negative}` : ""}${partial ? ` / partial ${partial}` : ""}`;
}

function formatText(value) {
  return escapeHtml(String(value || "")).replace(/\n/g, "<br>");
}

function normalizeAnswer(value) {
  const cleaned = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? String(Number(number.toFixed(6))) : cleaned;
}

function typesetMath(root = $("questionList"), attempt = 0) {
  if (!root) return;
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([root]).catch(() => applyLatexFallback(root));
    return;
  }
  if (window.mathJaxReady) {
    window.mathJaxReady
      .then(() => window.MathJax.typesetPromise([root]))
      .catch(() => applyLatexFallback(root));
    return;
  }
  if (attempt < 20) {
    window.setTimeout(() => typesetMath(root, attempt + 1), 150);
  } else {
    applyLatexFallback(root);
  }
}

function applyLatexFallback(root) {
  root.querySelectorAll(".mathSource").forEach((node) => {
    if (node.dataset.mathFallback === "done") return;
    node.className = node.classList.contains("block") ? "mathRendered block" : "mathRendered";
    node.innerHTML = latexToHtml(node.dataset.latex || "");
    node.dataset.mathFallback = "done";
  });

  root.querySelectorAll(".questionText p, .option span:last-child, .answerPanel, .solutionPanel").forEach((node) => {
    if (node.dataset.mathFallback === "done") return;
    const text = node.innerHTML;
    if (!/[\\][$[(]|\\frac|\\alpha|\\beta|\\int|\\lim/.test(text)) return;
    node.innerHTML = fallbackMathHtml(text);
    node.dataset.mathFallback = "done";
  });
}

function normalizeLatexText(value) {
  return String(value || "")
    .replace(/(^|[^\\])begin\{/g, "$1\\begin{")
    .replace(/(^|[^\\])end\{/g, "$1\\end{")
    .replace(/(^|[^\\])text\{/g, "$1\\text{")
    .replace(/(^|[^\\])frac\{/g, "$1\\frac{")
    .replace(/(^|[^\\])sqrt\{/g, "$1\\sqrt{")
    .replace(/(^|[^\\])times\b/g, "$1\\times")
    .replace(/\\begin\{pmatrix\}/g, "\\begin{pmatrix}")
    .replace(/\\end\{pmatrix\}/g, "\\end{pmatrix}");
}

function fallbackMathHtml(html) {
  return html
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, expr) => `<span class="mathRendered block">${latexToHtml(expr)}</span>`)
    .replace(/\$([^$]+)\$/g, (_, expr) => `<span class="mathRendered">${latexToHtml(expr)}</span>`)
    .replace(/\\\((.*?)\\\)/g, (_, expr) => `<span class="mathRendered">${latexToHtml(expr)}</span>`);
}

function translateLatex(expr) {
  let output = String(expr || "");
  output = output.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
  output = output.replace(/\^\{([^{}]+)\}/g, "^($1)");
  output = output.replace(/_\{([^{}]+)\}/g, "_($1)");
  const symbols = {
    "\\alpha": "α",
    "\\beta": "β",
    "\\theta": "θ",
    "\\pi": "π",
    "\\to": "→",
    "\\infty": "∞",
    "\\int": "∫",
    "\\lim": "lim",
    "\\cos": "cos",
    "\\sin": "sin",
    "\\tan": "tan",
    "\\left": "",
    "\\right": "",
    "\\,": " "
  };
  Object.entries(symbols).forEach(([from, to]) => {
    output = output.split(from).join(to);
  });
  return output.replace(/\s+/g, " ").trim();
}

function latexToHtml(expr) {
  return renderLatex(cleanLatex(expr));
}

function cleanLatex(expr) {
  return String(expr || "")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "")
    .replace(/\\,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderLatex(expr) {
  let html = "";
  for (let i = 0; i < expr.length; i += 1) {
    if (expr.startsWith("\\frac", i)) {
      const numerator = readBraceGroup(expr, i + 5);
      const denominator = numerator ? readBraceGroup(expr, numerator.end) : null;
      if (numerator && denominator) {
        html += `<span class="frac"><span>${renderLatex(numerator.value)}</span><span>${renderLatex(denominator.value)}</span></span>`;
        i = denominator.end - 1;
        continue;
      }
    }

    if (expr.startsWith("\\lim", i)) {
      const sub = expr[i + 4] === "_" ? readScript(expr, i + 5) : null;
      html += `<span class="mathOp"><span>lim</span>${sub ? `<sub>${renderLatex(sub.value)}</sub>` : ""}</span>`;
      if (sub) i = sub.end - 1;
      else i += 3;
      continue;
    }

    if (expr.startsWith("\\int", i)) {
      let cursor = i + 4;
      const sub = expr[cursor] === "_" ? readScript(expr, cursor + 1) : null;
      cursor = sub ? sub.end : cursor;
      const sup = expr[cursor] === "^" ? readScript(expr, cursor + 1) : null;
      html += `<span class="integral">∫${sup ? `<sup>${renderLatex(sup.value)}</sup>` : ""}${sub ? `<sub>${renderLatex(sub.value)}</sub>` : ""}</span>`;
      i = (sup || sub)?.end ? (sup || sub).end - 1 : i + 3;
      continue;
    }

    if (expr.startsWith("\\sqrt", i)) {
      let cursor = i + 5;
      const degree = expr[cursor] === "[" ? readBracketGroup(expr, cursor) : null;
      cursor = degree ? degree.end : cursor;
      const radicand = readBraceGroup(expr, cursor);
      if (radicand) {
        html += `<span class="root">${degree ? `<sup class="rootDegree">${renderLatex(degree.value)}</sup>` : ""}<span class="rootSymbol">√</span><span class="rootBody">${renderLatex(radicand.value)}</span></span>`;
        i = radicand.end - 1;
        continue;
      }
    }

    if (expr[i] === "^" || expr[i] === "_") {
      const script = readScript(expr, i + 1);
      if (script) {
        html += expr[i] === "^" ? `<sup>${renderLatex(script.value)}</sup>` : `<sub>${renderLatex(script.value)}</sub>`;
        i = script.end - 1;
        continue;
      }
    }

    if (expr[i] === "\\") {
      const command = /^\\[a-zA-Z]+/.exec(expr.slice(i))?.[0] || "\\";
      html += latexSymbol(command);
      i += command.length - 1;
      continue;
    }

    if (/[+=]/.test(expr[i]) || (expr[i] === "-" && expr[i - 1] !== undefined && expr[i - 1] !== "(")) {
      html += `<span class="mathBin">${escapeHtml(expr[i])}</span>`;
      continue;
    }

    if (expr[i] === "(" || expr[i] === ")") {
      html += `<span class="mathParen">${expr[i]}</span>`;
      continue;
    }

    html += escapeHtml(expr[i]);
  }
  return html;
}

function readBraceGroup(text, start) {
  if (text[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    if (text[i] === "}") depth -= 1;
    if (depth === 0) {
      return { value: text.slice(start + 1, i), end: i + 1 };
    }
  }
  return null;
}

function readBracketGroup(text, start) {
  if (text[start] !== "[") return null;
  const end = text.indexOf("]", start + 1);
  if (end === -1) return null;
  return { value: text.slice(start + 1, end), end: end + 1 };
}

function readScript(text, start) {
  if (text[start] === "{") return readBraceGroup(text, start);
  if (start < text.length) return { value: text[start], end: start + 1 };
  return null;
}

function latexSymbol(command) {
  const symbols = {
    "\\alpha": "α",
    "\\beta": "β",
    "\\theta": "θ",
    "\\omega": "ω",
    "\\pi": "π",
    "\\to": "→",
    "\\infty": "∞",
    "\\cos": "cos",
    "\\sin": "sin",
    "\\tan": "tan",
    "\\sqrt": "√",
    "\\cdot": "·",
    "\\times": "×"
  };
  return symbols[command] || escapeHtml(command.replace("\\", ""));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

init().catch((error) => {
  $("emptyState").hidden = false;
  $("emptyState").textContent = error.message;
  console.error(error);
});
