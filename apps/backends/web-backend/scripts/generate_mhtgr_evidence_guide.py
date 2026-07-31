"""Build the novice-facing MHTGR evidence guide from the curated source PDFs."""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path
from typing import Callable, Iterable

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


PAGE_WIDTH, PAGE_HEIGHT = landscape(letter)
MARGIN = 0.55 * inch
NAVY = colors.HexColor("#17243B")
BLUE = colors.HexColor("#3569A8")
PALE_BLUE = colors.HexColor("#EAF1F9")
PALE_GRAY = colors.HexColor("#F3F5F7")
MID_GRAY = colors.HexColor("#667085")
TEXT = colors.HexColor("#202733")
GREEN = colors.HexColor("#2E7D5B")
AMBER = colors.HexColor("#A45B13")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--pdftoppm", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def render_source_page(
    pdftoppm: Path,
    pdf: Path,
    page_number: int,
    output_dir: Path,
    key: str,
) -> Path:
    prefix = output_dir / key
    subprocess.run(
        [
            str(pdftoppm),
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            "-r",
            "120",
            "-png",
            "-singlefile",
            str(pdf),
            str(prefix),
        ],
        check=True,
        capture_output=True,
    )
    result = prefix.with_suffix(".png")
    if not result.exists():
        raise RuntimeError(f"Page render was not created: {result}")
    return result


def paragraph(
    canvas: Canvas,
    text: str,
    x: float,
    y_top: float,
    width: float,
    style: ParagraphStyle,
) -> float:
    item = Paragraph(text, style)
    _, height = item.wrap(width, PAGE_HEIGHT)
    item.drawOn(canvas, x, y_top - height)
    return y_top - height


def title(canvas: Canvas, page_title: str, page_number: int, kicker: str) -> None:
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_HEIGHT - 0.68 * inch, PAGE_WIDTH, 0.68 * inch, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(MARGIN, PAGE_HEIGHT - 0.28 * inch, kicker.upper())
    canvas.setFont("Helvetica-Bold", 19)
    canvas.drawString(MARGIN, PAGE_HEIGHT - 0.55 * inch, page_title)
    canvas.setFillColor(MID_GRAY)
    canvas.setFont("Helvetica", 8)
    footer = f"MHTGR Evidence Starter Guide  |  {page_number}"
    canvas.drawRightString(PAGE_WIDTH - MARGIN, 0.28 * inch, footer)


def label(canvas: Canvas, text: str, x: float, y: float, color: colors.Color = BLUE) -> None:
    padding_x = 7
    width = stringWidth(text.upper(), "Helvetica-Bold", 7.5) + 2 * padding_x
    canvas.setFillColor(color)
    canvas.roundRect(x, y - 13, width, 16, 7, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.drawString(x + padding_x, y - 8.5, text.upper())


def info_box(
    canvas: Canvas,
    heading: str,
    lines: Iterable[str],
    x: float,
    y_top: float,
    width: float,
    height: float,
    *,
    fill: colors.Color = PALE_BLUE,
    heading_color: colors.Color = NAVY,
) -> None:
    canvas.setFillColor(fill)
    canvas.roundRect(x, y_top - height, width, height, 8, stroke=0, fill=1)
    canvas.setFillColor(heading_color)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(x + 12, y_top - 20, heading)
    canvas.setFillColor(TEXT)
    canvas.setFont("Helvetica", 8.5)
    item_top = y_top - 35
    for line in lines:
        canvas.setFillColor(BLUE)
        canvas.circle(x + 16, item_top - 5.5, 2.1, stroke=0, fill=1)
        canvas.setFillColor(TEXT)
        style = ParagraphStyle(
            "box-line",
            fontName="Helvetica",
            fontSize=8.2,
            leading=10,
            textColor=TEXT,
        )
        item_top = paragraph(canvas, line, x + 25, item_top, width - 37, style) - 4


def source_image(
    canvas: Canvas,
    image_path: Path,
    caption: str,
    x: float,
    y_top: float,
    width: float,
    height: float,
) -> None:
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.setStrokeColor(colors.HexColor("#CBD2DC"))
    canvas.roundRect(x, y_top - height, width, height, 5, stroke=1, fill=1)
    with Image.open(image_path) as source:
        # Embed a flattened RGB raster. Some historical scans contain unusual
        # image masks that otherwise alter adjacent page content in PDF viewers.
        image = source.convert("RGB")
        usable_width = width - 14
        usable_height = height - 30
        ratio = min(usable_width / image.width, usable_height / image.height)
        draw_width = image.width * ratio
        draw_height = image.height * ratio
        canvas.drawInlineImage(
            image,
            x + (width - draw_width) / 2,
            y_top - 8 - draw_height,
            draw_width,
            draw_height,
        )
    canvas.setFillColor(TEXT)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawCentredString(x + width / 2, y_top - height + 9, caption)
    canvas.restoreState()


def citation(canvas: Canvas, text: str) -> None:
    style = ParagraphStyle(
        "citation",
        fontName="Helvetica",
        fontSize=6.8,
        leading=8.2,
        textColor=MID_GRAY,
        alignment=TA_LEFT,
    )
    paragraph(canvas, text, MARGIN, 0.58 * inch, PAGE_WIDTH - 2 * MARGIN, style)


def measurement_uncertainty_panel(
    canvas: Canvas,
    x: float,
    y_top: float,
    width: float,
    height: float,
) -> None:
    canvas.setFillColor(colors.white)
    canvas.setStrokeColor(colors.HexColor("#CBD2DC"))
    canvas.roundRect(x, y_top - height, width, height, 5, stroke=1, fill=1)
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(x + 18, y_top - 30, "Measurement uncertainty record")
    canvas.setFillColor(MID_GRAY)
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(x + 18, y_top - 47, "Example entries transcribed from the HTTF design report")

    columns = [
        (x + 18, 2.15 * inch, "Measurement"),
        (x + 2.42 * inch, 1.25 * inch, "Systematic basis"),
        (x + 3.84 * inch, width - 3.84 * inch - 18, "Random basis"),
    ]
    table_top = y_top - 0.92 * inch
    canvas.setFillColor(PALE_BLUE)
    canvas.rect(x + 12, table_top - 25, width - 24, 25, stroke=0, fill=1)
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 8.5)
    for column_x, _, heading in columns:
        canvas.drawString(column_x, table_top - 16, heading)

    rows = [
        ("Thermal diffusivity", "Accuracy: 3%", "Repeatability: 2%"),
        ("Length measurement", "Accuracy: 0.0001 in.", "Resolution: 0.001 mm"),
        ("Mass measurement", "Linearity: 0.15 mg", "Repeatability: 0.01 mg"),
    ]
    row_height = 0.67 * inch
    y = table_top - 25
    for index, row in enumerate(rows):
        if index % 2 == 1:
            canvas.setFillColor(PALE_GRAY)
            canvas.rect(x + 12, y - row_height, width - 24, row_height, stroke=0, fill=1)
        canvas.setStrokeColor(colors.HexColor("#D9DEE6"))
        canvas.line(x + 12, y - row_height, x + width - 12, y - row_height)
        for (column_x, column_width, _), value in zip(columns, row):
            style = ParagraphStyle(
                f"measurement-{index}-{column_x}",
                fontName="Helvetica-Bold" if column_x == columns[0][0] else "Helvetica",
                fontSize=8.5,
                leading=11,
                textColor=TEXT,
            )
            paragraph(canvas, value, column_x, y - 15, column_width - 8, style)
        y -= row_height

    info_box(
        canvas,
        "What must accompany these values",
        [
            "Instrument and channel identifier",
            "Calibration record and valid calibration period",
            "Units, sampling time, processing method, exclusions, and raw file",
        ],
        x + 12,
        y - 0.25 * inch,
        width - 24,
        1.55 * inch,
        fill=colors.HexColor("#FFF2DF"),
        heading_color=AMBER,
    )
    canvas.setFillColor(MID_GRAY)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(x + 18, y_top - height + 14, "Source: OSU-HTTF-TECH-003-R2, Table 3.")


def record_anatomy_panel(
    canvas: Canvas,
    x: float,
    y_top: float,
    width: float,
    height: float,
    *,
    heading: str,
    subheading: str,
    rows: list[tuple[str, str]],
    review_prompt: str,
    source: str,
) -> None:
    canvas.setFillColor(colors.white)
    canvas.setStrokeColor(colors.HexColor("#CBD2DC"))
    canvas.roundRect(x, y_top - height, width, height, 5, stroke=1, fill=1)
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 14)
    canvas.drawString(x + 18, y_top - 30, heading)
    canvas.setFillColor(MID_GRAY)
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(x + 18, y_top - 47, subheading)

    label_width = 1.35 * inch
    row_height = 0.61 * inch
    row_top = y_top - 0.88 * inch
    for index, (row_label, value) in enumerate(rows):
        y = row_top - index * row_height
        canvas.setFillColor(PALE_BLUE if index % 2 == 0 else PALE_GRAY)
        canvas.roundRect(x + 12, y - row_height + 3, width - 24, row_height - 4, 4, stroke=0, fill=1)
        canvas.setFillColor(NAVY)
        canvas.setFont("Helvetica-Bold", 8.5)
        canvas.drawString(x + 22, y - 20, row_label)
        value_style = ParagraphStyle(
            f"record-anatomy-{index}",
            fontName="Helvetica",
            fontSize=8.5,
            leading=10.5,
            textColor=TEXT,
        )
        paragraph(
            canvas,
            value,
            x + 22 + label_width,
            y - 12,
            width - label_width - 58,
            value_style,
        )

    prompt_y = row_top - len(rows) * row_height - 0.12 * inch
    info_box(
        canvas,
        "What the independent checker asks",
        [review_prompt],
        x + 12,
        prompt_y,
        width - 24,
        1.05 * inch,
        fill=colors.HexColor("#FFF2DF"),
        heading_color=AMBER,
    )
    canvas.setFillColor(MID_GRAY)
    canvas.setFont("Helvetica", 7.2)
    canvas.drawString(x + 18, y_top - height + 14, source)


def two_column_evidence_page(
    canvas: Canvas,
    page_number: int,
    page_title: str,
    evidence_type: str,
    plain_definition: str,
    evidence_lines: list[str],
    production_lines: list[str],
    images: list[tuple[Path, str]],
    source_text: str,
    *,
    limitation: str | None = None,
    right_panel: Callable[[Canvas, float, float, float, float], None] | None = None,
) -> None:
    top = PAGE_HEIGHT - 0.95 * inch
    image_x = 4.98 * inch
    image_width = PAGE_WIDTH - image_x - MARGIN
    gap = 0.14 * inch
    image_height = 5.85 * inch if len(images) == 1 else (5.85 * inch - gap) / 2
    for index, (image_path, image_caption) in enumerate(images):
        source_image(
            canvas,
            image_path,
            image_caption,
            image_x,
            top - index * (image_height + gap),
            image_width,
            image_height,
        )
    if right_panel is not None:
        right_panel(canvas, image_x, top, image_width, 5.85 * inch)

    # Draw the guide text after the source-page images. Some historical scans have
    # unusual image masks; this ordering guarantees they cannot obscure the guide.
    title(canvas, page_title, page_number, "How real evidence looks")
    left_x = MARGIN
    left_width = 4.15 * inch
    label(canvas, evidence_type, left_x, top)
    style = ParagraphStyle(
        "definition",
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=NAVY,
    )
    paragraph(canvas, plain_definition, left_x, top - 27, left_width, style)
    info_box(
        canvas,
        "What the workbook record should point to",
        evidence_lines,
        left_x,
        top - 1.12 * inch,
        left_width,
        1.63 * inch,
    )
    info_box(
        canvas,
        "What a production evidence package also keeps",
        production_lines,
        left_x,
        top - 2.93 * inch,
        left_width,
        1.54 * inch,
        fill=PALE_GRAY,
    )
    if limitation:
        info_box(
            canvas,
            "Important limitation",
            [limitation],
            left_x,
            top - 4.65 * inch,
            left_width,
            0.78 * inch,
            fill=colors.HexColor("#FFF2DF"),
            heading_color=AMBER,
        )

    citation(canvas, source_text)
    canvas.showPage()


def build_guide(repo_root: Path, pdftoppm: Path, output: Path) -> None:
    asset_root = repo_root / "apps/backends/web-backend/example-documents"
    seismic_root = asset_root / "Seismic-PRA/HTGR"
    source_files = {
        "pra": seismic_root / "DOE-HTGR-86-011_Rev3_PRA_Vol1.pdf",
        "opds": seismic_root / "DOE-HTGR-86004_Rev9_OPDS.pdf",
        "ppis": seismic_root / "DOE-HTGR-86-047_PPIS_SDD.pdf",
        "httf": seismic_root / "OSTI-1599410_HTTF_Design_Report.pdf",
        "nureg": seismic_root / "NUREG-1338_MHTGR_SER.pdf",
        "benchmark": seismic_root / "NEA-NSC-R-2017-4_MHTGR-350_Benchmark.pdf",
        "calculation": asset_root / "HTGR/ISN-0022-3131.pdf",
    }
    for name, source in source_files.items():
        if not source.exists():
            raise FileNotFoundError(f"Missing {name} source PDF: {source}")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="mhtgr-evidence-guide-") as temp_name:
        temp_dir = Path(temp_name)
        page_pdfs: list[Path] = []

        def new_page_canvas(page_number: int) -> Canvas:
            page_pdf = temp_dir / f"guide-page-{page_number}.pdf"
            page_pdfs.append(page_pdf)
            result = Canvas(str(page_pdf), pagesize=landscape(letter))
            result.setTitle(f"MHTGR Evidence Starter Guide - Page {page_number}")
            result.setAuthor("OpenPRA example workbook")
            return result

        pages = {
            "pra_cover": render_source_page(pdftoppm, source_files["pra"], 1, temp_dir, "pra-cover"),
            "pra_contents": render_source_page(pdftoppm, source_files["pra"], 6, temp_dir, "pra-contents"),
            "pra_earthquake": render_source_page(pdftoppm, source_files["pra"], 143, temp_dir, "pra-earthquake"),
            "opds_control": render_source_page(pdftoppm, source_files["opds"], 5, temp_dir, "opds-control"),
            "ppis_control": render_source_page(pdftoppm, source_files["ppis"], 4, temp_dir, "ppis-control"),
            "benchmark_foreword": render_source_page(pdftoppm, source_files["benchmark"], 5, temp_dir, "benchmark-foreword"),
        }

        # Cover
        canvas = new_page_canvas(1)
        canvas.setFillColor(NAVY)
        canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)
        canvas.setFillColor(BLUE)
        canvas.rect(0, 0, 0.23 * inch, PAGE_HEIGHT, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 11)
        canvas.drawString(0.75 * inch, PAGE_HEIGHT - 0.92 * inch, "OPENPRA EXAMPLE WORKBOOK")
        canvas.setFont("Helvetica-Bold", 34)
        canvas.drawString(0.75 * inch, PAGE_HEIGHT - 1.75 * inch, "MHTGR Evidence")
        canvas.drawString(0.75 * inch, PAGE_HEIGHT - 2.25 * inch, "Starter Guide")
        canvas.setFillColor(colors.HexColor("#B8C9DE"))
        canvas.setFont("Helvetica", 15)
        canvas.drawString(0.75 * inch, PAGE_HEIGHT - 2.78 * inch, "What documents, models, calculations, data, and review")
        canvas.drawString(0.75 * inch, PAGE_HEIGHT - 3.05 * inch, "look like before a Seismic PRA uses them")
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(0.75 * inch, 1.2 * inch, "PUBLIC MHTGR SOURCE RECORDS  |  NOVICE COMPANION")
        canvas.setFillColor(colors.HexColor("#B8C9DE"))
        cover_style = ParagraphStyle(
            "cover-note",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#B8C9DE"),
        )
        paragraph(
            canvas,
            "Educational example only. This guide and its public source documents are not a "
            "quality-assured, site-specific, as-built plant evidence package.",
            0.75 * inch,
            0.92 * inch,
            6.5 * inch,
            cover_style,
        )
        source_image(
            canvas,
            pages["pra_cover"],
            "DOE-HTGR-86-011, Revision 3, Volume 1",
            7.9 * inch,
            PAGE_HEIGHT - 0.62 * inch,
            2.55 * inch,
            6.85 * inch,
        )
        canvas.showPage()
        canvas.save()

        # How to read the evidence package
        canvas = new_page_canvas(2)
        title(canvas, "How an evidence package works", 2, "Before the analysis begins")
        flow_y = PAGE_HEIGHT - 1.45 * inch
        boxes = [
            ("Source artifact", "A controlled PDF, data file, model export, calculation, or review record."),
            ("Evidence record", "The workbook stores its identity, revision, owner, use, status, and limitations."),
            ("Analyst use", "SHA, SFR, or SPR uses only the parts that are applicable and qualified."),
            ("Configuration control", "If the source changes, the analyst checks affected models and results."),
        ]
        box_width = 2.48 * inch
        gap = 0.22 * inch
        for index, (heading, body) in enumerate(boxes):
            x = MARGIN + index * (box_width + gap)
            canvas.setFillColor(PALE_BLUE if index % 2 == 0 else PALE_GRAY)
            canvas.roundRect(x, flow_y - 1.5 * inch, box_width, 1.5 * inch, 8, stroke=0, fill=1)
            canvas.setFillColor(NAVY)
            canvas.setFont("Helvetica-Bold", 11)
            canvas.drawString(x + 12, flow_y - 22, heading)
            pstyle = ParagraphStyle("flow", fontName="Helvetica", fontSize=9, leading=12, textColor=TEXT)
            paragraph(canvas, body, x + 12, flow_y - 36, box_width - 24, pstyle)
            if index < len(boxes) - 1:
                canvas.setStrokeColor(BLUE)
                canvas.setLineWidth(1.5)
                canvas.line(x + box_width + 3, flow_y - 0.75 * inch, x + box_width + gap - 4, flow_y - 0.75 * inch)

        info_box(
            canvas,
            "A beginner should be able to answer five questions",
            [
                "<b>What is it?</b> The file and record have a recognizable technical purpose.",
                "<b>Which version?</b> The revision, date, and approval state are visible.",
                "<b>Who owns it?</b> Someone is responsible for accuracy and change control.",
                "<b>How is it used?</b> Applicability to SHA, SFR, and SPR is explicit.",
                "<b>What cannot it prove?</b> Limitations and missing companion records are not hidden.",
            ],
            MARGIN,
            PAGE_HEIGHT - 3.42 * inch,
            5.18 * inch,
            2.35 * inch,
        )
        info_box(
            canvas,
            "The important distinction",
            [
                "A report that describes a model is not the executable model.",
                "A test plan is not the raw test data.",
                "A design description is not an as-built walkdown.",
                "A regulator's review is not the applicant's calculation.",
            ],
            5.96 * inch,
            PAGE_HEIGHT - 3.42 * inch,
            PAGE_WIDTH - 5.96 * inch - MARGIN,
            2.35 * inch,
            fill=colors.HexColor("#FFF2DF"),
            heading_color=AMBER,
        )
        citation(
            canvas,
            "This guide uses public, historical MHTGR records to illustrate evidence anatomy. "
            "The Step 02 evidence register remains the controlling index inside the example workbook.",
        )
        canvas.showPage()
        canvas.save()

        canvas = new_page_canvas(3)
        two_column_evidence_page(
            canvas,
            3,
            "Model documentation",
            "Model",
            "A model represents how the plant can respond to initiating events and combinations of failures.",
            [
                "The PRA report identifies the model scope, methods, initiating events, event trees, and quantification.",
                "The earthquake section shows how seismic intensity can create plant and system failures.",
            ],
            [
                "Executable model file and software/version",
                "Model change log and database export",
                "Quantification settings and reproducible run record",
            ],
            [
                (pages["pra_contents"], "Report contents: methods, events, sequences, quantification"),
                (pages["pra_earthquake"], "Earthquake treatment in the MHTGR PRA report"),
            ],
            "Source: DOE-HTGR-86-011, Revision 3, Volume 1, January 1987, PDF pages 6 and 143.",
            limitation="The public PDF documents the PRA model basis. It is not the executable PRA database used to rerun the calculation.",
        )
        canvas.save()

        canvas = new_page_canvas(4)
        two_column_evidence_page(
            canvas,
            4,
            "Controlled design documents",
            "Document",
            "A controlled design document tells the analyst what was designed and which approved revision applies.",
            [
                "The control sheet shows the document number, revision, classification, effective pages, and approvals.",
                "System descriptions provide functions, requirements, interfaces, environmental conditions, and design features.",
            ],
            [
                "Current document index and revision history",
                "Drawings, calculations, requirements, and interface records referenced by the document",
                "Configuration reconciliation showing whether the installed plant matches the design",
            ],
            [
                (pages["opds_control"], "Overall Plant Design Specification control sheet"),
                (pages["ppis_control"], "Protection and instrumentation SDD control sheet"),
            ],
            "Sources: DOE-HTGR-86004, Revision 9, PDF page 5; DOE-HTGR-86-047, Revision 1, PDF page 4.",
            limitation="These are public reference-design records. They do not demonstrate a final, site-specific, as-built configuration.",
        )
        canvas.save()

        canvas = new_page_canvas(5)
        two_column_evidence_page(
            canvas,
            5,
            "Worked engineering calculation",
            "Calculation",
            "A calculation turns named inputs and assumptions into checkable technical results.",
            [
                "The example records geometry, modeling choices, a computational mesh, convergence behavior, uncertainty, and results.",
                "A reviewer can trace what was assumed and judge whether the method is suitable.",
            ],
            [
                "Calculation number, revision, preparer, checker, and approval",
                "Referenced input files and software/version",
                "Reproducible run files, output files, checks, and exception dispositions",
            ],
            [],
            "Source: ISN-0022-3131, Multi-physics Analysis of the MHTGR-350, PDF pages 4 and 10.",
            limitation="This is a reactor multi-physics analysis, not a seismic response calculation. It is included only to show the anatomy of a real technical calculation.",
            right_panel=lambda c, x, y, w, h: record_anatomy_panel(
                c,
                x,
                y,
                w,
                h,
                heading="Calculation record anatomy",
                subheading="A source-cited reading aid for ISN-0022-3131",
                rows=[
                    ("Problem", "Calculate full-core MHTGR-350 neutronic and thermal-fluid behavior."),
                    ("Inputs", "Core geometry, material properties, operating conditions, and cross-section data."),
                    ("Method", "Coupled Griffin and GAMMA+ calculation with a documented computational mesh."),
                    ("Checks", "Iteration behavior, convergence, and Monte Carlo uncertainty are reported."),
                    ("Outputs", "Power-density, neutron-flux, temperature, and flow distributions."),
                ],
                review_prompt="Can another qualified analyst recover the inputs, rerun the named method, and reproduce the reported outputs?",
                source="Source: ISN-0022-3131, methods and results sections.",
            ),
        )
        canvas.save()

        canvas = new_page_canvas(6)
        two_column_evidence_page(
            canvas,
            6,
            "Test and data package",
            "Data",
            "A data package explains how measurements were produced, labeled, calibrated, and assigned uncertainty.",
            [
                "The HTTF design report shows revision control, instrumentation, acquisition channels, and measurement uncertainty.",
                "Those records let an analyst judge whether later test measurements are usable for validation.",
            ],
            [
                "Raw data files in a durable, non-proprietary format",
                "Channel dictionary, units, timestamps, calibration certificates, and excluded-data log",
                "Processing scripts, processed data, uncertainty propagation, and data-quality review",
            ],
            [],
            "Source: OSU-HTTF-TECH-003-R2, High Temperature Test Facility Design and Scaling Report, PDF pages 27 and 68.",
            limitation="The design report describes the facility and measurement system. It is not the raw HTTF experimental data set.",
            right_panel=measurement_uncertainty_panel,
        )
        canvas.save()

        canvas = new_page_canvas(7)
        two_column_evidence_page(
            canvas,
            7,
            "Independent technical review",
            "Review",
            "A review records what an independent party examined, the criteria used, conclusions, and unresolved items.",
            [
                "The NRC report defines the seismic-design review scope and the standards used for evaluation.",
                "Its conclusions distinguish acceptable approaches from matters needing additional resolution.",
            ],
            [
                "Review plan, scope, independence, reviewer qualifications, and criteria",
                "Comments or findings, applicant responses, dispositions, and closure evidence",
                "Approval showing which findings remain open at the analysis freeze date",
            ],
            [],
            "Source: NUREG-1338, Draft Preapplication Safety Evaluation Report for the MHTGR, March 1989, PDF pages 70 and 73.",
            limitation="The NRC report is review evidence. It does not replace the applicant's calculations, models, or controlled design records.",
            right_panel=lambda c, x, y, w, h: record_anatomy_panel(
                c,
                x,
                y,
                w,
                h,
                heading="Independent review record anatomy",
                subheading="A source-cited reading aid for NUREG-1338",
                rows=[
                    ("Reviewer", "U.S. Nuclear Regulatory Commission staff."),
                    ("Scope", "MHTGR preapplication seismic-design methods and instrumentation."),
                    ("Criteria", "Applicable regulatory guides, standards, and staff review positions."),
                    ("Conclusion", "The proposed design procedures were generally acceptable for the preapplication stage."),
                    ("Open matters", "Several structural, damping, floor-spectrum, torsional, and instrumentation items required later resolution."),
                ],
                review_prompt="Does every finding identify the reviewed criterion, responsible party, disposition, closure evidence, and approval status?",
                source="Source: NUREG-1338, Section 3.5.6.",
            ),
        )
        canvas.save()

        canvas = new_page_canvas(8)
        two_column_evidence_page(
            canvas,
            8,
            "Benchmark and validation evidence",
            "Review",
            "A benchmark tests whether different analysis codes and teams reproduce a defined problem consistently.",
            [
                "The MHTGR-350 benchmark defines common cases for code-to-code comparison.",
                "Differences help expose modeling assumptions, implementation errors, and areas needing investigation.",
            ],
            [
                "Benchmark specification and controlled input deck",
                "Participant results, comparison metrics, deviations, and resolution",
                "Applicability assessment connecting benchmark behavior to the production model",
            ],
            [(pages["benchmark_foreword"], "OECD/NEA benchmark purpose and use")],
            "Source: NEA/NSC/R(2017)4, MHTGR-350 MW Core Design Benchmark, February 2018, PDF page 5.",
            limitation="Agreement in a benchmark supports model verification. It does not by itself validate plant-specific seismic behavior or equipment capacity.",
        )
        canvas.save()

        # Truthful gaps
        canvas = new_page_canvas(9)
        title(canvas, "What this public example still cannot prove", 9, "Evidence gaps are part of the record")
        heading_style = ParagraphStyle(
            "gap-heading",
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=NAVY,
        )
        paragraph(
            canvas,
            "A real project does not turn a missing artifact into a convincing sentence. It records the gap, its effect, and the closure action.",
            MARGIN,
            PAGE_HEIGHT - 1.02 * inch,
            PAGE_WIDTH - 2 * MARGIN,
            heading_style,
        )
        gaps = [
            ("Site characterization", "Boreholes, shear-wave velocity, dynamic soil properties, groundwater, and a site-specific PSHA record."),
            ("As-built configuration", "Current drawings, equipment locations, anchorage, supports, routing, interfaces, and field-change records."),
            ("Installed equipment qualification", "Item-specific test or analysis records linked to the exact manufacturer, model, mounting, and environment."),
            ("Plant procedures and staffing", "Validated operating and maintenance procedures, indications, action timing, access, and staffing observations."),
            ("Seismic walkdown", "Field notes, photographs, interaction checks, anchorage observations, open items, and resolved dispositions."),
            ("Executable analysis records", "Model databases, scripts, source inputs, run controls, outputs, checksums, and software/version information."),
        ]
        grid_top = PAGE_HEIGHT - 1.68 * inch
        gap_x = 0.18 * inch
        gap_y = 0.18 * inch
        card_width = (PAGE_WIDTH - 2 * MARGIN - gap_x) / 2
        card_height = 1.36 * inch
        for index, (gap_title, gap_body) in enumerate(gaps):
            column = index % 2
            row = index // 2
            x = MARGIN + column * (card_width + gap_x)
            y = grid_top - row * (card_height + gap_y)
            canvas.setFillColor(PALE_GRAY)
            canvas.roundRect(x, y - card_height, card_width, card_height, 7, stroke=0, fill=1)
            canvas.setFillColor(AMBER)
            canvas.setFont("Helvetica-Bold", 10.5)
            canvas.drawString(x + 12, y - 20, gap_title)
            gap_style = ParagraphStyle("gap", fontName="Helvetica", fontSize=8.5, leading=11, textColor=TEXT)
            paragraph(canvas, gap_body, x + 12, y - 35, card_width - 24, gap_style)
        citation(
            canvas,
            "Use the Open evidence gaps table in Step 02 to track these items. "
            "The Generic HTGR example intentionally leaves site-specific, installed-plant, procedural, and walkdown evidence open.",
        )
        canvas.showPage()
        canvas.save()

        writer = PdfWriter()
        for page_pdf in page_pdfs:
            source = PdfReader(str(page_pdf))
            if len(source.pages) != 1:
                raise RuntimeError(f"Expected one rendered guide page in {page_pdf}")
            writer.add_page(source.pages[0])
        writer.add_metadata({
            "/Title": "MHTGR Evidence Starter Guide",
            "/Author": "OpenPRA example workbook",
            "/Subject": "Novice companion to public MHTGR evidence records",
        })
        with output.open("wb") as output_stream:
            writer.write(output_stream)


def main() -> None:
    args = parse_args()
    build_guide(args.repo_root.resolve(), args.pdftoppm.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
