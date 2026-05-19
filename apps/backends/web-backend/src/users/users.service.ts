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
  UpdateNotificationPrefsRequest,
  UpdateUserProfileRequest,
  UserProfile,
} from "interfaces-shared-types";
import { User, type UserDocument } from "./user.schema";
import { Project, type ProjectDocument } from "../projects/project.schema";
import { Team, type TeamDocument } from "../teams/team.schema";
import { StorageService } from "./storage.service";

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
  };
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
    private readonly jwtService: JwtService,
    private readonly storage: StorageService,
  ) {}

  async getMyProfile(username: string): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    return toDtoWithStorage(doc, this.storage);
  }

  async updateMyProfile(username: string, payload: UpdateUserProfileRequest): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    if (payload.fullName !== undefined) doc.fullName = payload.fullName;
    if (payload.organization !== undefined) doc.organization = payload.organization;
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

  async changeEmail(username: string, payload: ChangeEmailRequest): Promise<{ profile: UserProfile; token: string }> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    const valid = await argon2.verify(doc.passwordHash, payload.currentPassword);
    if (!valid) throw new UnauthorizedException("Current password is incorrect");
    const nextEmail = payload.newEmail.toLowerCase();
    if (nextEmail === doc.email) throw new ConflictException("That is already your email");
    const existing = await this.userModel.findOne({ email: nextEmail }).lean();
    if (existing) throw new ConflictException("Email already in use");
    doc.email = nextEmail;
    await doc.save();
    const token = await this.signToken(doc);
    return { profile: toDtoWithStorage(doc, this.storage), token };
  }

  async changeUsername(username: string, payload: ChangeUsernameRequest): Promise<{ profile: UserProfile; token: string }> {
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
    const token = await this.signToken(doc);
    return { profile: toDtoWithStorage(doc, this.storage), token };
  }

  async changePassword(username: string, payload: ChangePasswordRequest): Promise<void> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    const valid = await argon2.verify(doc.passwordHash, payload.currentPassword);
    if (!valid) throw new UnauthorizedException("Current password is incorrect");
    if (payload.currentPassword === payload.newPassword) {
      throw new ConflictException("New password must differ from current");
    }
    doc.passwordHash = await argon2.hash(payload.newPassword);
    await doc.save();
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
    const valid = await argon2.verify(doc.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException("Current password is incorrect");
    const adminTeams = await this.teamModel.find({ adminUsername: username }).exec();
    for (const team of adminTeams) {
      await team.deleteOne();
    }
    await this.teamModel.updateMany(
      { $or: [{ members: username }, { leads: username }, { invited: username }] },
      { $pull: { members: username, leads: username, invited: username } },
    );
    await this.projectModel.deleteMany({ ownerUsername: username });
    await this.projectModel.updateMany(
      { "sharedUsers.username": username },
      { $pull: { sharedUsers: { username } } },
    );
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

  private async signToken(doc: UserDocument): Promise<string> {
    return this.jwtService.signAsync({
      sub: String(doc._id),
      username: doc.username,
      email: doc.email,
      roles: doc.roles,
    });
  }
}

export { validateUsernameCharacters };
