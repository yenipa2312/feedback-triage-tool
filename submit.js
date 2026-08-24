const input = document.getElementById("feedback-input");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");

submitBtn.addEventListener("click", submitFeedback);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    submitFeedback();
  }
});

async function submitFeedback() {
  const text = input.value.trim();

  if (!text) {
    setStatus("Please write something before submitting.", true);
    return;
  }

  submitBtn.disabled = true;
  setStatus("Sending...");

  try {
    const res = await fetch("/.netlify/functions/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    input.value = "";
    setStatus("Thanks! Your feedback was submitted. Feel free to send more.");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}
