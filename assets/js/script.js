document.addEventListener("DOMContentLoaded", function () {
  var last_updated = document.getElementById("last_updated");
  var d = new Date(document.lastModified);
  var monthName = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  var date = monthName[d.getMonth()] + " " + d.getFullYear();
  last_updated.innerHTML = "homemade &nbsp;&nbsp; <i class=\"fa-solid fa-pencil\"></i> " + date;
});

function openInNewTab(obj) {
  var goToLink = obj.getAttribute("href");
  window.open(goToLink);
}

function goToPage(obj) {
  var goToLink = obj.getAttribute("href");
  window.location = goToLink;
}

document.addEventListener("DOMContentLoaded", () => {
  const notyets = document.getElementsByClassName("notyet");

  for (let i = 0; i < notyets.length; i++) {
      let notyet = notyets[i];

      notyet.addEventListener("mouseover", () => {
          notyet.classList.add("no-cursor");
      });

      notyet.addEventListener("mouseout", () => {
          notyet.classList.remove("no-cursor");
      });
  }
});