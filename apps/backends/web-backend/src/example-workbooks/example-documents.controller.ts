import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, StreamableFile } from "@nestjs/common";
import { createReadStream, existsSync } from "fs";
import { join } from "path";

interface PosDocumentFile {
  file: string;
  filename: string;
}

const POS_DOCUMENT_FILES = new Map<string, PosDocumentFile>([
  ["mhtgr-benchmark", { file: "1129932.pdf", filename: "OECD-NEA-MHTGR-350-Core-Design-Benchmark.pdf" }],
  ["mhtgr-analysis", { file: "lemaire2017.pdf", filename: "Multi-physics-analysis-of-the-MHTGR-350.pdf" }],
  ["htgr-safety", { file: "Pub49707.pdf", filename: "Overview-of-Modular-HTGR-Safety-Characterization.pdf" }],
  ["ngnp-pra", { file: "11-21270.pdf", filename: "NGNP-PRA-White-Paper-INL-EXT-11-21270.pdf" }],
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
  @Get("pos/:docId")
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
