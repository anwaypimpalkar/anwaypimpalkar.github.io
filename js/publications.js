const activeThemeFilters = new Set();
const FALLBACK_YEAR_HEADER = "Undated";
let allCards = [];

// Chip order, matching the thesis line on the home page. Anything not listed
// here still shows up, sorted, after these.
const THEME_ORDER = [
  "personalization",
  "robots-and-structures",
  "performance",
];

function orderThemes(themeSet) {
  const known = THEME_ORDER.filter((theme) => themeSet.has(theme));
  const extra = Array.from(themeSet)
    .filter((theme) => !THEME_ORDER.includes(theme))
    .sort();
  return [...known, ...extra];
}

function hydratePublications() {
  const root = document.getElementById("publications-root");
  if (!root) {
    return;
  }

  allCards = Array.from(root.querySelectorAll(".publication"));
  allCards.forEach(wireToggleButton);

  initFilters();
  renderPublications();
}

function wireToggleButton(card) {
  const toggleBtn = card.querySelector(".publication_toggle_btn");
  const descriptionEl = card.querySelector(".publication_description");
  if (!toggleBtn || !descriptionEl) {
    return;
  }

  const arrowIcon = toggleBtn.querySelector("i");

  toggleBtn.addEventListener("click", () => {
    const isOpen = descriptionEl.classList.toggle("is-open");
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggleBtn.classList.toggle("is-open", isOpen);
    descriptionEl.style.maxHeight = isOpen
      ? `${descriptionEl.scrollHeight}px`
      : "0px";
    if (arrowIcon) {
      arrowIcon.className = isOpen
        ? "fa-solid fa-chevron-up"
        : "fa-solid fa-chevron-down";
    }
  });
}

function renderPublications({ animate = false } = {}) {
  const root = document.getElementById("publications-root");
  if (!root) {
    return;
  }

  const groups = groupByYear(allCards.filter(matchesActiveFilters));

  root.textContent = "";

  groups.forEach(({ label, items }) => {
    if (!items.length) {
      return;
    }

    const section = document.createElement("section");
    section.className = "publications";

    if (label) {
      const header = document.createElement("h2");
      header.className = "section_header";
      header.textContent = label;
      section.appendChild(header);
    }

    items.forEach((card) => section.appendChild(card));
    root.appendChild(section);
  });

  if (animate) {
    requestAnimationFrame(animatePublications);
  }
}

// Newest year first; within a year, spreadsheet order. Mirrors
// build_projects_html() in scripts/build_static_content.py so the hydrated
// markup matches what was served.
function groupByYear(cards) {
  const sorted = [...cards]
    .map((card) => ({
      card,
      index: Number(card.dataset.index),
      year: card.dataset.year ? Number(card.dataset.year) : null,
    }))
    .sort((a, b) => {
      if (a.year === b.year) {
        return a.index - b.index;
      }
      if (a.year === null) {
        return 1;
      }
      if (b.year === null) {
        return -1;
      }
      return b.year - a.year;
    });

  const groups = [];
  sorted.forEach(({ card }) => {
    const label = card.dataset.year || FALLBACK_YEAR_HEADER;
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) {
      groups.push({ label, items: [card] });
    } else {
      last.items.push(card);
    }
  });

  return groups;
}

function matchesActiveFilters(card) {
  if (!activeThemeFilters.size) {
    return true;
  }

  const themes = (card.dataset.themes || "").split(";").filter(Boolean);
  return Array.from(activeThemeFilters).every((theme) =>
    themes.includes(theme),
  );
}

// Chips read from data-themes, which holds slugs. Turning the slug back into
// words keeps the chip label identical to the badge the build script rendered,
// with no list of theme names to keep in sync here.
function formatTagLabel(slug) {
  return slug.trim().toLowerCase().replace(/-/g, " ");
}

function initFilters() {
  const controls = document.getElementById("publication-controls");
  if (!controls) {
    return;
  }

  controls.textContent = "";

  const themeSet = new Set();
  allCards.forEach((card) => {
    (card.dataset.themes || "")
      .split(";")
      .filter(Boolean)
      .forEach((theme) => {
        themeSet.add(theme);
      });
  });

  const fragment = document.createDocumentFragment();

  if (themeSet.size) {
    fragment.appendChild(createThemeFilterGroup(orderThemes(themeSet)));
  }

  controls.appendChild(fragment);
}

function createThemeFilterGroup(values) {
  const group = document.createElement("div");
  group.className = "filter_group";
  // the visible "Theme" heading is gone, so name the group for screen readers
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Filter by theme");

  const chips = document.createElement("div");
  chips.className = "filter_group_chips";

  values.forEach((value) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `filter_chip filter_chip-theme-${value}`;
    chip.dataset.filterValue = value;
    chip.textContent = formatTagLabel(value);
    chip.classList.toggle("is-active", activeThemeFilters.has(value));

    chip.addEventListener("click", () => {
      toggleFilter(value, chip);
    });

    chips.appendChild(chip);
  });

  group.appendChild(chips);
  return group;
}

function toggleFilter(value, chip) {
  if (activeThemeFilters.has(value)) {
    activeThemeFilters.delete(value);
    chip.classList.remove("is-active");
  } else {
    activeThemeFilters.add(value);
    chip.classList.add("is-active");
  }

  renderPublications({ animate: true });
}

function animatePublications() {
  const cards = document.querySelectorAll("#publications-root .publication");
  cards.forEach((card, index) => {
    card.classList.add("publication-appear");
    card.style.transitionDelay = `${index * 40}ms`;

    requestAnimationFrame(() => {
      card.classList.add("publication-appear--visible");
    });

    const handleTransitionEnd = (event) => {
      if (event.propertyName !== "opacity") {
        return;
      }
      card.classList.remove("publication-appear--visible");
      card.classList.remove("publication-appear");
      card.style.transitionDelay = "";
      card.removeEventListener("transitionend", handleTransitionEnd);
    };

    card.addEventListener("transitionend", handleTransitionEnd);
  });
}

document.addEventListener("DOMContentLoaded", hydratePublications);
