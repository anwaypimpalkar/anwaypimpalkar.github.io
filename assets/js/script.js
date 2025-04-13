// ⏱️ Insert last modified date after footer is loaded
function updateLastUpdated() {
  const last_updated = document.getElementById("last_updated");
  if (!last_updated) return;

  const d = new Date(document.lastModified);
  const monthName = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  const date = monthName[d.getMonth()] + " " + d.getFullYear();
  last_updated.innerHTML =
    'homemade &nbsp;&nbsp; <i class="fa-solid fa-pencil"></i> ' + date;
}

// 📄 Load external footer.html into placeholder
function loadFooter() {
  fetch("/footer.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("footer-placeholder").innerHTML = data;
      updateLastUpdated(); // Update after footer is loaded
    })
    .catch(error => console.error("Footer load error:", error));
}

// 🧭 Load external navbar.html into placeholder
function loadNavbar() {
  fetch("/navbar.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("navbar-placeholder").innerHTML = data;
    })
    .catch(error => console.error("Navbar load error:", error));
}

// 🌐 Open external link in new tab
function openInNewTab(obj) {
  const goToLink = obj.getAttribute("href");
  window.open(goToLink, "_blank");
}

// 🔄 Go to internal page
function goToPage(obj) {
  const goToLink = obj.getAttribute("href");
  window.location = goToLink;
}

// 🚫 Add 'no-cursor' to inactive elements on hover
function setupNotYetHover() {
  const notyets = document.getElementsByClassName("notyet");

  for (let i = 0; i < notyets.length; i++) {
    const notyet = notyets[i];

    notyet.addEventListener("mouseover", () => {
      notyet.classList.add("no-cursor");
    });

    notyet.addEventListener("mouseout", () => {
      notyet.classList.remove("no-cursor");
    });
  }
}

// 🚀 Initialize all on DOM load
document.addEventListener("DOMContentLoaded", () => {
  loadNavbar();
  loadFooter();
  setupNotYetHover();
});
