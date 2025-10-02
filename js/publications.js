let publicationsData = [];
const activeTypeFilters = new Set();
const activeThemeFilters = new Set();

async function loadPublications() {
  try {
    const records = await loadProjectsData();
    publicationsData = records;
    initFilters(publicationsData);
    renderPublications(applyFilters());
  } catch (error) {
    console.error("Unable to load publications.", error);
  }
}

async function loadProjectsData() {
  const loader = window.DataLoader;

  if (loader) {
    const workbookRecords = await loader.readWorkbook("/data/projects.xlsx");
    if (workbookRecords.length) {
      return loader.normalizeRecords(workbookRecords);
    }

    const csvText = await loader.readCsv("/data/projects.csv");
    if (csvText) {
      const csvRecords = parseCSV(csvText);
      return loader.normalizeRecords(csvRecords);
    }

    return [];
  }

  const csvText = await readCsvFallback("/data/projects.csv");
  return csvText ? normalizeRecords(parseCSV(csvText)) : [];
}

function parseCSV(text) {
  const rows = [];
  let currentField = "";
  let currentRow = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"') {
        const nextChar = text[i + 1];
        if (nextChar === '"') {
          currentField += '"';
          i += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (char === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else if (char !== "\r") {
      currentField += char;
    }
  }

  if (currentField || currentRow.length) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => (cell || "").trim() !== ""))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = (row[index] || "").trim();
      });
      return record;
    });
}

function normalizeRecords(records) {
  if (window.DataLoader) {
    return window.DataLoader.normalizeRecords(records);
  }

  return (records || []).map((record) => {
    const normalized = {};
    Object.keys(record || {}).forEach((key) => {
      const trimmedKey = key ? key.trim() : "";
      if (!trimmedKey) {
        return;
      }
      const value = record[key];
      if (value === undefined || value === null) {
        normalized[trimmedKey] = "";
      } else if (typeof value === "string") {
        normalized[trimmedKey] = value.trim();
      } else {
        normalized[trimmedKey] = String(value);
      }
    });
    return normalized;
  });
}

async function readCsvFallback(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.warn(error);
    return "";
  }
}

function renderPublications(publications = publicationsData) {
  const root = document.getElementById("publications-root");
  if (!root) {
    return;
  }

  root.textContent = "";

  const sections = new Map();
  publications.forEach((publication) => {
    const sectionName = publication.section || "Publications";
    if (!sections.has(sectionName)) {
      sections.set(sectionName, []);
    }
    sections.get(sectionName).push(publication);
  });

  sections.forEach((items, sectionName) => {
    const section = document.createElement("section");
    section.className = "publications";

    const header = document.createElement("h2");
    header.className = "section_header";
    header.textContent = sectionName;
    section.appendChild(header);

    items.forEach((publication) => {
      section.appendChild(buildPublicationCard(publication));
    });

    root.appendChild(section);
  });

  requestAnimationFrame(() => {
    animatePublications();
  });
}

function buildPublicationCard(publication) {
  const card = document.createElement("div");
  card.className = "publication";

  const links = parseLinks(publication.links);
  const descriptionText = publication.description;
  const themes = parseThemes(publication.themes);

  if (publication.image) {
    const media = document.createElement("div");
    media.className = "publication_media";

    const assetPath = publication.image;
    if (isVideoAsset(assetPath)) {
      const video = document.createElement("video");
      video.src = assetPath;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.preload = "metadata";
      video.playsInline = true;
      video.setAttribute(
        "aria-label",
        publication.image_alt || publication.title || "Publication video"
      );
      media.appendChild(video);
    } else {
      const image = document.createElement("img");
      image.src = assetPath;
      image.alt =
        publication.image_alt || publication.title || "Publication graphic";
      image.loading = "lazy";
      media.appendChild(image);
    }

    card.appendChild(media);
  }

  const details = document.createElement("div");
  details.className = "publication_details";

  const title = document.createElement("h3");
  title.className = "publication_title";
  title.textContent = publication.title;
  details.appendChild(title);

  const authors = parseAuthors(publication.authors);
  if (authors.length) {
    const authorsEl = document.createElement("p");
    authorsEl.className = "publication_authors";

    authors.forEach((author, index) => {
      const authorSpan = document.createElement("span");
      if (author.toLowerCase() === "anway pimpalkar") {
        authorSpan.classList.add("underline");
      }
      authorSpan.textContent = author;
      authorsEl.appendChild(authorSpan);

      if (index < authors.length - 1) {
        authorsEl.appendChild(document.createTextNode(", "));
      }
    });

    details.appendChild(authorsEl);
  }

  if (publication.journal || publication.year) {
    const journalEl = document.createElement("p");
    journalEl.className = "publication_journal";

    if (publication.journal) {
      const journalName = document.createElement("em");
      journalName.textContent = publication.journal;
      journalEl.appendChild(journalName);
    }

    if (publication.year) {
      const separator = publication.journal ? ", " : "";
      journalEl.appendChild(
        document.createTextNode(`${separator}${publication.year}`)
      );
    }

    if (links.length) {
      links.forEach(({ label, url }) => {
        const divider = document.createElement("span");
        divider.className = "publication_meta_separator";
        divider.textContent = " ∙ ";
        journalEl.appendChild(divider);

        const anchor = document.createElement("a");
        anchor.className = "publication_meta_link link harvard";
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener";
        anchor.appendChild(document.createTextNode(label || url));

        const icon = document.createElement("i");
        icon.className = "iconoir-arrow-up-right";
        anchor.appendChild(icon);

        journalEl.appendChild(anchor);
      });
    }

    details.appendChild(journalEl);
  }

  const awards = (publication.awards || "")
    .split(";")
    .map((award) => award.trim())
    .filter(Boolean);

  if (awards.length) {
    const awardsContainer = document.createElement("div");
    awardsContainer.className = "publication_awards";

    awards.forEach((award) => {
      const badge = document.createElement("span");
      badge.className = "publication_award_badge";
      badge.textContent = award;
      awardsContainer.appendChild(badge);
    });

    details.appendChild(awardsContainer);
  }

  const toggleRow = document.createElement("div");
  toggleRow.className = "publication_toggle_row";

  let descriptionEl = null;
  let toggleBtn = null;

  if (descriptionText) {
    toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "publication_toggle_btn";
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.title = "Show more details";

    const toggleLabel = document.createElement("span");
    toggleLabel.className = "publication_toggle_text";
    toggleLabel.textContent = "Summary";
    toggleBtn.appendChild(toggleLabel);

    const arrowIcon = document.createElement("i");
    arrowIcon.className = "iconoir-nav-arrow-down";
    arrowIcon.setAttribute("aria-hidden", "true");
    toggleBtn.appendChild(arrowIcon);

    toggleBtn.addEventListener("click", () => {
      if (!descriptionEl) {
        return;
      }
      const isOpen = descriptionEl.classList.toggle("is-open");
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggleBtn.classList.toggle("is-open", isOpen);
      descriptionEl.style.maxHeight = isOpen
        ? `${descriptionEl.scrollHeight}px`
        : "0px";
      arrowIcon.className = isOpen
        ? "iconoir-nav-arrow-up"
        : "iconoir-nav-arrow-down";
    });

    toggleRow.appendChild(toggleBtn);

    descriptionEl = document.createElement("div");
    descriptionEl.className = "publication_description";
    descriptionEl.style.maxHeight = "0px";

    const descriptionBody = document.createElement("p");
    descriptionBody.innerHTML = descriptionText;
    descriptionEl.appendChild(descriptionBody);
  }

  const tagsContainer = document.createElement("div");
  tagsContainer.className = "publication_tags";

  if (publication.type) {
    const typeBadge = createTagBadge("type", publication.type);
    if (typeBadge) {
      tagsContainer.appendChild(typeBadge);
    }
  }

  themes.forEach((theme) => {
    tagsContainer.appendChild(createTagBadge("theme", theme));
  });

  if (tagsContainer.childNodes.length) {
    toggleRow.appendChild(tagsContainer);
  }

  if (toggleRow.childNodes.length) {
    details.appendChild(toggleRow);
  }

  if (descriptionEl) {
    details.appendChild(descriptionEl);
  }

  card.appendChild(details);
  return card;
}

function parseAuthors(authors) {
  if (!authors) {
    return [];
  }

  return authors
    .split(";")
    .map((author) => author.trim())
    .filter(Boolean);
}

function parseLinks(links) {
  if (!links) {
    return [];
  }

  return links
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label = "", url = ""] = entry.split("|");
      return {
        label: label.trim(),
        url: url.trim(),
      };
    })
    .filter(({ url }) => url.length);
}

function parseThemes(themes) {
  if (!themes) {
    return [];
  }

  return themes
    .split(";")
    .map((theme) => theme.trim())
    .filter(Boolean);
}

function createTagBadge(kind, value) {
  if (kind === "type") {
    return null;
  }

  const badge = document.createElement("span");
  badge.className = `publication_tag publication_tag-${kind}`;

  if (kind === "theme") {
    badge.classList.add(`publication_tag-theme-${value.toLowerCase()}`);
  }

  badge.textContent = formatTagLabel(value);
  return badge;
}

function formatTagLabel(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ai") {
    return "AI";
  }

  return value
    .split(/[-_\s]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function initFilters(publications) {
  const controls = document.getElementById("publication-controls");
  if (!controls) {
    return;
  }

  controls.textContent = "";

  const typeSet = new Set();
  const themeSet = new Set();

  publications.forEach((publication) => {
    if (publication.type) {
      typeSet.add(publication.type.toLowerCase());
    }
    parseThemes(publication.themes).forEach((theme) => {
      themeSet.add(theme.toLowerCase());
    });
  });

  if (!typeSet.size && !themeSet.size) {
    return;
  }

  const fragment = document.createDocumentFragment();

  if (themeSet.size) {
    fragment.appendChild(
      createFilterGroup("What", Array.from(themeSet).sort(), "theme")
    );
  }

  if (typeSet.size) {
    fragment.appendChild(
      createFilterGroup("Where", Array.from(typeSet).sort(), "type")
    );
  }

  controls.appendChild(fragment);
}

function createFilterGroup(label, values, kind) {
  const group = document.createElement("div");
  group.className = "filter_group";

  const heading = document.createElement("span");
  heading.className = "filter_group_label";
  heading.textContent = label;
  group.appendChild(heading);

  const chips = document.createElement("div");
  chips.className = "filter_group_chips";

  values.forEach((value) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter_chip";
    chip.dataset.filterKind = kind;
    chip.dataset.filterValue = value;
    chip.textContent = formatTagLabel(value);

    if (kind === "theme") {
      chip.classList.add(`filter_chip-theme-${value.toLowerCase()}`);
    }

    if (
      (kind === "type" && activeTypeFilters.has(value)) ||
      (kind === "theme" && activeThemeFilters.has(value))
    ) {
      chip.classList.add("is-active");
    }

    chip.addEventListener("click", () => {
      toggleFilter(kind, value, chip);
    });

    chips.appendChild(chip);
  });

  group.appendChild(chips);
  return group;
}

function toggleFilter(kind, value, chip) {
  const targetSet = kind === "type" ? activeTypeFilters : activeThemeFilters;

  if (targetSet.has(value)) {
    targetSet.delete(value);
    chip.classList.remove("is-active");
  } else {
    targetSet.add(value);
    chip.classList.add("is-active");
  }

  renderPublications(applyFilters());
}

function applyFilters() {
  if (!activeTypeFilters.size && !activeThemeFilters.size) {
    return publicationsData;
  }

  return publicationsData.filter((publication) => {
    const type = (publication.type || "").toLowerCase();
    const themes = parseThemes(publication.themes).map((theme) =>
      theme.toLowerCase()
    );

    const typeMatch = !activeTypeFilters.size || activeTypeFilters.has(type);

    const themeMatch =
      !activeThemeFilters.size ||
      Array.from(activeThemeFilters).every((theme) => themes.includes(theme));

    return typeMatch && themeMatch;
  });
}

function isVideoAsset(path) {
  if (!path) {
    return false;
  }

  const extension = path.split("?")[0].split(".").pop();
  return typeof extension === "string" && extension.toLowerCase() === "mp4";
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

document.addEventListener("DOMContentLoaded", loadPublications);
