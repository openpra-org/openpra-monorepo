import { BadRequestException, Injectable, NotFoundException, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Roles, RolesDocument } from "./schemas/roles.schema";
import { PredefinedRoles, Role } from "./schemas/predefined-roles";
@Injectable()
export class RolesService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Roles.name)
    private readonly roleModel: Model<RolesDocument>,
  ) {}
  onApplicationBootstrap(): void {
    PredefinedRoles.forEach((element) => {
      void this.roleModel.findOne({ id: element.id }).then((res) => {
        if (res === null) {
          void this.roleModel.insertMany(element);
        }
      });
    });
  }
  async getAllRoles(roleId?: string[] | null): Promise<Roles[]> {
    let roles: Roles[];
    if (roleId !== undefined && roleId.length > 0) {
      roles = await this.roleModel.find({ id: { $in: roleId } }).exec();
    } else {
      roles = await this.roleModel.find().exec();
    }
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      permissions: role.permissions,
    }));
  }
  async getRole(id: string): Promise<Roles> {
    const role = await this.roleModel.findOne({ id: id }).exec();
    if (role === null) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }
  async createRole(role: Role): Promise<void> {
    const checkRole = await this.roleModel.findOne({ id: role.id }).exec();
    if (checkRole !== null) {
      throw new BadRequestException(`Role with Id ${role.id} already exists`);
    }
    await this.roleModel.insertMany([role]);
  }
  async updateRole(role: Role): Promise<void> {
    const checkRole = await this.roleModel.findOne({ id: role.id }).exec();
    if (checkRole === null) {
      throw new BadRequestException(`Role with Id ${role.id} not found`);
    }
    await this.roleModel.findOneAndUpdate({ id: role.id }, role).exec();
  }
  async deleteRole(id: string): Promise<void> {
    const checkRole = await this.roleModel.findOne({ id: id }).exec();
    if (checkRole === null) {
      throw new BadRequestException(`Role with Id ${id} doesn't exist`);
    }
    await this.roleModel.findOneAndDelete({ id: id }).exec();
  }
}
