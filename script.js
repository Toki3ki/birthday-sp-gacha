const prizes = [
  { name: "手写拍立得", desc: "当天现场随机签一张，适合收藏到手机壳背面。", rarity: "SSR", weight: 4 },
  { name: "生日 SP 合照券", desc: "演出后限定一张合照，姿势可以现场指定。", rarity: "SR", weight: 7 },
  { name: "点歌小纸条", desc: "下次练习或直播时，从纸条里选一首唱。", rarity: "SR", weight: 8 },
  { name: "千禧贴纸包", desc: "镭射、星星、像素风混装，抽到就有仪式感。", rarity: "R", weight: 14 },
  { name: "专属语音晚安", desc: "十秒以内，甜度自行调节。", rarity: "SSR", weight: 3 },
  { name: "应援色发绳", desc: "可以当手环，也可以挂在包上。", rarity: "R", weight: 13 },
  { name: "便利店饮料券", desc: "演出后一起去买，预算学生友好。", rarity: "R", weight: 13 },
  { name: "隐藏留言卡", desc: "现场抽一张密封留言，内容只给中奖的人看。", rarity: "SR", weight: 8 },
  { name: "再来一次", desc: "命运说你可以多转一圈。", rarity: "N", weight: 10 },
  { name: "生日祝福弹幕", desc: "把你的祝福写进当日展示页。", rarity: "R", weight: 12 },
  { name: "小零食补给", desc: "随机糖果或饼干，快乐一点点加满。", rarity: "N", weight: 16 },
  { name: "神秘签名物", desc: "现场从准备好的小物里盲抽一个。", rarity: "SSR", weight: 2 }
];

const STORAGE_KEY = "birthday-sp-gacha-history-v1";
const machine = document.querySelector(".machine");
const drawButton = document.querySelector("#draw-button");
const againButton = document.querySelector("#again-button");
const resetButton = document.querySelector("#reset-button");
const closeDialog = document.querySelector("#close-dialog");
const soundToggle = document.querySelector("#sound-toggle");
const dialog = document.querySelector("#result-dialog");
const prizeList = document.querySelector("#prize-list");
const remainingCount = document.querySelector("#remaining-count");
const drawCount = document.querySelector("#draw-count");
const resultTitle = document.querySelector("#result-title");
const resultDesc = document.querySelector("#result-desc");
const resultRarity = document.querySelector("#result-rarity");
const canvas = document.querySelector("#confetti-canvas");
const ctx = canvas.getContext("2d");

let history = loadHistory();
let confetti = [];
let animationFrame = null;
let audioContext = null;
let soundMuted = localStorage.getItem("birthday-sp-gacha-muted") === "true";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function syncSoundToggle() {
  soundToggle.textContent = soundMuted ? "SFX OFF" : "SFX ON";
  soundToggle.setAttribute("aria-pressed", String(soundMuted));
}

function getAudioContext() {
  if (soundMuted) return null;
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function playTone({ frequency, duration = 0.08, delay = 0, type = "square", volume = 0.05, slideTo }) {
  const audio = getAudioContext();
  if (!audio) return;

  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNoise({ duration = 0.12, delay = 0, volume = 0.035 }) {
  const audio = getAudioContext();
  if (!audio) return;

  const start = audio.currentTime + delay;
  const samples = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, samples, audio.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < samples; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / samples);
  }

  const source = audio.createBufferSource();
  const gain = audio.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(gain);
  gain.connect(audio.destination);
  source.start(start);
}

function playSfx(name) {
  if (name === "press") {
    playTone({ frequency: 220, slideTo: 440, duration: 0.08, volume: 0.045 });
    playTone({ frequency: 660, duration: 0.05, delay: 0.075, volume: 0.035 });
  }

  if (name === "spin") {
    [330, 392, 494, 392, 587, 494].forEach((frequency, index) => {
      playTone({ frequency, duration: 0.055, delay: index * 0.085, volume: 0.032 });
    });
  }

  if (name === "drop") {
    playNoise({ duration: 0.08, volume: 0.025 });
    playTone({ frequency: 176, slideTo: 88, duration: 0.16, delay: 0.02, volume: 0.05 });
  }

  if (name === "win") {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      playTone({ frequency, duration: 0.11, delay: 0.16 + index * 0.09, volume: 0.05 });
    });
    playTone({ frequency: 1567.98, duration: 0.16, delay: 0.54, volume: 0.035 });
  }

  if (name === "reset") {
    playTone({ frequency: 392, slideTo: 196, duration: 0.14, volume: 0.035 });
  }
}

function renderPrizes() {
  const wonNames = new Set(history.map((item) => item.name));
  prizeList.innerHTML = prizes
    .map((prize) => {
      const isWon = wonNames.has(prize.name);
      return `
        <article class="prize-item ${isWon ? "is-won" : ""}">
          <span class="prize-tag">${prize.rarity}${isWon ? " / 已抽到" : ""}</span>
          <h3>${prize.name}</h3>
          <p>${prize.desc}</p>
        </article>
      `;
    })
    .join("");

  remainingCount.textContent = prizes.length;
  drawCount.textContent = history.length;
}

function choosePrize() {
  const total = prizes.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = Math.random() * total;
  for (const prize of prizes) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return prizes[prizes.length - 1];
}

function drawPrize() {
  if (drawButton.disabled) return;

  playSfx("press");
  playSfx("spin");
  drawButton.disabled = true;
  drawButton.querySelector("span:last-child").textContent = "转动中";
  machine.classList.remove("dropping");
  machine.classList.add("spinning");

  window.setTimeout(() => {
    const prize = choosePrize();
    history.unshift({ ...prize, time: new Date().toISOString() });
    saveHistory();
    renderPrizes();
    playSfx("drop");
    showResult(prize);
    machine.classList.remove("spinning");
    machine.classList.add("dropping");
    drawButton.disabled = false;
    drawButton.querySelector("span:last-child").textContent = "开始抽奖";
  }, 1150);
}

function showResult(prize) {
  resultTitle.textContent = prize.name;
  resultDesc.textContent = prize.desc;
  resultRarity.textContent = `${prize.rarity} Prize`;
  if (!dialog.open) dialog.showModal();
  playSfx("win");
  burstConfetti();
}

function resetHistory() {
  playSfx("reset");
  history = [];
  saveHistory();
  renderPrizes();
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function burstConfetti() {
  resizeCanvas();
  const colors = ["#ff4ea3", "#00d8ff", "#b7ff28", "#ffcf33", "#7f52ff", "#ffffff"];
  confetti = Array.from({ length: 110 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: window.innerHeight * 0.38,
    size: 5 + Math.random() * 9,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 10,
    vy: -6 - Math.random() * 9,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.24,
    life: 90 + Math.random() * 28
  }));

  if (animationFrame) cancelAnimationFrame(animationFrame);
  animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  confetti.forEach((piece) => {
    piece.x += piece.vx;
    piece.y += piece.vy;
    piece.vy += 0.28;
    piece.rotation += piece.spin;
    piece.life -= 1;

    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);
    ctx.fillStyle = piece.color;
    ctx.strokeStyle = "#1d1730";
    ctx.lineWidth = 1;
    ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.72);
    ctx.strokeRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.72);
    ctx.restore();
  });

  confetti = confetti.filter((piece) => piece.life > 0 && piece.y < window.innerHeight + 40);
  if (confetti.length) {
    animationFrame = requestAnimationFrame(animateConfetti);
  } else {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    animationFrame = null;
  }
}

drawButton.addEventListener("click", drawPrize);
againButton.addEventListener("click", () => {
  dialog.close();
  drawPrize();
});
closeDialog.addEventListener("click", () => dialog.close());
resetButton.addEventListener("click", resetHistory);
soundToggle.addEventListener("click", () => {
  soundMuted = !soundMuted;
  localStorage.setItem("birthday-sp-gacha-muted", String(soundMuted));
  syncSoundToggle();
  if (!soundMuted) playSfx("press");
});
window.addEventListener("resize", resizeCanvas);

syncSoundToggle();
renderPrizes();
resizeCanvas();
