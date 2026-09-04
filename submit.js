const form = document.getElementById("feedback-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const streakBadgeEl = document.getElementById("streak-badge");

const MILESTONES = {
  1: "🌱 First voice! Thanks for speaking up.",
  3: "🔥 3 and counting — you're on a roll!",
  5: "⭐ 5 pieces of feedback! You're basically a legend.",
  10: "🏆 Double digits! You're shaping how this place runs.",
  25: "🚀 25 submissions. Certified Feedback Champion.",
  50: "👑 50+! Are you even human, or just pure feedback energy?",
};

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
  hideStreakBadge();

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
    showStreakBadge(bumpLocalStreak());
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

// Purely local to this browser - never sent anywhere, never tied to a name.
// Keeps the "send more feedback" nudge fun without undermining anonymity.
function bumpLocalStreak() {
  try {
    const count = Number(localStorage.getItem("feedbackCount") || "0") + 1;
    localStorage.setItem("feedbackCount", String(count));
    return count;
  } catch {
    return null;
  }
}

function showStreakBadge(count) {
  if (!count) return;
  streakBadgeEl.textContent = MILESTONES[count] || `That's feedback #${count} from you. Every one helps.`;
  streakBadgeEl.hidden = false;
}

function hideStreakBadge() {
  streakBadgeEl.hidden = true;
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", kind === "error");
  statusEl.classList.toggle("success", kind === "success");
}
