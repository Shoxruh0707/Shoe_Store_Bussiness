const storeSignupForm = document.querySelector("#storeSignupForm");
const authStatus = document.querySelector("#authStatus");
const telegramUsernameInput = document.querySelector("#telegramUsername");
const telegramStatus = document.querySelector("#telegramStatus");
const storeImageInput = document.querySelector("#storeImage");

const pendingSignupKey = "pendingStoreSignup";
let telegramTimer = null;

function setAuthStatus(message, className = "") {
  authStatus.textContent = message;
  authStatus.className = `status auth-status ${className}`.trim();
  authStatus.hidden = false;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.detail || "So'rov bajarilmadi.");
  return data;
}

function readPendingSignup() {
  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingSignupKey) || "null");
    return pending?.role === "store_owner" ? pending : null;
  } catch (_error) {
    return null;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        data: reader.result
      });
    reader.onerror = () => reject(new Error(`${file.name} faylini o'qib bo'lmadi.`));
    reader.readAsDataURL(file);
  });
}

async function storePayload() {
  return {
    storeName: document.querySelector("#storeName").value,
    storePhoneNumber: document.querySelector("#storePhoneNumber").value,
    description: document.querySelector("#description").value,
    telegramUsername: telegramUsernameInput.value,
    storeImage: await fileToDataUrl(storeImageInput.files?.[0])
  };
}

storeSignupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pendingSignup = readPendingSignup();
  if (!pendingSignup) {
    window.location.replace("/signup");
    return;
  }

  const requiredStoreFields = ["#storeName", "#storePhoneNumber", "#telegramUsername"];
  for (const selector of requiredStoreFields) {
    const field = document.querySelector(selector);
    if (!field.reportValidity()) return;
  }

  setAuthStatus("Saqlanmoqda...");

  try {
    const data = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        ...pendingSignup,
        ...(await storePayload())
      })
    });
    sessionStorage.removeItem(pendingSignupKey);
    window.location.replace(data.redirectTo);
  } catch (error) {
    setAuthStatus(error.message, "error");
  }
});

telegramUsernameInput.addEventListener("input", () => {
  clearTimeout(telegramTimer);
  const username = telegramUsernameInput.value.trim().replace(/^@/, "");

  if (!username) {
    telegramStatus.textContent = "?";
    telegramStatus.className = "";
    return;
  }

  telegramStatus.textContent = "...";
  telegramStatus.className = "";
  telegramTimer = setTimeout(async () => {
    try {
      const data = await api(`/api/telegram/check?username=${encodeURIComponent(username)}`);
      telegramStatus.textContent = data.exists ? "OK" : "X";
      telegramStatus.className = data.exists ? "ok" : "error";
    } catch (_error) {
      telegramStatus.textContent = "X";
      telegramStatus.className = "error";
    }
  }, 450);
});

if (!readPendingSignup()) {
  window.location.replace("/signup");
}
