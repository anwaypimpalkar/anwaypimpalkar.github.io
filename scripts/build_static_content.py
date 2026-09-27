#!/usr/bin/env python3
"""
Renders data/projects.xlsx into static HTML and injects it into index.html,
between generated-content markers. Run this before pushing, any time the
spreadsheet changes:

    python3 scripts/build_static_content.py

Safe to re-run: each run deletes the previously generated block (found via
its markers) and writes a fresh one in its place. The filter behavior in
js/publications.js runs on top of this static markup as progressive
enhancement, so the page is fully readable (and crawlable) without
JavaScript.
"""

import html
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit(
        "This script requires openpyxl.\n"
        "Install it with: pip install openpyxl (or: pip install -r scripts/requirements.txt)"
    )

ROOT = Path(__file__).resolve().parent.parent
START_MARKER = "<!-- BEGIN GENERATED CONTENT: run scripts/build_static_content.py to regenerate. DO NOT EDIT BY HAND. -->"
END_MARKER = "<!-- END GENERATED CONTENT -->"


def cell_to_str(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def read_workbook(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    headers = [cell_to_str(h) for h in rows[0]]
    records = []

    for raw_row in rows[1:]:
        record = {}
        has_value = False

        for index, header in enumerate(headers):
            if not header:
                continue
            value = cell_to_str(raw_row[index] if index < len(raw_row) else None)
            if value:
                has_value = True
            record[header] = value

        if has_value:
            records.append(record)

    return records


def esc(value):
    return html.escape(value or "", quote=True)


def parse_list(value, sep=";"):
    if not value:
        return []
    return [part.strip() for part in value.split(sep) if part.strip()]


def parse_links(value):
    links = []
    for entry in parse_list(value):
        label, _, url = entry.partition("|")
        url = url.strip()
        if url:
            links.append((label.strip(), url))
    return links


MONTH_NUMBERS = {
    name: number
    for number, names in enumerate(
        [
            ("jan", "january"),
            ("feb", "february"),
            ("mar", "march"),
            ("apr", "april"),
            ("may",),
            ("jun", "june"),
            ("jul", "july"),
            ("aug", "august"),
            ("sep", "sept", "september"),
            ("oct", "october"),
            ("nov", "november"),
            ("dec", "december"),
        ],
        start=1,
    )
    for name in names
}

HIDE_VALUES = {"hide", "hidden", "no", "n", "false", "0", "off"}


def is_shown(record):
    """A row is published unless its `show` column explicitly says otherwise.

    Defaulting to shown means a newly added row appears even if the column was
    left blank, rather than disappearing silently.
    """
    return cell_to_str(record.get("show", "")).strip().lower() not in HIDE_VALUES


def month_number(value):
    """'Sep' -> 9. Unknown or blank sorts after every named month."""
    key = cell_to_str(value).strip().lower().rstrip(".")
    if key in MONTH_NUMBERS:
        return MONTH_NUMBERS[key]
    try:
        number = int(key)
    except (TypeError, ValueError):
        return 0
    return number if 1 <= number <= 12 else 0


def slugify(value):
    """'Robots and Structures' -> 'robots-and-structures'.

    Theme values go into CSS class names, so they have to be single tokens: a
    space would make the browser read one class as several and the styling
    would silently disappear. Write themes in the spreadsheet however reads
    best; this derives the slug.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return slug.strip("-")


def format_tag_label(value):
    """The badge shows what the spreadsheet says, lowercased."""
    return value.strip().lower()


def is_video_asset(path):
    if not path:
        return False
    extension = path.split("?")[0].rsplit(".", 1)[-1] if "." in path else ""
    return extension.lower() == "mp4"


def media_html(src, alt_text, css_class):
    if is_video_asset(src):
        return (
            f'<div class="{css_class}">'
            f'<video src="{esc(src)}" autoplay muted loop preload="metadata" playsinline '
            f'aria-label="{esc(alt_text)}"></video>'
            f"</div>"
        )
    return (
        f'<div class="{css_class}">'
        f'<img src="{esc(src)}" alt="{esc(alt_text)}" loading="lazy" />'
        f"</div>"
    )


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


def build_publication_card(record, index):
    title = record.get("title", "")
    authors = parse_list(record.get("authors", ""))
    journal = record.get("journal", "")
    year = record.get("year", "")
    links = parse_links(record.get("links", ""))
    description = record.get("description", "")
    themes = parse_list(record.get("themes", ""))
    awards = parse_list(record.get("awards", ""))
    image = record.get("image", "")
    image_alt = record.get("image_alt", "") or title or "Publication graphic"
    section = record.get("section", "") or "Publications"

    parts = ['<div class="publication"']
    parts.append(f' data-index="{index}"')
    parts.append(f' data-section="{esc(section)}"')
    parts.append(f' data-year="{esc(year)}"')
    parts.append(f' data-themes="{esc(";".join(slugify(t) for t in themes))}"')
    parts.append(">")

    if image:
        parts.append(media_html(image, image_alt, "publication_media"))

    parts.append('<div class="publication_details">')
    parts.append(f'<h3 class="publication_title">{esc(title)}</h3>')

    if authors:
        author_spans = []
        for author in authors:
            css_class = ' class="underline"' if author.lower() == "anway pimpalkar" else ""
            author_spans.append(f"<span{css_class}>{esc(author)}</span>")
        parts.append(f'<p class="publication_authors">{", ".join(author_spans)}</p>')

    if journal or year:
        journal_bits = []
        if journal:
            journal_bits.append(f"<em>{esc(journal)}</em>")
        if year:
            sep = ", " if journal else ""
            journal_bits.append(f"{sep}{esc(year)}")
        for label, url in links:
            journal_bits.append('<span class="publication_meta_separator"> &#8729; </span>')
            journal_bits.append(
                f'<a class="publication_meta_link link harvard" href="{esc(url)}" '
                f'target="_blank" rel="noopener">{esc(label or url)}'
                f'<i class="iconoir-arrow-up-right"></i></a>'
            )
        parts.append(f'<p class="publication_journal">{"".join(journal_bits)}</p>')

    if awards:
        badges = "".join(f'<span class="publication_award_badge">{esc(a)}</span>' for a in awards)
        parts.append(f'<div class="publication_awards">{badges}</div>')

    toggle_row = ""
    if description:
        toggle_row += (
            '<button type="button" class="publication_toggle_btn" aria-expanded="false" '
            'title="Show more details"><span class="publication_toggle_text">Summary</span>'
            '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>'
        )
    if themes:
        tag_badges = "".join(
            f'<span class="publication_tag publication_tag-theme publication_tag-theme-{esc(slugify(t))}">'
            f"{esc(format_tag_label(t))}</span>"
            for t in themes
        )
        toggle_row += f'<div class="publication_tags">{tag_badges}</div>'
    if toggle_row:
        parts.append(f'<div class="publication_toggle_row">{toggle_row}</div>')

    if description:
        parts.append(
            f'<div class="publication_description" style="max-height: 0px"><p>{description}</p></div>'
        )

    parts.append("</div>")  # .publication_details
    parts.append("</div>")  # .publication
    return "".join(parts)


FALLBACK_YEAR_HEADER = "Undated"


def build_projects_html(records):
    """Newest first, skipping rows the `show` column hides.

    Rows are ordered by year, then month, then spreadsheet position.
    groupByYear() in js/publications.js reproduces the grouping exactly, so the
    markup the browser hydrates matches what was served.
    """
    entries = []
    for index, record in enumerate(records):
        if not is_shown(record):
            continue
        try:
            year = int(record.get("year", ""))
        except (TypeError, ValueError):
            year = None
        entries.append((year, month_number(record.get("month", "")), index, record))

    # undated last, then newest year, then newest month, then spreadsheet order
    entries.sort(key=lambda e: (e[0] is None, -(e[0] or 0), -e[1], e[2]))

    out = []
    current_label = None
    # data-index is the position after sorting, not the spreadsheet row, so the
    # JS -- which orders by data-index within a year -- reproduces this order
    # instead of reshuffling the cards when it hydrates.
    for position, (year, _month, _row, record) in enumerate(entries):
        label = str(year) if year is not None else FALLBACK_YEAR_HEADER
        if label != current_label:
            if current_label is not None:
                out.append("</section>")
            out.append(f'<section class="publications" data-year="{esc(label)}">')
            out.append(f'<h2 class="section_header">{esc(label)}</h2>')
            current_label = label
        out.append(build_publication_card(record, position))

    if current_label is not None:
        out.append("</section>")

    return "\n".join(out)


# ---------------------------------------------------------------------------
# Injection
# ---------------------------------------------------------------------------


def inject(html_text, container_id, generated_html):
    block = f"{START_MARKER}\n{generated_html}\n{END_MARKER}"

    marker_pattern = re.compile(re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER), re.DOTALL)
    if marker_pattern.search(html_text):
        return marker_pattern.sub(lambda _match: block, html_text, count=1)

    container_pattern = re.compile(
        r'(<div[^>]*\bid="' + re.escape(container_id) + r'"[^>]*>)(\s*)(</div>)'
    )
    match = container_pattern.search(html_text)
    if not match:
        raise ValueError(f'Could not find an empty <div id="{container_id}"> to inject into')
    return container_pattern.sub(lambda m: f"{m.group(1)}\n{block}\n{m.group(3)}", html_text, count=1)


def process(page_path, container_id, generated_html):
    full_path = ROOT / page_path
    original = full_path.read_text(encoding="utf-8")
    updated = inject(original, container_id, generated_html)
    full_path.write_text(updated, encoding="utf-8")
    print(f"Updated {page_path} (#{container_id})")


def main():
    projects_records = read_workbook(ROOT / "data" / "projects.xlsx")

    projects_html = build_projects_html(projects_records)
    process("index.html", "publications-root", projects_html)

    shown = sum(1 for record in projects_records if is_shown(record))
    hidden = len(projects_records) - shown
    hidden_note = f", {hidden} hidden" if hidden else ""
    print(f"{shown} projects published{hidden_note}.")


if __name__ == "__main__":
    main()
