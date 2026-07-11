#!/usr/bin/env python3
"""
Renders data/projects.xlsx and data/news.xlsx into static HTML and injects it
into projects/index.html and news/index.html, between generated-content
markers. Run this before pushing, any time either spreadsheet changes:

    python3 scripts/build_static_content.py

Safe to re-run: each run deletes the previously generated block (found via
its markers) and writes a fresh one in its place. The filter/sort behavior in
js/publications.js and js/news.js runs on top of this static markup as
progressive enhancement, so the page is fully readable (and crawlable)
without JavaScript.
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


def format_tag_label(value):
    normalized = value.strip().lower()
    if normalized == "ai":
        return "AI"
    if normalized == "hci":
        return "HCI"
    parts = [p for p in re.split(r"[-_\s]", value) if p]
    return " ".join(p[:1].upper() + p[1:] for p in parts)


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
    parts.append(f' data-themes="{esc(";".join(t.lower() for t in themes))}"')
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
            '<i class="iconoir-nav-arrow-down" aria-hidden="true"></i></button>'
        )
    if themes:
        tag_badges = "".join(
            f'<span class="publication_tag publication_tag-theme publication_tag-theme-{esc(t.lower())}">'
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


def build_projects_html(records):
    sections = {}
    for index, record in enumerate(records):
        label = record.get("section", "") or "Publications"
        sections.setdefault(label, []).append(build_publication_card(record, index))

    out = []
    for label, cards in sections.items():
        out.append(f'<section class="publications" data-section="{esc(label)}">')
        out.append(f'<h2 class="section_header">{esc(label)}</h2>')
        out.extend(cards)
        out.append("</section>")
    return "\n".join(out)


# ---------------------------------------------------------------------------
# News
# ---------------------------------------------------------------------------


def build_news_entry(record, index):
    year = record.get("year", "")
    month = record.get("month", "")
    headline = record.get("headline", "")
    body = record.get("body", "")
    image = record.get("image", "")
    image_alt = record.get("image_alt", "")
    tags = parse_list(record.get("tags", ""))
    tags_lower = [t.lower() for t in tags]

    parts = [
        f'<div class="news_entry" style="--news-index: {index}" data-index="{index}" '
        f'data-year="{esc(year)}" data-month="{esc(month.lower())}" '
        f'data-tags="{esc(";".join(tags_lower))}"'
    ]
    if tags_lower:
        parts.append(" hidden")
    parts.append(">")

    parts.append(f'<div class="news_month">{esc(month)}</div>')
    parts.append('<div class="news_body">')

    if year or month:
        parts.append(
            '<div class="news_entry_heading">'
            f'<span class="news_year_label">{esc(year)}</span>'
            f'<span class="news_month">{esc(month)}</span>'
            "</div>"
        )

    if headline:
        parts.append(f'<h3 class="news_headline">{esc(headline)}</h3>')

    if body:
        parts.append(f'<div class="news_text">{body}</div>')

    if image:
        alt_text = image_alt or f"{month} {year} news image".strip()
        parts.append(media_html(image, alt_text, "news_media"))

    parts.append("</div>")  # .news_body
    parts.append("</div>")  # .news_entry
    return "".join(parts)


def build_news_html(records):
    years = {}
    for index, record in enumerate(records):
        year = record.get("year", "")
        years.setdefault(year, []).append(build_news_entry(record, index))

    def year_sort_key(year):
        try:
            return -int(year)
        except (TypeError, ValueError):
            return 0

    out = []
    for year in sorted(years, key=year_sort_key):
        out.append(f'<div class="news_year_group" data-year="{esc(year)}">')
        out.append(f'<div class="news_year">{esc(year)}</div>')
        out.append('<div class="news_year_entries">')
        out.extend(years[year])
        out.append("</div>")
        out.append("</div>")
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
    news_records = read_workbook(ROOT / "data" / "news.xlsx")

    process("projects/index.html", "publications-root", build_projects_html(projects_records))
    process("news/index.html", "news-rows", build_news_html(news_records))

    print(f"{len(projects_records)} projects, {len(news_records)} news entries.")


if __name__ == "__main__":
    main()
