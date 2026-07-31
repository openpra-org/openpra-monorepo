import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, StreamableFile } from "@nestjs/common";
import { createReadStream, existsSync } from "fs";
import { join } from "path";

interface ExampleDocumentFile {
  file: string;
  filename: string;
}

const EXAMPLE_DOCUMENT_FILES = new Map<string, ExampleDocumentFile>([
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
    join(process.cwd(), "dist", "apps", "backends", "web-backend", "example-documents", file),
    join(process.cwd(), "apps", "backends", "web-backend", "example-documents", file),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

@Controller("example-documents")
export class ExampleDocumentsController {
  @Get(":element/:docId")
  @HttpCode(HttpStatus.OK)
  getDocument(@Param("docId") docId: string): StreamableFile {
    const entry = EXAMPLE_DOCUMENT_FILES.get(docId);
    if (entry === undefined) throw new NotFoundException("Document not found");
    const path = resolveDocumentPath(entry.file);
    if (path === undefined) throw new NotFoundException("Document file not available");
    return new StreamableFile(createReadStream(path), {
      type: "application/pdf",
      disposition: `inline; filename="${entry.filename}"`,
    });
  }
}
