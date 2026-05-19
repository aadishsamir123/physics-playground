const overlay = document.getElementById("loading-overlay");
const cards = Array.from(document.querySelectorAll(".gallery-card"));

cards.forEach((card) => {
  card.addEventListener("click", () => {
    const target = card.dataset.simTarget;
    if (!target) {
      return;
    }

    overlay.classList.add("visible");
    overlay.setAttribute("aria-hidden", "false");

    window.setTimeout(() => {
      window.location.href = target;
    }, 450);
  });
});
