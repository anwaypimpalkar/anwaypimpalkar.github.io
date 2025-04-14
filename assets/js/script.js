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
    'homemade &nbsp;&nbsp; <i class="fa-solid fa-microchip"></i> ' + date;
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

// 🧭 Load external navbar.html into placeholder and attach event listeners
function loadNavbar() {
  fetch("/navbar.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("navbar-placeholder").innerHTML = data;

      // ✅ Attach event listener for contact button after navbar is loaded
      const contactBtn = document.getElementById("contact-btn");
      const contactOverlay = document.getElementById("contact-overlay");
      const closeBtn = document.getElementById("close-contact");

      if (contactBtn && contactOverlay && closeBtn) {
        contactBtn.addEventListener("click", () => {
          contactOverlay.style.display = "flex";
        });

        closeBtn.addEventListener("click", () => {
          contactOverlay.style.display = "none";
        });

        window.addEventListener("click", (e) => {
          if (e.target === contactOverlay) {
            contactOverlay.style.display = "none";
          }
        });
      } else {
        console.warn("Contact form elements not found");
      }
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
  loadContactForm();
  setupNotYetHover();
});

function isLocal() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function loadContactForm() {
  fetch("/contactform.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("contactform-placeholder").innerHTML = html;

      // Attach open/close logic
      const contactBtns = document.getElementsByClassName("contact-btn");
      const contactOverlay = document.getElementById("contact-overlay");
      const closeBtn = document.getElementById("close-contact");

      if (contactBtns.length && contactOverlay && closeBtn) {
        Array.from(contactBtns).forEach(btn => {
          btn.addEventListener("click", () => {
            contactOverlay.classList.add("active");
          });
        });

        closeBtn.addEventListener("click", () => {
          contactOverlay.classList.remove("active");
        });

        window.addEventListener("click", (e) => {
          if (e.target === contactOverlay) {
            contactOverlay.classList.remove("active");
          }
        });
      }

      // ✅ Attach form submission logic AFTER contact form is loaded
      const form = document.getElementById("contact-form");
      const submitButton = form.querySelector("button[type='submit']");

      if (form && submitButton) {
        form.addEventListener("submit", function (e) {
          e.preventDefault(); // Prevent normal submit

          const formData = new FormData(form);

          fetch("https://formspree.io/f/mblgween", {
            method: "POST",
            headers: {
              Accept: "application/json"
            },
            body: formData
          })
            .then(response => {
              if (response.ok) {
                submitButton.innerHTML = "Sent!";
                submitButton.style.backgroundColor = "#396426";
                submitButton.disabled = true;


              if (window.history.replaceState) {
                const url = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, url);
              }

              setTimeout(() => {
                form.reset();
                document.getElementById("contact-overlay").style.display = "none";
                submitButton.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
                submitButton.style.backgroundColor = "#1e293b";
                submitButton.disabled = false;
              }, 4000);


              } else {
                submitButton.innerHTML = "Error";
                submitButton.style.backgroundColor = "#ef4444";
              }
            })
            .catch(() => {
              submitButton.innerHTML = "Error";
              submitButton.style.backgroundColor = "#ef4444";
            });
        });
      } else {
        console.warn("Form or submit button not found.");
      }
    })
    .catch(err => console.error("Contact form load error:", err));
}
