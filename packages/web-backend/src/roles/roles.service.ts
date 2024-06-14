import { BadRequestException, Injectable, NotFoundException, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RoleSchemaDto } from "shared-types/src/openpra-zod-mef/role/role-schema";
import { PredefinedRoles } from "shared-types/src/lib/data/predefiniedRoles";
import { Roles, RolesDocument } from "./schemas/roles.schema";

@Injectable()
export class RolesService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Roles.name)
    private readonly roleModel: Model<RolesDocument>,
  ) {}

  /**
   * This is a bootstrap function, called before routes are loaded by the application.
   * This will load all the predefined roles defined in the predefiniedRoles.ts file.
   * We can edit the predefinedRoles file to load even more predefined roles if required in the future
   */
  onApplicationBootstrap(): void {
    PredefinedRoles.forEach((element) => {
      void this.roleModel.findOne({ id: element.id }).then((res) => {
        if (res === null) {
          void this.roleModel.insertMany(element);
        }
      });
    });
  }

  /**
   * This function returns all the roles from the database
   */
  async getAllRoles(roleId: string[] | null): Promise<RoleSchemaDto[]> {
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

  /**
   * Get a single role by Id or return NotFoundException if id doesnt exist
   * @param id - The unique Id for the role
   */
  async getRole(id: string): Promise<RoleSchemaDto> {
    const role = await this.roleModel.findOne({ id: id }).exec();
    if (role === null) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  /**
   * Create a single role from a RoleDTO object
   * @param role - The RoleDTO object
   */
  async createRole(role: RoleSchemaDto): Promise<void> {
    const checkRole = await this.roleModel.findOne({ id: role.id }).exec();
    if (checkRole !== null) {
      throw new BadRequestException(`Role with Id ${role.id} already exists`);
    }
    await this.roleModel.insertMany([role]);
  }

  /**
   * Update an existing role in the database
   * @param role - The RoleDTO object
   */
  async updateRole(role: RoleSchemaDto): Promise<void> {
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
