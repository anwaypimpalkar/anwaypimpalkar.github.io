// Inline brand icons carry a text label that is normally for screen readers
// only. If the icon font never renders -- the Font Awesome kit is blocked,
// offline, or still failing -- the label is revealed so the link still reads.
document.addEventListener("DOMContentLoaded", () => {
  // looked up on every check, so icon links added by other scripts after
  // load (the back-to-top button) are covered too
  const sync = () => {
    document.querySelectorAll(".icon_link").forEach((link) => {
      const icon = link.querySelector("i");
      if (!icon) {
        return;
      }
      const { width, height } = icon.getBoundingClientRect();
      const drawn = width > 4 && height > 4;
      // toggle, not add: a slow kit that arrives late re-hides the label
      link.classList.toggle("icon_link--no-icon", !drawn);
    });
  };

  // The kit loads asynchronously, so give it a chance before deciding, then
  // re-check in case it was simply slow.
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => setTimeout(sync, 300));
  [1500, 4000].forEach((delay) => setTimeout(sync, delay));
});
