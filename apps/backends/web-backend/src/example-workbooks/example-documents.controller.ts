import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { existsSync } from "fs";
import { join } from "path";

interface ExampleDocumentFile {
  file: string;
  filename: string;
  mimeType?: string;
}

const EXAMPLE_DOCUMENT_FILES = new Map<string, ExampleDocumentFile>([
  ["rc-published-dispersion", { file: "RC-Published-Inputs/MACCS2-DOE-published-dispersion.inp", filename: "MACCS2-DOE-published-dispersion.inp", mimeType: "text/plain; charset=utf-8" }],
  ["rc-published-decay", { file: "RC-Published-Inputs/NNDC-ENSDF-2023-04-03-mass-137.txt", filename: "NNDC-ENSDF-2023-04-03-mass-137.txt", mimeType: "text/plain; charset=utf-8" }],
  ["rc-published-input-sources", { file: "RC-Published-Inputs/sources.txt", filename: "Published-RC-inputs-sources.txt", mimeType: "text/plain; charset=utf-8" }],
  ["rc-published-health-records", { file: "RC-Published-Inputs/MACCS-Noah-health-settings-excerpt.inp", filename: "MACCS-Noah-health-settings-excerpt.inp", mimeType: "text/plain; charset=utf-8" }],
  ["rc-published-response-records", { file: "RC-Published-Inputs/MACCS-Noah-response-settings-excerpt.inp", filename: "MACCS-Noah-response-settings-excerpt.inp", mimeType: "text/plain; charset=utf-8" }],
  ["mhtgr-benchmark", { file: "HTGR/INL-EXT-13-30176.pdf", filename: "OECD-NEA-MHTGR-350-Core-Design-Benchmark.pdf" }],
  ["mhtgr-analysis", { file: "HTGR/ISN-0022-3131.pdf", filename: "Multi-physics-analysis-of-the-MHTGR-350.pdf" }],
  ["htgr-safety", { file: "HTGR/ORNL-TM-2014-187.pdf", filename: "Overview-of-Modular-HTGR-Safety-Characterization.pdf" }],
  ["ngnp-pra", { file: "HTGR/INL-EXT-11-21270.pdf", filename: "NGNP-PRA-White-Paper-INL-EXT-11-21270.pdf" }],
  ["mhtgr-evidence-guide", { file: "Seismic-PRA/HTGR/MHTGR-Evidence-Starter-Guide.pdf", filename: "MHTGR-Evidence-Starter-Guide.pdf" }],
  ["mhtgr-pra-model", { file: "Seismic-PRA/HTGR/DOE-HTGR-86-011_Rev3_PRA_Vol1.pdf", filename: "MHTGR-PRA-Volume-1-DOE-HTGR-86-011-Rev3.pdf" }],
  ["mhtgr-opds", { file: "Seismic-PRA/HTGR/DOE-HTGR-86004_Rev9_OPDS.pdf", filename: "MHTGR-Overall-Plant-Design-Specification-Rev9.pdf" }],
  ["mhtgr-ppis-sdd", { file: "Seismic-PRA/HTGR/DOE-HTGR-86-047_PPIS_SDD.pdf", filename: "MHTGR-Protection-and-Instrumentation-SDD.pdf" }],
  ["mhtgr-rccs-sdd", { file: "Seismic-PRA/HTGR/DOE-HTGR-87-068_RCCS_SDD.pdf", filename: "MHTGR-Reactor-Cavity-Cooling-System-SDD.pdf" }],
  ["mhtgr-httf-data", { file: "Seismic-PRA/HTGR/OSTI-1599410_HTTF_Design_Report.pdf", filename: "HTTF-Design-and-Scaling-Report.pdf" }],
  ["mhtgr-nrc-review", { file: "Seismic-PRA/HTGR/NUREG-1338_MHTGR_SER.pdf", filename: "NUREG-1338-MHTGR-Preapplication-Safety-Evaluation.pdf" }],
  ["mhtgr-benchmark-validation", { file: "Seismic-PRA/HTGR/NEA-NSC-R-2017-4_MHTGR-350_Benchmark.pdf", filename: "NEA-MHTGR-350-Core-Design-Benchmark.pdf" }],
  ["sfr-benchmark", { file: "SFR/ANL-ARC-226.pdf", filename: "EBR-II-SHRT-Benchmark-Specifications-ANL-ARC-226.pdf" }],
  ["sfr-shrt-analysis", { file: "SFR/IAEA-TECDOC-1819.pdf", filename: "Benchmark-Analysis-of-EBR-II-SHRT-IAEA-TECDOC-1819.pdf" }],
  ["sfr-hazard", { file: "SFR/ANL-5719.pdf", filename: "EBR-II-Hazard-Summary-Report-ANL-5719.pdf" }],
  ["sfr-pra", { file: "SFR/ANL-NSE-2.pdf", filename: "EBR-II-Level-1-PRA-ANL-NSE-2.pdf" }],
  ["sfr-inherent", { file: "SFR/CONF-850410-6.pdf", filename: "EBR-II-Inherent-Safety-Demonstration-Tests-CONF-850410-6.pdf" }],
]);

function resolveDocumentPath(file: string): string | undefined {
  const candidates = [
    join(__dirname, "example-documents", file),
    join(__dirname, "../../example-documents", file),
    join(process.cwd(), "dist", "apps", "backends", "web-backend", "example-documents", file),
    join(process.cwd(), "apps", "backends", "web-backend", "example-documents", file),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

@Controller("example-documents")
export class ExampleDocumentsController {
  @Get(":element/:docId")
  getDocument(@Param("docId") docId: string, @Res() response: Response): void {
    const { path, filename } = resolveExampleDocument(docId);
    const mimeType = EXAMPLE_DOCUMENT_FILES.get(docId)?.mimeType ?? "application/pdf";
    response.sendFile(path, { headers: { "Content-Type": mimeType, "Content-Disposition": `inline; filename="${filename}"` } }, (err) => {
      if (err !== undefined && !response.headersSent) response.status(404).end();
    });
  }
}

export function resolveExampleDocument(docId: string): { path: string; filename: string } {
  const entry = EXAMPLE_DOCUMENT_FILES.get(docId);
  if (entry === undefined) throw new NotFoundException("Document not found");
  const path = resolveDocumentPath(entry.file);
  if (path === undefined) throw new NotFoundException("Document file not available");
  return { path, filename: entry.filename };
}
