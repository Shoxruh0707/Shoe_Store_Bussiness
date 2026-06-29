const signupForm = document.querySelector("#signupForm");
const authStatus = document.querySelector("#authStatus");
const roleSelect = document.querySelector("#role");

const pendingSignupKey = "pendingStoreSignup";

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

function accountPayload() {
  return {
    fname: document.querySelector("#fname").value,
    lname: document.querySelector("#lname").value,
    phoneNumber: document.querySelector("#signupPhone").value,
    password: document.querySelector("#password").value,
    passwordConfirm: document.querySelector("#passwordConfirm").value,
    role: roleSelect.value
  };
}

function validateAccount() {
  const required = ["#fname", "#lname", "#signupPhone", "#password", "#passwordConfirm", "#role"];
  for (const selector of required) {
    const field = document.querySelector(selector);
    if (!field.reportValidity()) return false;
  }

  if (document.querySelector("#password").value !== document.querySelector("#passwordConfirm").value) {
    setAuthStatus("Parollar bir xil bo'lishi kerak.", "error");
    return false;
  }

  return true;
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateAccount()) return;

  const payload = accountPayload();
  if (payload.role === "store_owner") {
    sessionStorage.setItem(pendingSignupKey, JSON.stringify(payload));
    window.location.replace("/signup/store");
    return;
  }

  setAuthStatus("Saqlanmoqda...");

  try {
    const data = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    sessionStorage.removeItem(pendingSignupKey);
    window.location.replace(data.redirectTo);
  } catch (error) {
    setAuthStatus(error.message, "error");
  }
});
