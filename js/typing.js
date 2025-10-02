document.addEventListener("DOMContentLoaded", () => {
  setLastUpdated();

  const target = document.getElementById("typing-text");
  if (!target) return;

  const words = ["neural interfaces.", "clinical AI tools.", "medical robots."];
  let wordIndex = 0;
  let charIndex = 0;
  let deleting = false;

  const type = () => {
    const current = words[wordIndex];

    if (!deleting) {
      charIndex += 1;
      target.textContent = current.slice(0, charIndex);

      if (charIndex === current.length) {
        deleting = true;
        setTimeout(type, 1400);
        return;
      }
    } else {
      charIndex -= 1;
      target.textContent = current.slice(0, charIndex);

      if (charIndex === 0) {
        deleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        setTimeout(type, 600);
        return;
      }
    }

    const delay = deleting ? 40 : 90;
    setTimeout(type, delay);
  };

  target.textContent = "";
  setTimeout(type, 300);
});
