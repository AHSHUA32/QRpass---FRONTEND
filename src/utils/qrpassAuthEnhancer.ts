const TITLE_TEXTS = [
  "Create Account",
  "Forgot Password",
  "Enter Verification Code"
];

const OTP_LABEL_TEXTS = [
  "6-DIGIT CODE",
  "6 DIGIT CODE"
];

const RESEND_STORAGE_KEY = "qrpass_resend_cooldown_until_v103";
const RESEND_SECONDS = 60;

let countdownInterval: number | null = null;
const resendBound = new WeakSet<HTMLElement>();

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function allTextElements() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,p,span,div,label,a,button"
    )
  );
}

function addClassIfMissing(el: Element | null, className: string) {
  if (!el) return;
  el.classList.add(className);
}

function findExactText(text: string) {
  return allTextElements().find((el) => normalizeText(el.textContent) === text) ?? null;
}

function findContainsText(text: string) {
  return (
    allTextElements().find((el) => {
      const content = normalizeText(el.textContent);
      return content.includes(text);
    }) ?? null
  );
}

function centerAuthTexts() {
  TITLE_TEXTS.forEach((text) => {
    const el = findExactText(text);
    if (el) addClassIfMissing(el, "qrpass-auth-center-title");
  });

  const subtitle1 = findContainsText("A 6-digit code was sent to");
  if (subtitle1) addClassIfMissing(subtitle1, "qrpass-auth-center-subtitle");

  const subtitle2 = findContainsText("Enter your registered email");
  if (subtitle2) addClassIfMissing(subtitle2, "qrpass-auth-center-subtitle");

  OTP_LABEL_TEXTS.forEach((text) => {
    const el = findExactText(text);
    if (el) addClassIfMissing(el, "qrpass-auth-center-otp-label");
  });

  const didntReceive = findContainsText("Didn't receive a code?");
  if (didntReceive) addClassIfMissing(didntReceive, "qrpass-auth-center-inline");

  const changeEmail = findContainsText("Change email");
  if (changeEmail) {
    addClassIfMissing(changeEmail, "qrpass-auth-center-linkline");
  }
}

function getCooldownUntil(): number {
  const raw = localStorage.getItem(RESEND_STORAGE_KEY);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRemainingSeconds(): number {
  const diff = getCooldownUntil() - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function setCooldown(seconds = RESEND_SECONDS) {
  localStorage.setItem(
    RESEND_STORAGE_KEY,
    String(Date.now() + seconds * 1000)
  );
}

function clearCooldown() {
  localStorage.removeItem(RESEND_STORAGE_KEY);
}

function findResendElement(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("button,a,span,div")
  );

  for (const el of candidates) {
    const text = normalizeText(el.textContent);
    if (
      text === "Resend" ||
      /^Resend in \d+:\d{2}$/i.test(text)
    ) {
      return el;
    }
  }

  return null;
}

function updateResendUi() {
  const resendEl = findResendElement();
  if (!resendEl) return;

  const remaining = getRemainingSeconds();

  resendEl.classList.add("qrpass-auth-resend-link");

  if (remaining > 0) {
    resendEl.textContent = `Resend in ${formatSeconds(remaining)}`;
    resendEl.classList.add("qrpass-auth-resend-disabled", "qrpass-auth-resend-timer");
    resendEl.classList.remove("qrpass-auth-resend-active");
    resendEl.setAttribute("aria-disabled", "true");
  } else {
    resendEl.textContent = "Resend";
    resendEl.classList.remove("qrpass-auth-resend-disabled", "qrpass-auth-resend-timer");
    resendEl.classList.add("qrpass-auth-resend-active");
    resendEl.removeAttribute("aria-disabled");
  }
}

function bindResendCountdown() {
  const resendEl = findResendElement();
  if (!resendEl) return;

  if (!resendBound.has(resendEl)) {
    resendEl.addEventListener("click", (event) => {
      const remaining = getRemainingSeconds();

      if (remaining > 0) {
        event.preventDefault();
        event.stopPropagation();
        updateResendUi();
        return;
      }

      // Let the original React click handler run first, then start cooldown
      setTimeout(() => {
        setCooldown(RESEND_SECONDS);
        updateResendUi();
        startInterval();
      }, 0);
    });

    resendBound.add(resendEl);
  }

  updateResendUi();
  startInterval();
}

function startInterval() {
  if (countdownInterval !== null) return;

  countdownInterval = window.setInterval(() => {
    const remaining = getRemainingSeconds();

    if (remaining <= 0) {
      clearCooldown();
      updateResendUi();

      if (countdownInterval !== null) {
        window.clearInterval(countdownInterval);
        countdownInterval = null;
      }

      return;
    }

    updateResendUi();
  }, 1000);
}

function enhanceAuthUi() {
  centerAuthTexts();
  bindResendCountdown();
}

function boot() {
  enhanceAuthUi();

  const observer = new MutationObserver(() => {
    window.clearTimeout((window as any).__qrpassAuthEnhancerDebounce);
    (window as any).__qrpassAuthEnhancerDebounce = window.setTimeout(() => {
      enhanceAuthUi();
    }, 80);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener("storage", (event) => {
    if (event.key === RESEND_STORAGE_KEY) {
      updateResendUi();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}