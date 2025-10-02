let newsEntries = [];
let includeUnfiltered = false;
let includeFailures = false;

document.addEventListener("DOMContentLoaded", () => {
  loadNews();
});

async function loadNews() {
  const rowsContainer = document.getElementById("news-rows");
  if (!rowsContainer) {
    return;
  }

  try {
    const records = await loadNewsData();
    newsEntries = records;
    initNewsFilters();
    renderNews(rowsContainer, applyNewsFilters());
  } catch (error) {
    console.error("Unable to load news feed.", error);
  }
}

function parseNewsCSV(text) {
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
      record._tags = parseTags(record.tags);
      return record;
    });
}

function renderNews(container, entries) {
  container.textContent = "";

  const fragment = document.createDocumentFragment();

  const groups = groupEntriesByYear(entries);

  groups.forEach(({ year, items }) => {
    const group = document.createElement("div");
    group.className = "news_year_group";

    const yearCell = document.createElement("div");
    yearCell.className = "news_year";
    yearCell.textContent = year;
    group.appendChild(yearCell);

    const entriesCol = document.createElement("div");
    entriesCol.className = "news_year_entries";

    items.forEach((entry, index) => {
      const entryRow = document.createElement("div");
      entryRow.className = "news_entry";
      entryRow.style.setProperty("--news-index", index);

      const monthCell = document.createElement("div");
      monthCell.className = "news_month";
      monthCell.textContent = entry.month;

      const bodyCell = document.createElement("div");
      bodyCell.className = "news_body";

      const entryHeading = document.createElement("div");
      entryHeading.className = "news_entry_heading";

      const yearLabel = document.createElement("span");
      yearLabel.className = "news_year_label";
      yearLabel.textContent = entry.year || "";
      entryHeading.appendChild(yearLabel);

      const monthLabelInline = document.createElement("span");
      monthLabelInline.className = "news_month";
      monthLabelInline.textContent = entry.month || "";
      entryHeading.appendChild(monthLabelInline);

      if ((entry.year || "").length || (entry.month || "").length) {
        bodyCell.appendChild(entryHeading);
      }

      if (entry.headline) {
        const headline = document.createElement("h3");
        headline.className = "news_headline";
        headline.textContent = entry.headline;
        bodyCell.appendChild(headline);
      }

      if (entry.body) {
        const text = document.createElement("div");
        text.className = "news_text";
        text.innerHTML = entry.body;
        bodyCell.appendChild(text);
      }

      if (entry.image) {
        const media = document.createElement("div");
        media.className = "news_media";

        if (isVideoAsset(entry.image)) {
          const video = document.createElement("video");
          video.src = entry.image;
          video.autoplay = true;
          video.muted = true;
          video.loop = true;
          video.preload = "metadata";
          video.playsInline = true;
          video.setAttribute(
            "aria-label",
            entry.image_alt || `${entry.month} ${entry.year} news video`
          );
          media.appendChild(video);
        } else {
          const image = document.createElement("img");
          image.src = entry.image;
          image.alt =
            entry.image_alt || `${entry.month} ${entry.year} news image`;
          image.loading = "lazy";
          media.appendChild(image);
        }

        bodyCell.appendChild(media);
      }

      entryRow.appendChild(monthCell);
      entryRow.appendChild(bodyCell);
      entriesCol.appendChild(entryRow);
    });

    group.appendChild(entriesCol);
    fragment.appendChild(group);
  });

  container.appendChild(fragment);
}

function isVideoAsset(path) {
  if (!path) {
    return false;
  }

  const extension = path.split("?")[0].split(".").pop();
  return typeof extension === "string" && extension.toLowerCase() === "mp4";
}

function groupEntriesByYear(entries) {
  const groups = new Map();

  entries.forEach((entry) => {
    const yearKey = entry.year;
    if (!groups.has(yearKey)) {
      groups.set(yearKey, []);
    }
    groups.get(yearKey).push(entry);
  });

  return Array.from(groups.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, items]) => ({
      year,
      items,
    }));
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
    createFilterButton(" professionalism filter", "unfiltered", "iconoir-xmark")
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
    renderNews(document.getElementById("news-rows"), applyNewsFilters());
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

  return newsEntries.filter((entry) => {
    const tags = entry._tags;

    if (!tags.length) {
      return true;
    }

    if (!allowedTags.size) {
      return false;
    }

    return tags.some((tag) => allowedTags.has(tag));
  });
}

function parseTags(tagsString = "") {
  return tagsString
    .split(";")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
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
    { once: true }
  );
}

async function loadNewsData() {
  const loader = window.DataLoader;

  if (loader) {
    const workbookRecords = await loader.readWorkbook("/data/news.xlsx");
    if (workbookRecords.length) {
      return loader.normalizeRecords(workbookRecords).map(tagEntry);
    }

    const csvText = await loader.readCsv("/data/news.csv");
    if (csvText) {
      const csvRecords = parseNewsCSV(csvText);
      return loader.normalizeRecords(csvRecords).map(tagEntry);
    }

    return [];
  }

  const csvText = await readCsvFallback("/data/news.csv");
  if (!csvText) {
    return [];
  }
  const csvRecords = parseNewsCSV(csvText);
  return normalizeRecords(csvRecords).map(tagEntry);
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

function tagEntry(entry) {
  entry._tags = parseTags(entry.tags);
  return entry;
}

function createHeadingTag(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}
