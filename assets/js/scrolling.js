// window.onscroll = function() {scrollFunction()};

// function scrollFunction() {
//   if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 50) {
//     document.getElementById("inner-navbar").style.backgroundColor = "rgba(177,206,232, 0.9)";
//   } else {
//     document.getElementById("inner-navbar").style.backgroundColor = "";
//   }
// }

document.addEventListener("DOMContentLoaded", function () {
  var last_updated = document.getElementById("last_updated");
  var d = new Date(document.lastModified);
  var monthName = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  var date = monthName[d.getMonth()] + " " + d.getFullYear();
  last_updated.innerHTML = "homemade " + date;
});