import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { Model } from "mongoose";
import * as argon2 from "argon2";
import type {
  ChangeEmailRequest,
  ChangeUsernameRequest,
  ChangePasswordRequest,
  NotificationPrefs,
  OAuthProvider,
  PublicUserProfile,
  TwoFactorDisableResponse,
  TwoFactorEnableResponse,
  TwoFactorSetupResponse,
  UpdateNotificationPrefsRequest,
  UpdateUserProfileRequest,
  UserProfile,
  UserSearchHit,
  UserSearchResponse,
} from "interfaces-shared-types";
import { User, type UserDocument } from "./user.schema";
import { Project, type ProjectDocument } from "../projects/project.schema";
import { Team, type TeamDocument } from "../teams/team.schema";
import { Notification, type NotificationDocument } from "../notifications/notification.schema";
import { StorageService } from "./storage.service";
import { TwoFactorService } from "../auth/twoFactor.service";
import { SessionsService } from "../sessions/sessions.service";
import { EventBus } from "../events/event-bus";
import { OrgsService } from "../orgs/orgs.service";

const AVATAR_FOLDER = "avatars";
const COVER_FOLDER = "covers";

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMemberSince(createdAt: Date | undefined): string {
  if (!createdAt) return "Recently";
  return createdAt.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function toDtoWithStorage(doc: UserDocument, storage: StorageService): UserProfile {
  const createdAt = (doc as UserDocument & { createdAt?: Date }).createdAt;
  return {
    username: doc.username,
    email: doc.email,
    fullName: doc.fullName,
    organization: doc.organization,
    title: doc.title,
    bio: doc.bio,
    altEmail: doc.altEmail,
    phone: doc.phone,
    linkedin: doc.linkedin,
    initials: computeInitials(doc.fullName),
    memberSince: formatMemberSince(createdAt),
    avatarUrl: storage.urlForKey(doc.avatarKey),
    coverUrl: storage.urlForKey(doc.coverKey),
    twoFactorEnabled: doc.twoFactor?.enabled ?? false,
    hasPassword: doc.passwordHash !== null,
    connectedAccounts: doc.connectedAccounts.map((c) => ({ provider: c.provider as OAuthProvider, displayName: c.displayName })),
  };
}

function toPublicProfile(doc: UserDocument, storage: StorageService): PublicUserProfile {
  const createdAt = (doc as UserDocument & { createdAt?: Date }).createdAt;
  return {
    username: doc.username,
    fullName: doc.fullName,
    organization: doc.organization,
    title: doc.title,
    bio: doc.bio,
    linkedin: doc.linkedin,
    initials: computeInitials(doc.fullName),
    memberSince: formatMemberSince(createdAt),
    avatarUrl: storage.urlForKey(doc.avatarKey),
    coverUrl: storage.urlForKey(doc.coverKey),
  };
}

function toSearchHit(doc: UserDocument, storage: StorageService): UserSearchHit {
  return {
    username: doc.username,
    fullName: doc.fullName,
    initials: computeInitials(doc.fullName),
    organization: doc.organization,
    avatarUrl: storage.urlForKey(doc.avatarKey),
  };
}

function escapeForRegex(input: string): string {
  let out = "";
  for (const ch of input) {
    if (".*+?^${}()|[]\\".indexOf(ch) >= 0) out += "\\";
    out += ch;
  }
  return out;
}

function isUsernameCharValid(ch: string): boolean {
  if (ch.length !== 1) return false;
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return true;
  if (code >= 65 && code <= 90) return true;
  if (code >= 97 && code <= 122) return true;
  if (ch === "_" || ch === "-") return true;
  return false;
}

function validateUsernameCharacters(username: string): boolean {
  return Array.from(username).every(isUsernameCharValid);
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    private readonly jwtService: JwtService,
    private readonly storage: StorageService,
    private readonly twoFactorService: TwoFactorService,
    private readonly sessionsService: SessionsService,
    private readonly eventBus: EventBus,
    private readonly orgsService: OrgsService,
  ) {}

  async getMyProfile(username: string): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    return toDtoWithStorage(doc, this.storage);
  }

  async getPublicProfile(username: string): Promise<PublicUserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    return toPublicProfile(doc, this.storage);
  }

  async searchUsers(query: string, actingUsername: string): Promise<UserSearchResponse> {
    const q = query.trim();
    if (q.length < 2) return { users: [] };
    const re = new RegExp(escapeForRegex(q), "i");
    const docs = await this.userModel
      .find({
        username: { $ne: actingUsername },
        $or: [{ username: re }, { fullName: re }],
      })
      .sort({ username: 1 })
      .limit(20)
      .exec();
    return { users: docs.map((d) => toSearchHit(d, this.storage)) };
  }

  async updateMyProfile(username: string, payload: UpdateUserProfileRequest): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (payload.fullName !== undefined) doc.fullName = payload.fullName;
    if (payload.organization !== undefined) {
      const resolved = await this.orgsService.findOrCreate(payload.organization, username);
      doc.organization = resolved?.name ?? "";
      doc.organizationId = resolved?.id ?? null;
    }
    if (payload.title !== undefined) doc.title = payload.title;
    if (payload.bio !== undefined) doc.bio = payload.bio;
    if (payload.altEmail !== undefined) doc.altEmail = payload.altEmail;
    if (payload.phone !== undefined) doc.phone = payload.phone;
    if (payload.linkedin !== undefined) doc.linkedin = payload.linkedin;
    await doc.save();
    return toDtoWithStorage(doc, this.storage);
  }

  async getMyProjectCount(username: string): Promise<number> {
    return this.projectModel.countDocuments({ ownerUsername: username }).exec();
  }

  async changeEmail(username: string, payload: ChangeEmailRequest, jti: string): Promise<{ profile: UserProfile; token: string }> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (doc.passwordHash === null) throw new UnauthorizedException("No password is set on this account");
    const valid = await argon2.verify(doc.passwordHash, payload.currentPassword);
    if (!valid) throw new UnauthorizedException("Current password is incorrect");
    const nextEmail = payload.newEmail.toLowerCase();
    if (nextEmail === doc.email) throw new ConflictException("That is already your email");
    const existing = await this.userModel.findOne({ email: nextEmail }).lean();
    if (existing) throw new ConflictException("Email already in use");
    doc.email = nextEmail;
    await doc.save();
    const token = await this.signToken(doc, jti);
    return { profile: toDtoWithStorage(doc, this.storage), token };
  }

  async changeUsername(username: string, payload: ChangeUsernameRequest, jti: string): Promise<{ profile: UserProfile; token: string }> {
    const next = payload.newUsername;
    if (!validateUsernameCharacters(next)) {
      throw new ConflictException("Username may only contain letters, digits, '_', or '-'");
    }
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (next === doc.username) throw new ConflictException("That is already your username");
    const existing = await this.userModel.findOne({ username: next }).lean();
    if (existing) throw new ConflictException("Username already taken");
    doc.username = next;
    await doc.save();
    const token = await this.signToken(doc, jti);
    return { profile: toDtoWithStorage(doc, this.storage), token };
  }

  async changePassword(username: string, payload: ChangePasswordRequest): Promise<void> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (doc.passwordHash === null) throw new UnauthorizedException("No password is set on this account");
    const valid = await argon2.verify(doc.passwordHash, payload.currentPassword);
    if (!valid) throw new UnauthorizedException("Current password is incorrect");
    if (payload.currentPassword === payload.newPassword) {
      throw new ConflictException("New password must differ from current");
    }
    doc.passwordHash = await argon2.hash(payload.newPassword);
    await doc.save();
  }

  async beginTwoFactorSetup(username: string): Promise<TwoFactorSetupResponse> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (doc.twoFactor?.enabled) throw new ConflictException("Two-factor authentication is already enabled");
    const secret = this.twoFactorService.createSecret();
    doc.twoFactor = { enabled: false, secret: null, pendingSecret: this.twoFactorService.encrypt(secret), backupCodes: [] };
    doc.markModified("twoFactor");
    await doc.save();
    return { otpauthUri: this.twoFactorService.buildUri(secret, doc.email), secret };
  }

  async enableTwoFactor(username: string, code: string): Promise<TwoFactorEnableResponse> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (doc.twoFactor?.enabled) throw new ConflictException("Two-factor authentication is already enabled");
    const pending = doc.twoFactor?.pendingSecret;
    if (!pending) throw new BadRequestException("Start two-factor setup first");
    const secret = this.twoFactorService.decrypt(pending);
    const valid = await this.twoFactorService.verifyTotp(secret, code);
    if (!valid) throw new UnauthorizedException("Invalid authentication code");
    const backupCodes = this.twoFactorService.generateBackupCodes();
    doc.twoFactor = {
      enabled: true,
      secret: pending,
      pendingSecret: null,
      backupCodes: await this.twoFactorService.hashBackupCodes(backupCodes),
    };
    doc.markModified("twoFactor");
    await doc.save();
    return { backupCodes };
  }

  async disableTwoFactor(username: string, code: string): Promise<TwoFactorDisableResponse> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (!doc.twoFactor?.enabled || doc.twoFactor.secret === null) {
      throw new ConflictException("Two-factor authentication is not enabled");
    }
    const secret = this.twoFactorService.decrypt(doc.twoFactor.secret);
    let valid = await this.twoFactorService.verifyTotp(secret, code);
    if (!valid) {
      const index = await this.twoFactorService.findBackupCodeIndex(doc.twoFactor.backupCodes, code);
      if (index >= 0) valid = true;
    }
    if (!valid) throw new UnauthorizedException("Invalid authentication code");
    doc.twoFactor = { enabled: false, secret: null, pendingSecret: null, backupCodes: [] };
    doc.markModified("twoFactor");
    await doc.save();
    return { detail: "Two-factor authentication disabled" };
  }

  async disconnectProvider(username: string, provider: string): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    const isLinked = doc.connectedAccounts.some((c) => c.provider === provider);
    if (!isLinked) throw new ConflictException("That connection is not linked");
    const remaining = doc.connectedAccounts.filter((c) => c.provider !== provider);
    const credentialsLeft = (doc.passwordHash !== null ? 1 : 0) + remaining.length;
    if (credentialsLeft === 0) {
      throw new ConflictException("Set a password before disconnecting your only sign-in method");
    }
    doc.connectedAccounts = remaining;
    doc.markModified("connectedAccounts");
    await doc.save();
    return toDtoWithStorage(doc, this.storage);
  }

  async getNotificationPrefs(username: string): Promise<NotificationPrefs> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    return doc.prefs.notify;
  }

  async updateNotificationPrefs(username: string, payload: UpdateNotificationPrefsRequest): Promise<NotificationPrefs> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    const next = { ...doc.prefs.notify };
    if (payload.projectShared !== undefined) next.projectShared = payload.projectShared;
    if (payload.teamInvite !== undefined) next.teamInvite = payload.teamInvite;
    if (payload.runFinished !== undefined) next.runFinished = payload.runFinished;
    if (payload.quantErrors !== undefined) next.quantErrors = payload.quantErrors;
    doc.prefs = { notify: next };
    doc.markModified("prefs");
    await doc.save();
    return next;
  }

  async deleteMyAccount(username: string, currentPassword: string): Promise<void> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (doc.passwordHash !== null) {
      const valid = await argon2.verify(doc.passwordHash, currentPassword);
      if (!valid) throw new UnauthorizedException("Current password is incorrect");
    }

    const adminTeams = await this.teamModel.find({ adminUsername: username }).exec();
    for (const team of adminTeams) {
      const successor = team.leads.find((u) => u !== username) ?? team.members.find((u) => u !== username) ?? null;
      if (successor === null) {
        const teamId = String(team._id);
        const avatarKey = team.avatarKey;
        await team.deleteOne();
        await this.storage.deleteByKey(avatarKey);
        await this.projectModel.updateMany({ "sharedTeams.teamId": teamId }, { $pull: { sharedTeams: { teamId } } });
      } else {
        team.adminUsername = successor;
        team.leads = team.leads.filter((u) => u !== successor && u !== username);
        team.members = team.members.filter((u) => u !== username);
        await team.save();
        await this.eventBus.emit({
          type: "team.admin_transferred",
          teamId: String(team._id),
          teamName: team.name,
          actor: username,
          target: successor,
        });
      }
    }

    await this.teamModel.updateMany(
      { $or: [{ members: username }, { leads: username }, { "invites.username": username }] },
      { $pull: { members: username, leads: username, invites: { username } } },
    );
    await this.projectModel.deleteMany({ ownerUsername: username });
    await this.projectModel.updateMany(
      { "sharedUsers.username": username },
      { $pull: { sharedUsers: { username } } },
    );
    await this.sessionsService.revokeAllForUser(String(doc._id));
    await this.notificationModel.deleteMany({ recipientUsername: username }).exec();
    await this.storage.deleteByKey(doc.avatarKey);
    await this.storage.deleteByKey(doc.coverKey);
    await doc.deleteOne();
  }

  async setAvatar(username: string, file: { buffer: Buffer; mimetype: string; size: number; originalname: string }): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (!this.storage.isAllowedMime(file.mimetype)) {
      throw new BadRequestException("Only PNG, JPEG, or WebP images are allowed");
    }
    const previousKey = doc.avatarKey;
    const nextKey = await this.storage.uploadImage(AVATAR_FOLDER, username, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
    });
    doc.avatarKey = nextKey;
    await doc.save();
    await this.storage.deleteByKey(previousKey);
    return toDtoWithStorage(doc, this.storage);
  }

  async clearAvatar(username: string): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    const previousKey = doc.avatarKey;
    doc.avatarKey = null;
    await doc.save();
    await this.storage.deleteByKey(previousKey);
    return toDtoWithStorage(doc, this.storage);
  }

  async setCover(username: string, file: { buffer: Buffer; mimetype: string; size: number; originalname: string }): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (!this.storage.isAllowedMime(file.mimetype)) {
      throw new BadRequestException("Only PNG, JPEG, or WebP images are allowed");
    }
    const previousKey = doc.coverKey;
    const nextKey = await this.storage.uploadImage(COVER_FOLDER, username, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
    });
    doc.coverKey = nextKey;
    await doc.save();
    await this.storage.deleteByKey(previousKey);
    return toDtoWithStorage(doc, this.storage);
  }

  async clearCover(username: string): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    const previousKey = doc.coverKey;
    doc.coverKey = null;
    await doc.save();
    await this.storage.deleteByKey(previousKey);
    return toDtoWithStorage(doc, this.storage);
  }

  private async signToken(doc: UserDocument, jti: string): Promise<string> {
    return this.jwtService.signAsync({
      sub: String(doc._id),
      username: doc.username,
      email: doc.email,
      roles: doc.roles,
      jti,
    });
  }
}

export { validateUsernameCharacters };
