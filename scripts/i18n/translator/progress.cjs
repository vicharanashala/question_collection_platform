// Terminal output for the translator: colours, step headings, a live progress bar with a
// countdown, and plain lines when the output is not a terminal (CI logs, files).

const interactive = Boolean(process.stdout.isTTY) && !process.env.CI;
const colour = interactive && !process.env.NO_COLOR;

const paint = (code) => (text) => (colour ? `\x1b[${code}m${text}\x1b[0m` : String(text));
const style = {
  bold: paint(1),
  dim: paint(2),
  green: paint(32),
  yellow: paint(33),
  red: paint(31),
  cyan: paint(36),
};

const LANGUAGE_NAMES = {
  as: "Assamese", bn: "Bengali", brx: "Bodo", doi: "Dogri", gu: "Gujarati", hi: "Hindi",
  kn: "Kannada", ks: "Kashmiri", kok: "Konkani", mai: "Maithili", ml: "Malayalam",
  mni: "Manipuri", mr: "Marathi", ne: "Nepali", or: "Odia", pa: "Punjabi", sa: "Sanskrit",
  sat: "Santali", sd: "Sindhi", ta: "Tamil", te: "Telugu", ur: "Urdu",
};

// Formats milliseconds as "45s" or "2m 05s".
function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
}

function languageName(code) {
  return LANGUAGE_NAMES[code] || code;
}

// Prints a numbered step heading such as "[2/3] Translating".
function step(number, total, title) {
  console.log(`\n${style.bold(style.cyan(`[${number}/${total}]`))} ${style.bold(title)}`);
}

function detail(text) {
  console.log(`      ${text}`);
}

/**
 * A progress bar that also counts down the time left. The estimate is replaced by the
 * measured speed once work starts, and the countdown ticks every second in between.
 */
function createProgress(total, estimateMs) {
  const startedAt = Date.now();
  let completed = 0;
  let note = "";
  let remainingMs = estimateMs;
  let measuredAt = Date.now();
  let timer;

  function render() {
    const left = Math.max(0, remainingMs - (Date.now() - measuredAt));
    const ratio = total ? completed / total : 0;
    const width = 24;
    const filled = Math.round(ratio * width);
    const bar = style.green("█".repeat(filled)) + style.dim("░".repeat(width - filled));
    const percent = `${String(Math.round(ratio * 100)).padStart(3)}%`;
    const timeLeft = completed >= total
      ? "finishing"
      : left < 1000
        ? "a few more seconds"
        : `~${formatDuration(left)} left`;
    process.stdout.write(`\r\x1b[2K      ${bar} ${percent}  ${completed}/${total}  ${style.dim(note)}  ${style.cyan(timeLeft)}`);
  }

  if (interactive) {
    render();
    timer = setInterval(render, 1000);
  }

  return {
    update(done, text) {
      completed = done;
      note = text || note;
      const elapsed = Date.now() - startedAt;
      if (done > 0) remainingMs = (elapsed / done) * (total - done);
      measuredAt = Date.now();
      if (interactive) render();
      else detail(`${done}/${total} ${text || ""}`.trim());
    },
    stop() {
      clearInterval(timer);
      if (interactive) process.stdout.write("\r\x1b[2K");
      return Date.now() - startedAt;
    },
  };
}

// Counts down a pause on one line, then clears it.
async function countdown(ms, label) {
  if (!interactive) {
    detail(`${label} (${formatDuration(ms)})`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    return;
  }
  const endsAt = Date.now() + ms;
  await new Promise((resolve) => {
    const tick = () => {
      const left = endsAt - Date.now();
      process.stdout.write(`\r\x1b[2K      ${style.yellow("⏳")} ${label} ${style.cyan(formatDuration(left))}`);
      if (left <= 0) {
        clearInterval(timer);
        process.stdout.write("\r\x1b[2K");
        resolve();
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
  });
}

module.exports = { style, step, detail, createProgress, countdown, formatDuration, languageName };
