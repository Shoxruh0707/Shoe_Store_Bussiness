const signinForm = document.querySelector("#signinForm");
const authStatus = document.querySelector("#authStatus");

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

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthStatus("Tekshirilmoqda...");

  try {
    const data = await api("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: document.querySelector("#signinPhone").value,
        password: document.querySelector("#signinPassword").value
      })
    });
    window.location.replace(data.redirectTo);
  } catch (error) {
    setAuthStatus(error.message, "error");
  }
});
