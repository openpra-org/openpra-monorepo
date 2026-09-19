import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  WorkbookCrossReferenceSchema,
  WorkbookModelAddressSchema,
} from "interfaces-shared-types/newly-developed-methods";
import type {
  WorkbookDependencyReference,
  WorkbookMethodHostType,
  WorkbookModelAddress,
  WorkbookModelDependenciesResponse,
  WorkbookModelDependency,
} from "interfaces-shared-types/newly-developed-methods";
import { SyWorkbook, type SyWorkbookDocument } from "../../sy-workbooks/sy-workbook.schema";
import { EsWorkbook, type EsWorkbookDocument } from "../../es-workbooks/es-workbook.schema";
import { EsqWorkbook, type EsqWorkbookDocument } from "../../esq-workbooks/esq-workbook.schema";

interface DependencySourceDocument {
  workbookId: string;
  mef: unknown;
}

interface LocatedReference {
  path: string;
  reference: WorkbookDependencyReference;
}

interface ModelDeletionDependencyOptions {
  ignoredSourcePathPrefixes?: string[];
}

const escapeJsonPointerSegment = (segment: string): string =>
  segment.replaceAll("~", "~0").replaceAll("/", "~1");

const findTypedWorkbookReferences = (
  value: unknown,
  path = "",
): LocatedReference[] => {
  if (typeof value !== "object" || value === null) return [];

  const crossReference = WorkbookCrossReferenceSchema.safeParse(value);
  if (crossReference.success) {
    return [{ path: path || "/", reference: crossReference.data }];
  }

  const modelAddress = WorkbookModelAddressSchema.safeParse(value);
  if (modelAddress.success) {
    return [{ path: path || "/", reference: modelAddress.data }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      findTypedWorkbookReferences(entry, `${path}/${index}`),
    );
  }

  return Object.entries(value).flatMap(([key, entry]) =>
    findTypedWorkbookReferences(
      entry,
      `${path}/${escapeJsonPointerSegment(key)}`,
    ),
  );
};

const referenceTargetsModel = (
  reference: WorkbookDependencyReference,
  target: WorkbookModelAddress,
): boolean =>
  reference.workbookId === target.workbookId &&
  "modelId" in reference &&
  reference.modelId === target.modelId;

@Injectable()
export class WorkbookDependencyDiscoveryService {
  constructor(
    @InjectModel(SyWorkbook.name)
    private readonly syWorkbookModel: Model<SyWorkbookDocument>,
    @InjectModel(EsWorkbook.name)
    private readonly esWorkbookModel: Model<EsWorkbookDocument>,
    @InjectModel(EsqWorkbook.name)
    private readonly esqWorkbookModel: Model<EsqWorkbookDocument>,
  ) {}

  async findModelDependencies(
    target: WorkbookModelAddress,
  ): Promise<WorkbookModelDependenciesResponse> {
    const [syDocuments, esDocuments, esqDocuments] = await Promise.all([
      this.syWorkbookModel.find({}, { workbookId: 1, mef: 1 }).lean().exec(),
      this.esWorkbookModel.find({}, { workbookId: 1, mef: 1 }).lean().exec(),
      this.esqWorkbookModel.find({}, { workbookId: 1, mef: 1 }).lean().exec(),
    ]);
    const sources: Array<{
      hostType: WorkbookMethodHostType;
      document: DependencySourceDocument;
    }> = [
      ...syDocuments.map((document) => ({
        hostType: "SY" as const,
        document: { workbookId: document.workbookId, mef: document.mef },
      })),
      ...esDocuments.map((document) => ({
        hostType: "ES" as const,
        document: { workbookId: document.workbookId, mef: document.mef },
      })),
      ...esqDocuments.map((document) => ({
        hostType: "ESQ" as const,
        document: { workbookId: document.workbookId, mef: document.mef },
      })),
    ];

    const dependencies: WorkbookModelDependency[] = sources.flatMap(
      ({ hostType, document }) =>
        findTypedWorkbookReferences(document.mef)
          .filter(({ reference }) => referenceTargetsModel(reference, target))
          .map(({ path, reference }) => ({
            sourceHostType: hostType,
            sourceWorkbookId: document.workbookId,
            path,
            reference,
          })),
    );

    dependencies.sort((left, right) =>
      [left.sourceHostType, left.sourceWorkbookId, left.path].join(":").localeCompare(
        [right.sourceHostType, right.sourceWorkbookId, right.path].join(":"),
      ),
    );

    return { target, dependencies };
  }

  async assertModelCanBeDeleted(
    target: WorkbookModelAddress,
    options: ModelDeletionDependencyOptions = {},
  ): Promise<void> {
    const result = await this.findModelDependencies(target);
    const ignoredPrefixes = options.ignoredSourcePathPrefixes ?? [];
    const blockingDependencies = result.dependencies.filter(
      (dependency) =>
        !(
          dependency.sourceWorkbookId === target.workbookId &&
          ignoredPrefixes.some(
            (prefix) => dependency.path === prefix || dependency.path.startsWith(`${prefix}/`),
          )
        ),
    );
    if (blockingDependencies.length > 0) {
      throw new ConflictException({
        message: `Workbook model '${target.modelId}' is referenced and cannot be deleted`,
        target,
        dependencies: blockingDependencies,
      });
    }
  }
}

export { escapeJsonPointerSegment, findTypedWorkbookReferences, referenceTargetsModel };
export type { ModelDeletionDependencyOptions };
