document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("email_toggle");
  const popover = document.getElementById("email_pop");
  if (!toggle || !popover) {
    return;
  }

  const addressEl = popover.querySelector(".email_pop_address");
  const copyBtn = popover.querySelector(".email_pop_copy");

  // Assembled here rather than written into the HTML, so the address never
  // appears in the page source for scrapers to pick up.
  const address = ["apimpalkar", "seas.harvard.edu"].join("@");
  addressEl.textContent = address;

  const setOpen = (open) => {
    popover.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(popover.hidden);
  });

  // clicks inside the popover shouldn't dismiss it
  popover.addEventListener("click", (event) => event.stopPropagation());

  document.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popover.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  let resetTimer;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(address);
      copyBtn.textContent = "copied";
    } catch {
      // clipboard API unavailable or blocked; the address is still selectable
      copyBtn.textContent = "select it";
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copyBtn.textContent = "copy";
    }, 1600);
  });
});
