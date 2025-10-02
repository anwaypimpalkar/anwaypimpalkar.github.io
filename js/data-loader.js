(function () {
  const textDecoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });

  async function readWorkbook(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      return await parseWorkbook(buffer);
    } catch (error) {
      console.warn(error);
      return [];
    }
  }

  async function parseWorkbook(buffer) {
    try {
      const entries = await unzip(buffer);
      if (!entries.size) {
        return [];
      }

      const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml"));
      const sheetPath = findFirstSheet(entries);
      if (!sheetPath) {
        return [];
      }

      const sheetBytes = entries.get(sheetPath);
      if (!sheetBytes) {
        return [];
      }

      const rows = extractSheetRows(decodeUtf8(sheetBytes), sharedStrings);
      if (!rows.length) {
        return [];
      }

      const headers = rows[0].map((cell) => (cell == null ? "" : String(cell).trim()));
      const data = [];

      for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i] || [];
        const record = {};
        let hasValue = false;

        headers.forEach((header, index) => {
          if (!header) {
            return;
          }
          const rawValue = row[index];
          const value = rawValue == null ? "" : String(rawValue).trim();
          if (value) {
            hasValue = true;
          }
          record[header] = value;
        });

        if (hasValue) {
          data.push(record);
        }
      }

      return data;
    } catch (error) {
      console.warn("Unable to parse workbook", error);
      return [];
    }
  }

  function findFirstSheet(entries) {
    for (const name of entries.keys()) {
      if (/^xl\/worksheets\/sheet[0-9]+\.xml$/i.test(name)) {
        return name;
      }
    }
    return null;
  }

  function parseSharedStrings(bytes) {
    if (!bytes) {
      return [];
    }

    const doc = parseXml(decodeUtf8(bytes));
    return Array.from(doc.getElementsByTagName("si")).map((si) => si.textContent || "");
  }

  function extractSheetRows(xml, sharedStrings) {
    const doc = parseXml(xml);
    const rows = [];

    doc.querySelectorAll("row").forEach((rowEl) => {
      const rowData = [];
      rowEl.querySelectorAll("c").forEach((cellEl) => {
        const ref = cellEl.getAttribute("r") || "";
        const colLetters = ref.replace(/\d+/g, "");
        const columnIndex = colLetters ? columnLettersToIndex(colLetters) : rowData.length;
        const cellType = cellEl.getAttribute("t");
        let value = "";

        if (cellType === "s") {
          const v = cellEl.querySelector("v");
          const idx = v ? Number(v.textContent) : NaN;
          value = !Number.isNaN(idx) && sharedStrings[idx] !== undefined ? sharedStrings[idx] : "";
        } else if (cellType === "inlineStr") {
          const t = cellEl.querySelector("is t");
          value = t ? t.textContent : "";
        } else {
          const v = cellEl.querySelector("v");
          value = v ? v.textContent : "";
        }

        rowData[columnIndex] = value;
      });

      rows.push(rowData);
    });

    return rows;
  }

  function columnLettersToIndex(letters) {
    let index = 0;
    for (let i = 0; i < letters.length; i += 1) {
      const code = letters.charCodeAt(i);
      if (code >= 65 && code <= 90) {
        index = index * 26 + (code - 64);
      } else if (code >= 97 && code <= 122) {
        index = index * 26 + (code - 96);
      }
    }
    return index - 1;
  }

  async function unzip(buffer) {
    const view = new DataView(buffer);
    const eocd = findEndOfCentralDirectory(view);
    const entries = new Map();
    let offset = eocd.centralDirectoryOffset;

    for (let entryIndex = 0; entryIndex < eocd.totalEntries; entryIndex += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) {
        break;
      }

      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);

      const nameBytes = new Uint8Array(buffer, offset + 46, nameLength);
      const name = decodeUtf8(nameBytes);

      offset += 46 + nameLength + extraLength + commentLength;

      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
        continue;
      }

      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressedData = new Uint8Array(buffer, dataStart, compressedSize);

      let data;
      if (compression === 0) {
        data = new Uint8Array(compressedData);
      } else if (compression === 8) {
        data = await inflateRaw(compressedData);
      } else {
        continue;
      }

      entries.set(name, data);
    }

    return entries;
  }

  function findEndOfCentralDirectory(view) {
    for (let i = view.byteLength - 22; i >= 0; i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) {
        const totalEntries = view.getUint16(i + 10, true);
        const centralDirectoryOffset = view.getUint32(i + 16, true);
        return { totalEntries, centralDirectoryOffset };
      }
    }
    throw new Error("Zip end of central directory not found");
  }

  async function inflateRaw(data) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("DecompressionStream API is not supported in this browser");
    }

    const stream = new Blob([data])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = stream.getReader();
    const chunks = [];
    let totalLength = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        totalLength += value.length;
      }
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  async function readCsv(path) {
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

  function normalizeRecords(records) {
    return (records || []).map((record) => {
      const normalized = {};
      Object.keys(record || {}).forEach((key) => {
        const trimmedKey = key ? String(key).trim() : "";
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

  function decodeUtf8(bytes) {
    return textDecoder.decode(bytes);
  }

  function parseXml(xml) {
    return new DOMParser().parseFromString(xml, "application/xml");
  }

  window.DataLoader = {
    readWorkbook,
    readCsv,
    normalizeRecords,
  };
})();
