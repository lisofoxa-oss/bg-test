// ============================================================
//  app.js — Логика на приложението
// ============================================================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const app = document.getElementById("app");

// --- State ---
let scores = JSON.parse(localStorage.getItem("bg_history_scores") || "{}");
let currentView = "home";       // home | topic | quiz | results
let currentTopicId = null;
let isFinalQuiz = false;

// Quiz state
let quizQuestions = [];
let quizIndex = 0;
let quizSelected = null;
let quizAnswered = false;
let quizCorrectCount = 0;
let quizAnswers = [];

function saveScores() {
  localStorage.setItem("bg_history_scores", JSON.stringify(scores));
}

// --- Utilities ---
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleQuestion(q) {
  const correctText = q.options[q.correct];
  const shuffled = shuffle(q.options);
  return { ...q, options: shuffled, correct: shuffled.indexOf(correctText) };
}

function getStars(pct) {
  if (pct >= 90) return 3;
  if (pct >= 70) return 2;
  if (pct >= 50) return 1;
  return 0;
}

function starsHTML(count, max = 3) {
  let h = '<div class="stars">';
  for (let i = 0; i < max; i++) {
    h += `<span class="stars__star ${i < count ? '' : 'stars__star--off'}">⭐</span>`;
  }
  return h + '</div>';
}

function progressRingSVG(pct, size = 36, stroke = 3, color = "#C4956A") {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return `<svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" class="ring-bg" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" class="ring-fill" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
  </svg>`;
}

// --- Renderers ---

function renderHome() {
  const totalQ = TOPICS.reduce((s, t) => s + t.questions.length, 0);
  const totalCorrect = Object.entries(scores).filter(([k]) => k !== '_final').reduce((s, [, v]) => s + (v.correct || 0), 0);
  const completedCount = TOPICS.filter(t => scores[t.id]?.completed).length;
  const allCompleted = completedCount === TOPICS.length;
  const overallPct = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

  let html = `
    <div class="header fade-in">
      <h1 class="header__title">Българска история</h1>
      <p class="header__sub">Балкански войни · Световни войни · Лидери</p>
    </div>`;

  if (completedCount > 0) {
    html += `
    <div class="overall-progress fade-in">
      <div class="overall-progress__inner">
        ${progressRingSVG(overallPct)}
        <span class="overall-progress__text">${completedCount} от ${TOPICS.length} теми · ${overallPct}% верни</span>
      </div>
    </div>`;
  }

  html += `<div class="card-grid">`;

  TOPICS.forEach((t, i) => {
    const sc = scores[t.id];
    const stars = sc ? getStars(sc.percent) : 0;
    const delay = i * 0.07;
    html += `
    <div class="card slide-up" style="background:linear-gradient(135deg,${t.color}18,${t.color}08);border:1px solid ${t.color}30;animation-delay:${delay}s" data-topic="${t.id}">
      <div class="card__emoji">${t.emoji}</div>
      <div class="card__title">${t.title}</div>
      <div class="card__subtitle">${t.subtitle}</div>
      ${sc?.completed ? `<div class="card__score">${starsHTML(stars)}<span class="card__score-pct">${sc.percent}%</span></div>` : ''}
    </div>`;
  });

  if (allCompleted) {
    html += `
    <div class="final-btn-wrap slide-up" style="animation-delay:0.4s">
      <button class="btn-primary" id="btn-final" style="background:linear-gradient(135deg,#B8860B,#B8860BDD)">🏆 Финален тест — всички теми</button>
    </div>`;
  } else {
    html += `<p class="lock-hint fade-in">Премини всички теми, за да отключиш финалния тест 🔒</p>`;
  }

  html += `</div>`;
  app.innerHTML = html;

  // Bind events
  $$("[data-topic]", app).forEach(el => {
    el.addEventListener("click", () => {
      currentTopicId = el.dataset.topic;
      currentView = "topic";
      render();
    });
  });

  const finalBtn = $("#btn-final", app);
  if (finalBtn) {
    finalBtn.addEventListener("click", () => {
      isFinalQuiz = true;
      startQuiz();
    });
  }
}

function renderTopic() {
  const t = TOPICS.find(x => x.id === currentTopicId);
  if (!t) return;

  app.innerHTML = `
  <div class="page fade-in">
    <button class="btn-back" id="btn-back">← Назад</button>
    <div class="topic-hero">
      <div class="topic-hero__emoji">${t.emoji}</div>
      <div class="topic-hero__title">${t.title}</div>
      <div class="topic-hero__sub">${t.subtitle}</div>
    </div>
    <div class="summary-box">${t.summary}</div>
    <div class="topic-start">
      <button class="btn-primary" id="btn-start-quiz" style="background:linear-gradient(135deg,${t.color},${t.color}DD)">Започни теста →</button>
    </div>
  </div>`;

  $("#btn-back", app).addEventListener("click", () => { currentView = "home"; render(); });
  $("#btn-start-quiz", app).addEventListener("click", () => { isFinalQuiz = false; startQuiz(); });
}

function startQuiz() {
  if (isFinalQuiz) {
    // 3 random questions from each topic
    quizQuestions = [];
    TOPICS.forEach(t => {
      const picked = shuffle(t.questions).slice(0, 3);
      quizQuestions.push(...picked);
    });
    quizQuestions = shuffle(quizQuestions).map(shuffleQuestion);
  } else {
    const t = TOPICS.find(x => x.id === currentTopicId);
    quizQuestions = shuffle(t.questions).map(shuffleQuestion);
  }

  quizIndex = 0;
  quizSelected = null;
  quizAnswered = false;
  quizCorrectCount = 0;
  quizAnswers = [];
  currentView = "quiz";
  render();
}

function renderQuiz() {
  const t = isFinalQuiz ? null : TOPICS.find(x => x.id === currentTopicId);
  const color = isFinalQuiz ? "#B8860B" : t.color;
  const label = isFinalQuiz ? "🏆 Финален тест" : `${t.emoji} ${t.title}`;
  const q = quizQuestions[quizIndex];
  const pct = (quizIndex / quizQuestions.length) * 100;

  let html = `
  <div class="page fade-in">
    <button class="btn-back" id="btn-back-quiz">← Назад</button>
    <div class="quiz-header">
      <span class="quiz-header__label">${label}</span>
      <span class="quiz-header__count">${quizIndex + 1} / ${quizQuestions.length}</span>
    </div>
    <div class="progress-track">
      <div class="progress-track__fill" style="width:${pct}%;background:${color}"></div>
    </div>
    <h3 class="quiz-question">${q.q}</h3>
    <div class="options">`;

  const letters = ["A", "B", "C", "D"];
  q.options.forEach((opt, idx) => {
    let cls = "option-btn";
    if (quizAnswered) {
      cls += " option-btn--disabled";
      if (idx === q.correct) cls += " option-btn--correct";
      else if (idx === quizSelected) cls += " option-btn--wrong";
    }
    html += `<button class="${cls}" data-idx="${idx}"><span class="option-letter">${letters[idx]}</span>${opt}</button>`;
  });

  html += `</div>`;

  if (quizAnswered) {
    const icon = quizSelected === q.correct ? "✓" : "✗";
    html += `
    <div class="explanation slide-up">${icon} ${q.explanation}</div>
    <div class="quiz-next slide-up">
      <button class="btn-primary" id="btn-next" style="background:linear-gradient(135deg,${color},${color}DD)">
        ${quizIndex + 1 >= quizQuestions.length ? "Виж резултата" : "Следващ →"}
      </button>
    </div>`;
  }

  html += `</div>`;
  app.innerHTML = html;

  // Events
  $("#btn-back-quiz", app).addEventListener("click", () => {
    if (isFinalQuiz) { currentView = "home"; }
    else { currentView = "topic"; }
    render();
  });

  if (!quizAnswered) {
    $$("[data-idx]", app).forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        quizSelected = idx;
        quizAnswered = true;
        const isCorrect = idx === q.correct;
        if (isCorrect) quizCorrectCount++;
        quizAnswers.push({
          question: q.q,
          correct: isCorrect,
          correctAnswer: q.options[q.correct]
        });
        render();
      });
    });
  }

  const nextBtn = $("#btn-next", app);
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (quizIndex + 1 >= quizQuestions.length) {
        currentView = "results";
        render();
      } else {
        quizIndex++;
        quizSelected = null;
        quizAnswered = false;
        render();
      }
    });
  }
}

function renderResults() {
  const t = isFinalQuiz ? null : TOPICS.find(x => x.id === currentTopicId);
  const color = isFinalQuiz ? "#B8860B" : t.color;
  const pctScore = Math.round((quizCorrectCount / quizQuestions.length) * 100);
  const stars = getStars(pctScore);

  // Save score
  if (isFinalQuiz) {
    scores._final = { completed: true, percent: pctScore, correct: quizCorrectCount };
  } else {
    const prev = scores[currentTopicId];
    // Keep best score
    if (!prev || pctScore > prev.percent) {
      scores[currentTopicId] = { completed: true, percent: pctScore, correct: quizCorrectCount };
    } else if (!prev.completed) {
      scores[currentTopicId] = { completed: true, percent: pctScore, correct: quizCorrectCount };
    }
  }
  saveScores();

  const messages = [
    { min: 90, text: "Отлично! Перфектно знаеш материала! 🌟", sub: "Готова си за теста!" },
    { min: 70, text: "Много добре! Почти перфектно! 💪", sub: "Опитай отново за 3 звезди!" },
    { min: 50, text: "Добро начало! Има какво да повториш. 📚", sub: "Прочети отново и опитай пак!" },
    { min: 0,  text: "Не се притеснявай! Прочети темата отново. 💛", sub: "С повторение идва успехът!" },
  ];
  const msg = messages.find(m => pctScore >= m.min);
  const wrong = quizAnswers.filter(a => !a.correct);

  let html = `
  <div class="page">
    <div class="results fade-in">
      <div class="results__circle" style="background:linear-gradient(135deg,${color}25,${color}10);border:2px solid ${color}50">
        <span class="results__pct" style="color:${color}">${pctScore}%</span>
        <span class="results__count">${quizCorrectCount}/${quizQuestions.length}</span>
      </div>
      <div class="results__stars">${starsHTML(stars)}</div>
      <h3 class="results__msg">${msg.text}</h3>
      <p class="results__hint">${msg.sub}</p>`;

  if (wrong.length > 0) {
    html += `<div class="wrong-list"><h4 class="wrong-list__title">Грешни отговори:</h4>`;
    wrong.forEach(a => {
      html += `
      <div class="wrong-item">
        <div class="wrong-item__q">${a.question}</div>
        <div class="wrong-item__a">✓ ${a.correctAnswer}</div>
      </div>`;
    });
    html += `</div>`;
  }

  html += `
      <div class="results__actions">
        <button class="btn-primary" id="btn-home" style="background:linear-gradient(135deg,${color},${color}DD)">Назад към темите</button>
        <button class="btn-secondary" id="btn-retry">🔄 Опитай отново</button>
      </div>
    </div>
  </div>`;

  app.innerHTML = html;

  $("#btn-home", app).addEventListener("click", () => { currentView = "home"; render(); });
  $("#btn-retry", app).addEventListener("click", () => { startQuiz(); });
}

// --- Router ---
function render() {
  window.scrollTo(0, 0);
  switch (currentView) {
    case "home":    renderHome(); break;
    case "topic":   renderTopic(); break;
    case "quiz":    renderQuiz(); break;
    case "results": renderResults(); break;
  }
}

// --- Init ---
render();
