const prizes = [
  { name: "手写拍立得", desc: "当天现场随机签一张，适合收藏到手机壳背面。", rarity: "SSR", weight: 4 },
  { name: "生日 SP 合照券", desc: "演出后限定一张合照，姿势可以现场指定。", rarity: "SR", weight: 7 },
  { name: "点歌小纸条", desc: "下次练习或直播时，从纸条里选一首唱。", rarity: "SR", weight: 8 },
  { name: "千禧贴纸包", desc: "镭射、星星、像素风混装，抽到就很有仪式感。", rarity: "R", weight: 14 },
  { name: "专属语音晚安", desc: "十秒以内，甜度自行调节。", rarity: "SSR", weight: 3 },
  { name: "应援色发绳", desc: "可以当手环，也可以挂在包上。", rarity: "R", weight: 13 },
  { name: "便利店饮料券", desc: "演出后一起去买，预算学生友好。", rarity: "R", weight: 13 },
  { name: "隐藏留言卡", desc: "现场抽一张密封留言，内容只给中奖的人看。", rarity: "SR", weight: 8 },
  { name: "再来一次", desc: "命运说你可以多转一圈。", rarity: "N", weight: 10 },
  { name: "生日祝福弹幕", desc: "把你的祝福写进当天展示页。", rarity: "R", weight: 12 },
  { name: "小零食补给", desc: "随机糖果或饼干，快乐一点点加满。", rarity: "N", weight: 16 },
  { name: "神秘签名物", desc: "现场从准备好的小物里盲抽一个。", rarity: "SSR", weight: 2 }
];
const STORAGE_KEY = "birthday-sp-gacha-history-v1";
const MAX_DISC_MESSAGE = 18;
const DEFAULT_DISC_MESSAGE = "Rina生日快乐";
const PREVIEW_DURATION = 1620;
const READ_DURATION = 1050;
const SPIN_DURATION = 2400;
const DROP_DURATION = 760;
const DISC_STYLES = ["disc-princess", "disc-melody", "disc-collage", "disc-lime", "disc-aqua", "disc-doodle"];

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
const coinCount = document.querySelector("#coin-count");
const coinPips = document.querySelectorAll(".coin-pips span");
const disc = document.querySelector(".cd-disc:not(.disc-preview)");
const discPreview = document.querySelector("#disc-preview");
const discText = disc.querySelector(".disc-text");
const discPreviewText = discPreview.querySelector(".disc-text");
const discMessageInput = document.querySelector("#disc-message");
const discMessageCount = document.querySelector("#disc-message-count");
const capsulesLayer = document.querySelector(".capsules");
const capsuleEls = [...document.querySelectorAll(".capsule")];
const canvas = document.querySelector("#confetti-canvas");
const ctx = canvas.getContext("2d");

let history = loadHistory();
let confetti = [];
let animationFrame = null;
let physicsFrame = null;
let capsuleStates = [];
let parallaxX = 0;
let parallaxY = 0;
let audioContext = null;
let audioUnlocked = false;
let soundMuted = localStorage.getItem("birthday-sp-gacha-muted") === "true";
let turnLocked = false;

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

function updateSpinMeter() {
  coinCount.textContent = turnLocked ? "LOAD" : "READY";
  coinPips.forEach((pip) => pip.classList.toggle("is-filled", turnLocked));
}

function setDiscStyle(style) {
  disc.classList.remove(...DISC_STYLES);
  discPreview.classList.remove(...DISC_STYLES);
  disc.classList.add(style);
  discPreview.classList.add(style);
}

function randomizeDiscStyle() {
  const style = DISC_STYLES[Math.floor(Math.random() * DISC_STYLES.length)];
  setDiscStyle(style);
}

function getDiscMessage() {
  const value = discMessageInput.value.trim().slice(0, MAX_DISC_MESSAGE);
  return value || DEFAULT_DISC_MESSAGE;
}

function syncDiscMessage() {
  if (discMessageInput.value.length > MAX_DISC_MESSAGE) {
    discMessageInput.value = discMessageInput.value.slice(0, MAX_DISC_MESSAGE);
  }
  const message = getDiscMessage();
  discText.textContent = message;
  discPreviewText.textContent = message;
  discMessageCount.textContent = `${discMessageInput.value.length}/${MAX_DISC_MESSAGE}`;
}

function initializeCapsules(force = false) {
  if (!force && capsuleStates.length === capsuleEls.length) return;

  capsuleStates = capsuleEls.map((element, index) => {
    const size = element.offsetWidth || 54;
    return {
      element,
      baseX: element.offsetLeft,
      baseY: element.offsetTop,
      radius: size / 2,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: index * 17,
      spin: 0,
      depth: ((index % 5) - 2) / 2
    };
  });
  renderCapsules();
}

function renderCapsules() {
  capsuleStates.forEach((state) => {
    const px = state.x + state.depth * parallaxX;
    const py = state.y + state.depth * parallaxY;
    const scale = 1 + state.depth * 0.045;
    state.element.style.setProperty("--px", `${px.toFixed(1)}px`);
    state.element.style.setProperty("--py", `${py.toFixed(1)}px`);
    state.element.style.setProperty("--angle", `${state.angle.toFixed(1)}deg`);
    state.element.style.setProperty("--scale", scale.toFixed(3));
  });
}

function getChamber() {
  const width = capsulesLayer.clientWidth;
  const height = capsulesLayer.clientHeight;
  return {
    cx: width / 2,
    cy: height / 2,
    radius: Math.min(width, height) / 2 - 5
  };
}

function runCapsulePhysics() {
  initializeCapsules();
  if (physicsFrame) cancelAnimationFrame(physicsFrame);

  const chamber = getChamber();
  capsuleStates.forEach((state, index) => {
    const bx = state.baseX + state.radius + state.x;
    const by = state.baseY + state.radius + state.y;
    const dx = bx - chamber.cx;
    const dy = by - chamber.cy;
    const length = Math.hypot(dx, dy) || 1;
    const tangentX = -dy / length;
    const tangentY = dx / length;
    state.vx += tangentX * (4.8 + (index % 6) * 0.28) + (Math.random() - 0.5) * 1.6;
    state.vy += tangentY * (4.2 + (index % 5) * 0.24) - 3.2 - Math.random() * 2.8;
    state.spin += (index % 2 ? -1 : 1) * (1.8 + (index % 7) * 0.12);
  });

  return new Promise((resolve) => {
    let startTime = 0;
    let lastTime = 0;

    const tick = (time) => {
      if (!startTime) {
        startTime = time;
        lastTime = time;
      }

      const elapsed = time - startTime;
      const step = Math.min((time - lastTime) / 16.67, 2);
      const energy = Math.max(0, 1 - elapsed / SPIN_DURATION);
      const orbit = elapsed / SPIN_DURATION;
      parallaxX = Math.sin(orbit * Math.PI * 2.2) * 18 * energy;
      parallaxY = Math.cos(orbit * Math.PI * 1.7) * 10 * energy;
      lastTime = time;

      capsuleStates.forEach((state, index) => {
        const bx = state.baseX + state.radius + state.x;
        const by = state.baseY + state.radius + state.y;
        const dx = bx - chamber.cx;
        const dy = by - chamber.cy;
        const length = Math.hypot(dx, dy) || 1;
        const tangentX = -dy / length;
        const tangentY = dx / length;

        state.vx += tangentX * 0.54 * energy * step;
        state.vy += tangentY * 0.46 * energy * step;
        state.vy += 0.34 * step;
        state.x += state.vx * step;
        state.y += state.vy * step;
        state.angle += state.spin * step;
        state.spin *= 0.965;

        const nextX = state.baseX + state.radius + state.x;
        const nextY = state.baseY + state.radius + state.y;
        const outX = nextX - chamber.cx;
        const outY = nextY - chamber.cy;
        const maxDistance = chamber.radius - state.radius;
        const distance = Math.hypot(outX, outY) || 1;

        if (distance > maxDistance) {
          const nx = outX / distance;
          const ny = outY / distance;
          const projectedX = chamber.cx + nx * maxDistance;
          const projectedY = chamber.cy + ny * maxDistance;
          const normalSpeed = state.vx * nx + state.vy * ny;
          state.x = projectedX - state.radius - state.baseX;
          state.y = projectedY - state.radius - state.baseY;
          if (normalSpeed > 0) {
            state.vx -= nx * normalSpeed * 1.72;
            state.vy -= ny * normalSpeed * 1.72;
          }
          state.vx *= 0.92;
          state.vy *= 0.92;
          state.spin += (state.vx * -ny + state.vy * nx) * 0.09;
        }

        state.vx *= 0.992;
        state.vy *= 0.992;
        if (elapsed > SPIN_DURATION * 0.78) {
          state.vx *= 0.975;
          state.vy *= 0.975;
          state.spin *= 0.96;
        }

        if (index % 3 === 0 && energy > 0.2) {
          state.vx += (Math.random() - 0.5) * 0.04;
          state.vy += (Math.random() - 0.5) * 0.04;
        }
      });

      for (let aIndex = 0; aIndex < capsuleStates.length; aIndex += 1) {
        for (let bIndex = aIndex + 1; bIndex < capsuleStates.length; bIndex += 1) {
          const a = capsuleStates[aIndex];
          const b = capsuleStates[bIndex];
          const ax = a.baseX + a.radius + a.x;
          const ay = a.baseY + a.radius + a.y;
          const bx = b.baseX + b.radius + b.x;
          const by = b.baseY + b.radius + b.y;
          const dx = bx - ax;
          const dy = by - ay;
          const distance = Math.hypot(dx, dy) || 1;
          const minDistance = (a.radius + b.radius) * 0.88;

          if (distance < minDistance) {
            const nx = dx / distance;
            const ny = dy / distance;
            const overlap = minDistance - distance;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            const impact = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (impact < 0) {
              const impulse = impact * -0.62;
              a.vx -= nx * impulse;
              a.vy -= ny * impulse;
              b.vx += nx * impulse;
              b.vy += ny * impulse;
              a.spin -= impulse * 0.18;
              b.spin += impulse * 0.18;
            }
          }
        }
      }

      renderCapsules();

      if (elapsed < SPIN_DURATION) {
        physicsFrame = requestAnimationFrame(tick);
      } else {
        physicsFrame = null;
        parallaxX = 0;
        parallaxY = 0;
        capsuleStates.forEach((state) => {
          state.vx *= 0.1;
          state.vy *= 0.1;
          state.spin *= 0.08;
        });
        renderCapsules();
        resolve();
      }
    };

    physicsFrame = requestAnimationFrame(tick);
  });
}

function syncSoundToggle() {
  soundToggle.textContent = soundMuted ? "SFX OFF" : "SFX ON";
  soundToggle.setAttribute("aria-pressed", String(soundMuted));
}

function getAudioContext() {
  if (soundMuted) return null;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return audioContext;
}

function unlockAudio() {
  const audio = getAudioContext();
  if (!audio) return;
  if (audio.state === "suspended") audio.resume();
  if (audioUnlocked) return;
  audioUnlocked = true;

  const buffer = audio.createBuffer(1, 1, audio.sampleRate);
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  gain.gain.value = 0.0001;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audio.destination);
  source.start(0);
}

function playTone({ frequency, duration = 0.08, delay = 0, type = "square", volume = 0.05, slideTo }) {
  const audio = getAudioContext();
  if (!audio) return;
  if (audio.state === "suspended") audio.resume();

  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
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
  if (audio.state === "suspended") audio.resume();

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

  if (name === "read") {
    [880, 987.77, 1174.66, 987.77].forEach((frequency, index) => {
      playTone({ frequency, duration: 0.045, delay: index * 0.11, type: "sawtooth", volume: 0.022 });
    });
    playNoise({ duration: 0.18, delay: 0.12, volume: 0.012 });
  }

  if (name === "spin") {
    [330, 392, 494, 659].forEach((frequency, index) => {
      playTone({ frequency, duration: 0.055, delay: index * 0.12, volume: 0.032 });
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

function setButtonText(text) {
  drawButton.querySelector("span:last-child").textContent = text;
}

function drawPrize() {
  if (turnLocked) return;

  unlockAudio();
  playSfx("press");
  turnLocked = true;
  updateSpinMeter();
  randomizeDiscStyle();
  syncDiscMessage();
  coinCount.textContent = "LOAD";
  setButtonText("刻录光盘中");
  drawButton.disabled = true;

  machine.classList.remove("previewing", "coining", "reading", "cranking", "spinning", "dropping", "physics-pop");
  discPreview.classList.remove("is-active");
  void machine.offsetWidth;
  machine.classList.add("previewing");
  discPreview.classList.add("is-active");

  window.setTimeout(() => {
    playSfx("read");
    setButtonText("读取光盘中");
    machine.classList.remove("previewing");
    machine.classList.add("coining", "reading");
  }, PREVIEW_DURATION);

  window.setTimeout(() => {
    playSfx("spin");
    coinCount.textContent = "PLAY";
    setButtonText("扭蛋启动中");
    machine.classList.remove("coining");
    machine.classList.add("cranking", "spinning");

    runCapsulePhysics().then(() => {
      playSfx("drop");
      machine.classList.remove("reading", "cranking", "spinning");
      void machine.offsetWidth;
      machine.classList.add("dropping");
      setButtonText("出蛋中");

      window.setTimeout(() => {
        const prize = choosePrize();
        history.unshift({ ...prize, time: new Date().toISOString() });
        saveHistory();
        renderPrizes();
        showResult(prize);
        machine.classList.remove("dropping");
        discPreview.classList.remove("is-active");
        turnLocked = false;
        drawButton.disabled = false;
        updateSpinMeter();
        setButtonText("放入光盘");
      }, DROP_DURATION);
    });
  }, PREVIEW_DURATION + READ_DURATION);
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
  initializeCapsules(true);
}

function burstConfetti() {
  resizeCanvas();
  const colors = ["#ff5ccf", "#54fff1", "#b7ff28", "#fff16a", "#7f52ff", "#ffffff"];
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
discMessageInput.addEventListener("input", syncDiscMessage);
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
  if (!soundMuted) {
    unlockAudio();
    playSfx("press");
  }
});
document.addEventListener("pointerdown", unlockAudio, { passive: true });
document.addEventListener("touchend", unlockAudio, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && audioContext?.state === "suspended") unlockAudio();
});
window.addEventListener("resize", resizeCanvas);

setDiscStyle(DISC_STYLES[0]);
syncDiscMessage();
syncSoundToggle();
updateSpinMeter();
renderPrizes();
resizeCanvas();
