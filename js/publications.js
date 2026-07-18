const activeThemeFilters = new Set();
let isChronologicalView = false;
const FALLBACK_YEAR_HEADER = "Undated";
let allCards = [];

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
        ? "iconoir-nav-arrow-up"
        : "iconoir-nav-arrow-down";
    }
  });
}

function renderPublications({ animate = false } = {}) {
  const root = document.getElementById("publications-root");
  if (!root) {
    return;
  }

  const visibleCards = allCards.filter(matchesActiveFilters);
  const groups = isChronologicalView
    ? groupByYear(visibleCards)
    : groupBySection(visibleCards);

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

function groupBySection(cards) {
  const bySection = new Map();
  const sorted = [...cards].sort(
    (a, b) => Number(a.dataset.index) - Number(b.dataset.index),
  );

  sorted.forEach((card) => {
    const label = card.dataset.section || "Publications";
    if (!bySection.has(label)) {
      bySection.set(label, []);
    }
    bySection.get(label).push(card);
  });

  return Array.from(bySection.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}

function groupByYear(cards) {
  const enriched = cards
    .map((card) => ({
      card,
      index: Number(card.dataset.index),
      yearLabel: card.dataset.year || FALLBACK_YEAR_HEADER,
      yearNumber: card.dataset.year ? Number(card.dataset.year) : null,
    }))
    .sort((a, b) => {
      if (a.yearNumber === b.yearNumber) {
        return a.index - b.index;
      }
      if (a.yearNumber === null) {
        return 1;
      }
      if (b.yearNumber === null) {
        return -1;
      }
      return b.yearNumber - a.yearNumber;
    });

  const groups = [];
  enriched.forEach(({ card, yearLabel }) => {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || lastGroup.label !== yearLabel) {
      groups.push({ label: yearLabel, items: [card] });
    } else {
      lastGroup.items.push(card);
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

function formatTagLabel(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ai") {
    return "AI";
  }
  if (normalized === "hci") {
    return "Sensory Perception";
  }
  return value
    .split(/[-_\s]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    fragment.appendChild(createThemeFilterGroup(Array.from(themeSet).sort()));
  }

  fragment.appendChild(createViewToggleGroup());

  controls.appendChild(fragment);
}

function createThemeFilterGroup(values) {
  const group = document.createElement("div");
  group.className = "filter_group";

  const heading = document.createElement("span");
  heading.className = "filter_group_label";
  heading.textContent = "Theme";
  group.appendChild(heading);

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

function createViewToggleGroup() {
  const group = document.createElement("div");
  group.className = "filter_group";

  const heading = document.createElement("span");
  heading.className = "filter_group_label";
  heading.textContent = "View by";
  group.appendChild(heading);

  const toggle = document.createElement("div");
  toggle.className = "view_toggle";
  toggle.setAttribute("role", "group");
  toggle.setAttribute("aria-label", "View by");

  const venuesBtn = document.createElement("button");
  venuesBtn.type = "button";
  venuesBtn.className = "view_toggle_btn";
  venuesBtn.textContent = "Venues";

  const chronoBtn = document.createElement("button");
  chronoBtn.type = "button";
  chronoBtn.className = "view_toggle_btn";
  chronoBtn.textContent = "Chronological";

  const syncViewButtons = () => {
    venuesBtn.classList.toggle("is-active", !isChronologicalView);
    venuesBtn.setAttribute("aria-pressed", (!isChronologicalView).toString());
    chronoBtn.classList.toggle("is-active", isChronologicalView);
    chronoBtn.setAttribute("aria-pressed", isChronologicalView.toString());
  };
  syncViewButtons();

  venuesBtn.addEventListener("click", () => {
    if (!isChronologicalView) {
      return;
    }
    isChronologicalView = false;
    syncViewButtons();
    renderPublications({ animate: true });
  });

  chronoBtn.addEventListener("click", () => {
    if (isChronologicalView) {
      return;
    }
    isChronologicalView = true;
    syncViewButtons();
    renderPublications({ animate: true });
  });

  toggle.appendChild(venuesBtn);
  toggle.appendChild(chronoBtn);
  group.appendChild(toggle);
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
