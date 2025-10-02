const setLastUpdated = () => {
  const display = document.getElementById("last-updated");
  if (!display) return;

  const lastModified = new Date(document.lastModified);
  if (Number.isNaN(lastModified.getTime())) return;

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  });

  const formatted = formatter.format(lastModified);
  const [month, year] = formatted.split(" ");
  display.textContent = `${month.toLowerCase()} ${year}`;
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setLastUpdated, {
    once: true,
  });
} else {
  setLastUpdated();
}

document.addEventListener("footer-loaded", setLastUpdated, { once: true });
