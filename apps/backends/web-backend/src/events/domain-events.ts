export type DomainEvent =
  | { type: "team.invited"; teamId: string; teamName: string; actor: string; target: string }
  | { type: "team.member_joined"; teamId: string; teamName: string; actor: string }
  | { type: "team.left"; teamId: string; teamName: string; actor: string }
  | { type: "team.kicked"; teamId: string; teamName: string; actor: string; target: string }
  | { type: "team.admin_transferred"; teamId: string; teamName: string; actor: string; target: string }
  | { type: "team.lead_promoted"; teamId: string; teamName: string; actor: string; target: string }
  | { type: "team.lead_demoted"; teamId: string; teamName: string; actor: string; target: string }
  | { type: "project.shared_user"; projectId: string; projectName: string; actor: string; target: string; role: string }
  | { type: "project.shared_team"; projectId: string; projectName: string; actor: string; teamId: string; teamName: string; role: string; teamMembers: string[] }
  | { type: "project.unshared_user"; projectId: string; projectName: string; actor: string; target: string }
  | { type: "project.unshared_team"; projectId: string; projectName: string; actor: string; teamId: string; teamName: string }
  | { type: "project.deleted"; projectId: string; projectName: string; actor: string };

export type DomainEventType = DomainEvent["type"];
