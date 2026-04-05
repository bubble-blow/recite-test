const sourceTextEl = document.getElementById('sourceText');
const difficultyEl = document.getElementById('difficulty');
const difficultyValueEl = document.getElementById('difficultyValue');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const setupPanel = document.getElementById('setupPanel');
const gamePanel = document.getElementById('gamePanel');
const passageEl = document.getElementById('passage');
const optionsEl = document.getElementById('options');
const feedbackEl = document.getElementById('feedback');
const statsEl = document.getElementById('stats');

const pinyinCollator = new Intl.Collator('zh-u-co-pinyin');

let state = null;

difficultyEl.addEventListener('input', () => {
  difficultyValueEl.textContent = `${Math.round(Number(difficultyEl.value) * 100)}%`;
});

startBtn.addEventListener('click', () => {
  const text = sourceTextEl.value.trim();
  if (!text) {
    alert('请先粘贴课文内容');
    return;
  }

  const chars = Array.from(text);
  const candidateIndices = chars
    .map((ch, idx) => ({ ch, idx }))
    .filter(item => isFillable(item.ch))
    .map(item => item.idx);

  if (!candidateIndices.length) {
    alert('文本中没有可用于填空的非标点文字，请检查内容。');
    return;
  }

  const initialRatio = Number(difficultyEl.value);
  const ratioStep = Math.max(0.05, (1 - initialRatio) / 5);

  state = {
    sourceChars: chars,
    candidateIndices,
    initialRatio,
    ratioStep,
    currentRatio: initialRatio,
    roundNumber: 0,
    hiddenIndices: [],
    hiddenSet: new Set(),
    currentBlankPointer: 0,
    attempts: 0,
    errors: 0
  };

  setupPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  startNewRound();
});

restartBtn.addEventListener('click', () => {
  state = null;
  gamePanel.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  optionsEl.innerHTML = '';
  passageEl.innerHTML = '';
});

function startNewRound() {
  state.roundNumber += 1;
  state.attempts = 0;
  state.errors = 0;
  state.hiddenIndices = pickHiddenIndices(state.candidateIndices, state.currentRatio);
  state.hiddenSet = new Set(state.hiddenIndices);
  state.currentBlankPointer = 0;

  renderPassage();
  updateStats();
  focusCurrentBlank();
}

function pickHiddenIndices(candidateIndices, ratio) {
  const count = Math.max(1, Math.floor(candidateIndices.length * ratio));
  const shuffled = [...candidateIndices].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).sort((a, b) => a - b);
}

function isFillable(ch) {
  return !(/[\p{P}\p{S}\s]/u.test(ch));
}

function renderPassage() {
  passageEl.innerHTML = '';
  const frag = document.createDocumentFragment();

  state.sourceChars.forEach((ch, idx) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.dataset.idx = String(idx);

    if (state.hiddenSet.has(idx)) {
      span.classList.add('hidden-char');
      span.textContent = '＿';
    } else {
      span.textContent = ch;
    }

    frag.appendChild(span);
  });

  passageEl.appendChild(frag);
}

function focusCurrentBlank() {
  clearActive();

  const idx = state.hiddenIndices[state.currentBlankPointer];
  if (idx === undefined) {
    finishRound();
    return;
  }

  const targetEl = passageEl.querySelector(`[data-idx="${idx}"]`);
  if (targetEl) {
    targetEl.classList.add('active');
  }

  renderOptionsFor(idx);
}

function clearActive() {
  passageEl.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
}

function renderOptionsFor(targetIdx) {
  const correctChar = state.sourceChars[targetIdx];
  const optionChars = getRandomCharsExcluding(correctChar, 7);
  const merged = Array.from(new Set([correctChar, ...optionChars]));
  merged.sort((a, b) => pinyinCollator.compare(a, b));

  optionsEl.innerHTML = '';
  merged.forEach(ch => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = ch;
    btn.addEventListener('click', () => handleChoice(ch, correctChar, targetIdx));
    optionsEl.appendChild(btn);
  });

  feedbackEl.className = 'feedback';
  feedbackEl.textContent = '请选择高亮空格对应的文字';
}

function getRandomCharsExcluding(excludeChar, count) {
  const pool = state.candidateIndices
    .map(idx => state.sourceChars[idx])
    .filter(ch => ch !== excludeChar);

  const uniquePool = Array.from(new Set(pool));
  uniquePool.sort(() => Math.random() - 0.5);
  return uniquePool.slice(0, count);
}

function handleChoice(chosen, correct, targetIdx) {
  state.attempts += 1;

  if (chosen === correct) {
    state.hiddenSet.delete(targetIdx);
    const targetEl = passageEl.querySelector(`[data-idx="${targetIdx}"]`);
    if (targetEl) {
      targetEl.classList.remove('hidden-char', 'active');
      targetEl.textContent = correct;
    }

    feedbackEl.className = 'feedback correct';
    feedbackEl.textContent = `正确：${correct}`;

    state.currentBlankPointer += 1;
    updateStats();
    focusCurrentBlank();
  } else {
    state.errors += 1;
    feedbackEl.className = 'feedback wrong';
    feedbackEl.textContent = `错误：你选了“${chosen}”，请重试。`;
    updateStats();
  }
}

function finishRound() {
  const errorRate = state.attempts === 0 ? 0 : state.errors / state.attempts;
  const passed = errorRate < 0.05;

  if (passed && state.currentRatio >= 1) {
    feedbackEl.className = 'feedback correct';
    feedbackEl.textContent = `🎉 通关成功！最终轮错误率 ${(errorRate * 100).toFixed(1)}%。`;
    optionsEl.innerHTML = '';
    updateStats();
    return;
  }

  if (passed) {
    const nextRatio = Math.min(1, state.currentRatio + state.ratioStep);
    const oldRatioText = `${Math.round(state.currentRatio * 100)}%`;
    const newRatioText = `${Math.round(nextRatio * 100)}%`;

    state.currentRatio = nextRatio;

    feedbackEl.className = 'feedback correct';
    feedbackEl.textContent = `本轮通过（错误率 ${(errorRate * 100).toFixed(1)}%），难度从 ${oldRatioText} 提升到 ${newRatioText}。`;
  } else {
    feedbackEl.className = 'feedback wrong';
    feedbackEl.textContent = `本轮错误率 ${(errorRate * 100).toFixed(1)}%（需 < 5%），保持当前难度再来一轮。`;
  }

  setTimeout(() => {
    startNewRound();
  }, 1200);
}

function updateStats() {
  const errorRate = state.attempts === 0 ? 0 : state.errors / state.attempts;
  statsEl.textContent = `第 ${state.roundNumber} 轮｜隐藏比例 ${Math.round(state.currentRatio * 100)}%｜已作答 ${state.attempts} 次｜错误 ${state.errors} 次｜错误率 ${(errorRate * 100).toFixed(1)}%`;
}
