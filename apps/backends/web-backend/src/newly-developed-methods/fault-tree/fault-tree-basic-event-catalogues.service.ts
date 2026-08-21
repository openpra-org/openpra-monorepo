import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type {
  FaultTreeBasicEventCatalogue,
  FaultTreeBasicEventCatalogueCreateRequest,
  FaultTreeBasicEventCataloguePatchRequest,
} from "interfaces-shared-types/newly-developed-methods";
import { FaultTreeBasicEventCatalogueSchema } from "interfaces-shared-types/newly-developed-methods";
import { ProjectsService } from "../../projects/projects.service";
import {
  FaultTreeBasicEventCatalogueRecord,
  type FaultTreeBasicEventCatalogueRecordDocument,
} from "./fault-tree-basic-event-catalogue-record.schema";

interface ActingUser {
  username: string;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

function toCatalogue(
  document: FaultTreeBasicEventCatalogueRecordDocument,
): FaultTreeBasicEventCatalogue {
  return FaultTreeBasicEventCatalogueSchema.parse(document.catalogue);
}

@Injectable()
class FaultTreeBasicEventCataloguesService {
  constructor(
    @InjectModel(FaultTreeBasicEventCatalogueRecord.name)
    private readonly catalogueModel: Model<FaultTreeBasicEventCatalogueRecordDocument>,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(
    projectId: string,
    request: FaultTreeBasicEventCatalogueCreateRequest,
    acting: ActingUser,
  ): Promise<FaultTreeBasicEventCatalogue> {
    if (request.projectId !== projectId) {
      throw new BadRequestException("Request project id must match the route project id");
    }
    if (request.createdBy !== acting.username) {
      throw new BadRequestException("Creator must match the authenticated user");
    }
    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") {
      throw new ForbiddenException("You cannot create a basic-event catalogue in this project");
    }

    const timestamp = new Date();
    const catalogue = FaultTreeBasicEventCatalogueSchema.parse({
      schemaVersion: request.schemaVersion,
      projectId,
      revision: 1,
      createdBy: acting.username,
      createdAt: timestamp.toISOString(),
      updatedBy: acting.username,
      updatedAt: timestamp.toISOString(),
      basicEvents: request.basicEvents,
    });

    try {
      const created = await this.catalogueModel.create({
        projectId,
        schemaVersion: catalogue.schemaVersion,
        revision: catalogue.revision,
        createdBy: catalogue.createdBy,
        createdAt: timestamp,
        updatedBy: catalogue.updatedBy,
        updatedAt: timestamp,
        catalogue,
      });
      return toCatalogue(created);
    }
    catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException("This project already has a fault-tree basic-event catalogue");
      }
      throw error;
    }
  }

  async load(projectId: string, acting: ActingUser): Promise<FaultTreeBasicEventCatalogue> {
    await this.projectsService.resolveAccess(projectId, acting);
    return toCatalogue(await this.find(projectId));
  }

  async patch(
    projectId: string,
    request: FaultTreeBasicEventCataloguePatchRequest,
    acting: ActingUser,
  ): Promise<FaultTreeBasicEventCatalogue> {
    if (request.projectId !== projectId) {
      throw new BadRequestException("Request project id must match the route project id");
    }
    if (request.updatedBy !== acting.username) {
      throw new BadRequestException("Updater must match the authenticated user");
    }
    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") {
      throw new ForbiddenException("You cannot update the basic-event catalogue in this project");
    }

    const timestamp = new Date();
    const updated = await this.catalogueModel
      .findOneAndUpdate(
        { projectId, revision: request.expectedRevision },
        {
          $set: {
            updatedBy: acting.username,
            updatedAt: timestamp,
            "catalogue.updatedBy": acting.username,
            "catalogue.updatedAt": timestamp.toISOString(),
            "catalogue.basicEvents": request.basicEvents,
          },
          $inc: { revision: 1, "catalogue.revision": 1 },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (updated === null) {
      const exists = await this.catalogueModel.exists({ projectId });
      if (exists === null) {
        throw new NotFoundException("Fault-tree basic-event catalogue not found");
      }
      throw new ConflictException("Fault-tree basic-event catalogue revision conflict");
    }
    return toCatalogue(updated);
  }

  async loadSnapshot(projectId: string): Promise<FaultTreeBasicEventCatalogue | undefined> {
    const document = await this.catalogueModel.findOne({ projectId }).exec();
    return document === null ? undefined : toCatalogue(document);
  }

  private async find(projectId: string): Promise<FaultTreeBasicEventCatalogueRecordDocument> {
    const document = await this.catalogueModel.findOne({ projectId }).exec();
    if (document === null) {
      throw new NotFoundException("Fault-tree basic-event catalogue not found");
    }
    return document;
  }
}

export { FaultTreeBasicEventCataloguesService };
