import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersService } from "./users.service";
import { UsersResolver } from "./users.resolver";
import { UsersGqlSchema } from "./users.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: "UserGql", schema: UsersGqlSchema }])],
  providers: [UsersResolver, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
