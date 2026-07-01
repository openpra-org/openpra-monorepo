import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, StreamableFile } from "@nestjs/common";
import { createReadStream, existsSync } from "fs";
import { join } from "path";

interface PosDocumentFile {
  file: string;
  filename: string;
}

const POS_DOCUMENT_FILES = new Map<string, PosDocumentFile>([
  ["mhtgr-benchmark", { file: "HTGR/INL-EXT-13-30176.pdf", filename: "OECD-NEA-MHTGR-350-Core-Design-Benchmark.pdf" }],
  ["mhtgr-analysis", { file: "HTGR/ISN-0022-3131.pdf", filename: "Multi-physics-analysis-of-the-MHTGR-350.pdf" }],
  ["htgr-safety", { file: "HTGR/ORNL-TM-2014-187.pdf", filename: "Overview-of-Modular-HTGR-Safety-Characterization.pdf" }],
  ["ngnp-pra", { file: "HTGR/INL-EXT-11-21270.pdf", filename: "NGNP-PRA-White-Paper-INL-EXT-11-21270.pdf" }],
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
  getPosDocument(@Param("docId") docId: string): StreamableFile {
    const entry = POS_DOCUMENT_FILES.get(docId);
    if (entry === undefined) throw new NotFoundException("Document not found");
    const path = resolveDocumentPath(entry.file);
    if (path === undefined) throw new NotFoundException("Document file not available");
    return new StreamableFile(createReadStream(path), {
      type: "application/pdf",
      disposition: `inline; filename="${entry.filename}"`,
    });
  }
}
