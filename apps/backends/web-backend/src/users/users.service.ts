import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { UpdateUserProfileRequest, UserProfile } from "interfaces-shared-types";
import { User, type UserDocument } from "./user.schema";
import { Project, type ProjectDocument } from "../projects/project.schema";

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

function toDto(doc: UserDocument): UserProfile {
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
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
  ) {}

  async getMyProfile(username: string): Promise<UserProfile> {
    const doc = await this.userModel.findOne({ username }).exec();
    if (!doc) throw new NotFoundException("User not found");
    return toDto(doc);
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
    return toDto(doc);
  }

  async getMyProjectCount(username: string): Promise<number> {
    return this.projectModel.countDocuments({ ownerUsername: username }).exec();
  }
}
