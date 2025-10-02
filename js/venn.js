document.addEventListener("DOMContentLoaded", () => {
  const circles = document.querySelectorAll(".venn-diagram .circle");
  const titleEl = document.getElementById("venn-description-title");
  const bodyEl = document.getElementById("venn-description-body");
  const container = document.getElementById("venn-description");

  if (!circles.length || !titleEl || !bodyEl || !container) {
    return;
  }

  const defaultState = {
    title: titleEl.textContent,
    body: bodyEl.textContent,
  };

  const clearHighlight = () => {
    container.classList.remove(
      "highlight-left",
      "highlight-right",
      "highlight-bottom"
    );
  };

  const showDescription = (circle) => {
    const title = circle.getAttribute("data-title");
    const body = circle.getAttribute("data-description");
    const tone = circle.getAttribute("data-highlight");
    if (title) {
      titleEl.textContent = title;
    }
    if (body) {
      bodyEl.textContent = body;
    }
    clearHighlight();
    if (tone) {
      container.classList.add(`highlight-${tone}`);
    }
  };

  const resetDescription = () => {
    titleEl.textContent = defaultState.title;
    bodyEl.textContent = defaultState.body;
    clearHighlight();
  };

  circles.forEach((circle) => {
    circle.addEventListener("mouseenter", () => showDescription(circle));
    circle.addEventListener("focus", () => showDescription(circle));
    circle.addEventListener("mouseleave", resetDescription);
    circle.addEventListener("blur", resetDescription);
  });
});
