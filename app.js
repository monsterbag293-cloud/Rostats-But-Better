const solveButton = document.getElementById("solve-btn");
const clearButton = document.getElementById("clear-btn");
const cipherTextInput = document.getElementById("cipher-text");
const minKeyLengthInput = document.getElementById("min-key-length");
const maxKeyLengthInput = document.getElementById("max-key-length");
const topResultsInput = document.getElementById("top-results");
const statusText = document.getElementById("status");
const progressWrap = document.getElementById("progress-wrap");
const progressBar = document.getElementById("progress-bar");
const resultsPanel = document.getElementById("results-panel");
const metricsText = document.getElementById("metrics");
const resultsContainer = document.getElementById("results");

const COMMON_WORDS = [
  "the", "and", "that", "have", "for", "not", "with", "you", "this", "from", "were", "which", "would", "there"
];

const LETTER_WEIGHT = "etaoinshrdlcumwfgypbvkjxqz";

function setStatus(message) {
  statusText.textContent = message;
}

function setProgress(percent) {
  progressBar.style.width = `${Math.min(100, Math.max(0, percent)).toFixed(1)}%`;
}

function toggleProgress(show) {
  progressWrap.classList.toggle("hidden", !show);
  progressWrap.setAttribute("aria-hidden", String(!show));
}

function isAlpha(char) {
  return /[a-z]/i.test(char);
}

function scoreText(text) {
  const lower = text.toLowerCase();
  let score = 0;

  for (const word of COMMON_WORDS) {
    if (lower.includes(word)) {
      score += 15;
    }
  }

  for (const char of lower) {
    const index = LETTER_WEIGHT.indexOf(char);
    if (index !== -1) {
      score += LETTER_WEIGHT.length - index;
    }
  }

  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    score += Math.max(0, 14 - Math.abs(5 - avgWordLength) * 3);
  }

  if (/[aeiou]{2,}/.test(lower)) {
    score += 10;
  }

  if (/[^a-z\s,.!?"'0-9:-]/.test(lower)) {
    score -= 12;
  }

  return score;
}

function vigenereDecrypt(cipher, key) {
  let result = "";
  const upperKey = key.toUpperCase();
  let keyIndex = 0;

  for (let i = 0; i < cipher.length; i += 1) {
    const char = cipher[i];
    if (!isAlpha(char)) {
      result += char;
      continue;
    }

    const base = char === char.toUpperCase() ? 65 : 97;
    const shift = upperKey.charCodeAt(keyIndex % upperKey.length) - 65;
    const decoded = String.fromCharCode((char.charCodeAt(0) - base - shift + 26) % 26 + base);

    result += decoded;
    keyIndex += 1;
  }

  return result;
}

function* generateKeysByLength(length, prefix = "") {
  if (length === 0) {
    yield prefix;
    return;
  }

  for (let i = 0; i < 26; i += 1) {
    yield* generateKeysByLength(length - 1, prefix + String.fromCharCode(65 + i));
  }
}

function computeTotalKeys(minLength, maxLength) {
  let total = 0;
  for (let length = minLength; length <= maxLength; length += 1) {
    total += 26 ** length;
  }
  return total;
}

async function bruteForceSolve(cipher, minLength, maxLength, topCount) {
  const totalKeys = computeTotalKeys(minLength, maxLength);
  let tested = 0;
  const best = [];

  for (let length = minLength; length <= maxLength; length += 1) {
    for (const key of generateKeysByLength(length)) {
      const decrypted = vigenereDecrypt(cipher, key);
      const score = scoreText(decrypted);
      tested += 1;

      best.push({ key, score, decrypted });
      best.sort((a, b) => b.score - a.score);
      if (best.length > topCount) {
        best.length = topCount;
      }

      if (tested % 2500 === 0 || tested === totalKeys) {
        setProgress((tested / totalKeys) * 100);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  return { best, tested, totalKeys };
}

function renderResults(results) {
  resultsContainer.innerHTML = "";

  for (const result of results) {
    const card = document.createElement("article");
    card.className = "result-card";

    card.innerHTML = `
      <div class="result-meta">
        <span class="chip">Key: ${result.key}</span>
        <span class="chip score">Score: ${result.score.toFixed(1)}</span>
      </div>
      <pre>${result.decrypted.replace(/</g, "&lt;")}</pre>
    `;

    resultsContainer.appendChild(card);
  }
}

solveButton.addEventListener("click", async () => {
  const cipher = cipherTextInput.value.trim();
  const minLength = Number(minKeyLengthInput.value);
  const maxLength = Number(maxKeyLengthInput.value);
  const topCount = Number(topResultsInput.value);

  if (!cipher) {
    setStatus("Paste encrypted text first.");
    return;
  }

  if (!Number.isInteger(minLength) || !Number.isInteger(maxLength) || minLength < 1 || maxLength < minLength || maxLength > 8) {
    setStatus("Set a valid key length range between 1 and 8.");
    return;
  }

  resultsPanel.classList.add("hidden");
  setStatus("Analyzing... this can take a moment for larger key spaces.");
  toggleProgress(true);
  setProgress(0);

  const started = performance.now();

  try {
    const { best, tested, totalKeys } = await bruteForceSolve(cipher, minLength, maxLength, topCount);
    const elapsed = ((performance.now() - started) / 1000).toFixed(2);

    metricsText.textContent = `${tested.toLocaleString()} keys tested in ${elapsed}s (space: ${totalKeys.toLocaleString()}).`;
    renderResults(best);
    resultsPanel.classList.remove("hidden");
    setStatus(`Done. Showing top ${best.length} ranked candidates.`);
  } catch (error) {
    setStatus(error.message || "Solver failed unexpectedly.");
  } finally {
    toggleProgress(false);
  }
});

clearButton.addEventListener("click", () => {
  cipherTextInput.value = "";
  resultsContainer.innerHTML = "";
  metricsText.textContent = "";
  resultsPanel.classList.add("hidden");
  toggleProgress(false);
  setStatus("Cleared. Ready for another analysis.");
});
