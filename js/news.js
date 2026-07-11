let allYearGroups = [];
let includeUnfiltered = false;
let includeFailures = false;

document.addEventListener("DOMContentLoaded", () => {
  hydrateNews();
});

function hydrateNews() {
  const container = document.getElementById("news-rows");
  if (!container) {
    return;
  }

  allYearGroups = Array.from(container.querySelectorAll(".news_year_group"));
  initNewsFilters();
  applyNewsFilters();
}

function initNewsFilters() {
  const controls = document.getElementById("news-controls");
  if (!controls) {
    return;
  }

  // Temporarily hide filters on the news page.
  controls.hidden = true;
  controls.textContent = "";
  return;

  const fragment = document.createDocumentFragment();

  fragment.appendChild(
    createFilterButton(
      " professionalism filter",
      "unfiltered",
      "iconoir-xmark",
    ),
  );
  fragment.appendChild(createFilterButton(" failures", "fail", "iconoir-plus"));

  controls.appendChild(fragment);
}

function createFilterButton(label, filterKey, iconClass) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "news_filter_btn";

  if (iconClass) {
    const icon = document.createElement("i");
    icon.className = iconClass;
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);
  }

  const textSpan = document.createElement("span");
  textSpan.textContent = label;
  button.appendChild(textSpan);

  button.addEventListener("click", () => {
    toggleFilterState(filterKey);
    button.classList.toggle("is-active", isFilterActive(filterKey));
    updateNewsHeading();
    applyNewsFilters();
  });

  return button;
}

function toggleFilterState(key) {
  if (key === "unfiltered") {
    includeUnfiltered = !includeUnfiltered;
  } else if (key === "fail") {
    includeFailures = !includeFailures;
  }
}

function isFilterActive(key) {
  if (key === "unfiltered") {
    return includeUnfiltered;
  }
  if (key === "fail") {
    return includeFailures;
  }
  return false;
}

function applyNewsFilters() {
  const allowedTags = new Set();
  if (includeUnfiltered) {
    allowedTags.add("unfiltered");
  }
  if (includeFailures) {
    allowedTags.add("fail");
  }

  allYearGroups.forEach((group) => {
    const entries = Array.from(group.querySelectorAll(".news_entry"));
    let anyVisible = false;

    entries.forEach((entry) => {
      const tags = (entry.dataset.tags || "").split(";").filter(Boolean);
      const visible =
        !tags.length ||
        (allowedTags.size > 0 && tags.some((tag) => allowedTags.has(tag)));
      entry.hidden = !visible;
      if (visible) {
        anyVisible = true;
      }
    });

    group.hidden = !anyVisible;
  });
}

function updateNewsHeading() {
  const heading = document.getElementById("news-heading");
  if (!heading) {
    return;
  }

  const fragments = [];

  if (includeFailures) {
    fragments.push(createHeadingTag("real", "news_heading-tag"));
  }

  if (includeUnfiltered) {
    fragments.push(createHeadingTag("life", "news_heading-tag"));
  }

  fragments.push(document.createTextNode("News"));

  heading.textContent = "";
  fragments.forEach((fragment, index) => {
    if (index > 0) {
      heading.appendChild(document.createTextNode(" "));
    }
    heading.appendChild(fragment);
  });
  heading.classList.add("news_heading-flash");

  heading.addEventListener(
    "animationend",
    () => heading.classList.remove("news_heading-flash"),
    { once: true },
  );
}

function createHeadingTag(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}
