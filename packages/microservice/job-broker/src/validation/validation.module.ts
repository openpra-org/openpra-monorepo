import { Module } from "@nestjs/common";
import { ValidationService } from "./validation.service";

@Module({
  providers: [ValidationService],
})
export class ValidationModule {}
