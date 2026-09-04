const form = document.getElementById("feedback-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = form.name.value.trim();
  const tenure = form.tenure.value;
  const painPoint = form.painPoint.value.trim();
  const wish = form.wish.value.trim();
  const moodChecked = form.querySelector('input[name="mood"]:checked');
  const mood = moodChecked ? Number(moodChecked.value) : null;

  if (!tenure || !painPoint || !wish) {
    setStatus("Please fill in all three questions before sending.", "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("Sending...");

  try {
    const res = await fetch("/.netlify/functions/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tenure, painPoint, wish, mood }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    form.reset();
    setStatus("Thanks — your feedback was sent. Feel free to send more anytime.", "success");
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", kind === "error");
  statusEl.classList.toggle("success", kind === "success");
}
