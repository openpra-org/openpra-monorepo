import { Controller, Post, Put, Delete, Body, Param, Request } from "@nestjs/common";
import { MetaTypedModelService } from "./meta-typed-model.service";

@Controller("metadata")
export class MetaTypedModelController {
  constructor(private readonly metaTypedModelService: MetaTypedModelService) {}

  // Save metadata for a specific model
  @Post("/:type/:modelId")
  async saveMetadata(
    @Param("type") type: string,
    @Param("modelId") modelId: string,
    @Body() body: { label: { name: string; description?: string }; users: number[] },
    @Request() req: { user: { user_id: number } },
  ) {
    const { label, users } = body;
    return this.metaTypedModelService.saveMetadata(type, modelId, req.user.user_id, label, users);
  }

  // Update metadata for a specific model
  @Put("/:type/:modelId")
  async updateMetadata(
    @Param("type") type: string,
    @Param("modelId") modelId: string,
    @Body() body: Partial<{ label: { name: string; description?: string }; users: number[] }>,
    @Request() req: { user: { user_id: number } },
  ) {
    return this.metaTypedModelService.updateMetadata(type, modelId, body); // Pass three arguments
  }

  // Delete metadata for a specific model
  @Delete("/:type/:modelId")
  async deleteMetadata(
    @Param("type") type: string,
    @Param("modelId") modelId: string,
    @Request() req: { user: { user_id: number } },
  ) {
    return this.metaTypedModelService.deleteMetadata(type, modelId, req.user.user_id);
  }
}
