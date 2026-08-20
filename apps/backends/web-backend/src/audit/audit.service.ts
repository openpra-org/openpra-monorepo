import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import type { AuditLogEntry, AuditLogResponse } from "interfaces-shared-types";
import { AuditLog, type AuditLogDocument } from "./audit-log.schema";
import { Team, type TeamDocument } from "../teams/team.schema";
import { Project, type ProjectDocument } from "../projects/project.schema";
import { EventBus } from "../events/event-bus";
import type { DomainEvent } from "../events/domain-events";

interface AuditSpec {
  entityKind: "team" | "project";
  entityId: string;
  summary: string;
}

function auditFor(event: DomainEvent): AuditSpec {
  switch (event.type) {
    case "team.invited":
      return { entityKind: "team", entityId: event.teamId, summary: `${event.actor} invited ${event.target}` };
    case "team.member_joined":
      return { entityKind: "team", entityId: event.teamId, summary: `${event.actor} joined the team` };
    case "team.left":
      return { entityKind: "team", entityId: event.teamId, summary: `${event.actor} left the team` };
    case "team.kicked":
      return { entityKind: "team", entityId: event.teamId, summary: `${event.actor} removed ${event.target}` };
    case "team.admin_transferred":
      return { entityKind: "team", entityId: event.teamId, summary: `${event.actor} transferred admin to ${event.target}` };
    case "team.lead_promoted":
      return { entityKind: "team", entityId: event.teamId, summary: `${event.actor} promoted ${event.target} to lead` };
    case "team.lead_demoted":
      return { entityKind: "team", entityId: event.teamId, summary: `${event.actor} changed ${event.target} back to member` };
    case "project.shared_user":
      return { entityKind: "project", entityId: event.projectId, summary: `${event.actor} shared with ${event.target} as ${event.role}` };
    case "project.shared_team":
      return { entityKind: "project", entityId: event.projectId, summary: `${event.actor} shared with team ${event.teamName} as ${event.role}` };
    case "project.unshared_user":
      return { entityKind: "project", entityId: event.projectId, summary: `${event.actor} removed ${event.target}` };
    case "project.unshared_team":
      return { entityKind: "project", entityId: event.projectId, summary: `${event.actor} removed team ${event.teamName}` };
    case "project.deleted":
      return { entityKind: "project", entityId: event.projectId, summary: `${event.actor} deleted the project` };
  }
}

@Injectable()
export class AuditService implements OnModuleInit {
  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    private readonly eventBus: EventBus,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe((event) => this.handle(event));
  }

  async handle(event: DomainEvent): Promise<void> {
    const spec = auditFor(event);
    await this.auditModel.create({
      entityKind: spec.entityKind,
      entityId: spec.entityId,
      action: event.type,
      actorUsername: event.actor,
      summary: spec.summary,
    });
  }

  async getTeamLog(teamId: string, acting: string): Promise<AuditLogResponse> {
    if (!isValidObjectId(teamId)) throw new NotFoundException("Team not found");
    const team = await this.teamModel.findById(teamId).exec();
    if (!team) throw new NotFoundException("Team not found");
    const isManager = team.adminUsername === acting || team.leads.includes(acting);
    if (!isManager) throw new ForbiddenException("Admin or lead only");
    return this.read("team", teamId);
  }

  async getProjectLog(projectId: string, acting: string): Promise<AuditLogResponse> {
    if (!isValidObjectId(projectId)) throw new NotFoundException("Project not found");
    const project = await this.projectModel.findById(projectId).exec();
    if (!project) throw new NotFoundException("Project not found");
    if (project.ownerUsername !== acting) throw new ForbiddenException("Owner only");
    return this.read("project", projectId);
  }

  private async read(entityKind: "team" | "project", entityId: string): Promise<AuditLogResponse> {
    const docs = await this.auditModel
      .find({ entityKind, entityId })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    return { entries: docs.map(toEntry) };
  }
}

function toEntry(doc: AuditLogDocument): AuditLogEntry {
  const createdAt = (doc as AuditLogDocument & { createdAt?: Date }).createdAt ?? new Date();
  return {
    id: String(doc._id),
    action: doc.action,
    actorUsername: doc.actorUsername,
    summary: doc.summary,
    createdAt: createdAt.toISOString(),
  };
}
