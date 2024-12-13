import { Controller, Post, Put, Delete, Body, Param, Request } from "@nestjs/common";
import { MetaTypedModelService } from "./meta-typed-model.service";

@Controller("metadata")
export class MetaTypedModelController {
  constructor(private readonly metaTypedModelService: MetaTypedModelService) {}

  /**
   * Saves metadata for a specific typed model.
   * @param type - The type of the model (e.g., "internal-events", "external-hazards").
   * @param modelId - The ID of the model for which metadata is being saved.
   * @param body - The body containing metadata details.
   * @param body.user_id - The user ID of the metadata owner.
   * @param body.label - The label details (name and optional description).
   * @param body.users - A list of users associated with the metadata.
   * @throws Error if `user_id` is not provided in the body.
   * @returns The saved metadata.
   */
  @Post("/:type/:modelId")
  async saveMetadata(
    @Param("type") type: string,
    @Param("modelId") modelId: string,
    @Body() body: { user_id: number; label: { name: string; description?: string }; users: number[] },
  ) {
    const { user_id, label, users } = body;
    if (!user_id) {
      throw new Error("User ID is required.");
    }
    return this.metaTypedModelService.saveMetadata(type, modelId, user_id, label, users);
  }

  /**
   * Updates metadata for a specific typed model.
   * @param type - The type of the model (e.g., "internal-events", "external-hazards").
   * @param modelId - The ID of the model for which metadata is being updated.
   * @param body - The body containing partial metadata details for update.
   * @param body.label - Optional updated label details (name and description).
   * @param body.users - Optional updated list of users associated with the metadata.
   * @param req - The request object containing user information.
   * @returns The updated metadata.
   */
  @Put("/:type/:modelId")
  async updateMetadata(
    @Param("type") type: string,
    @Param("modelId") modelId: string,
    @Body() body: Partial<{ label: { name: string; description?: string }; users: number[] }>,
    @Request() req: { user: { user_id: number } },
  ) {
    return this.metaTypedModelService.updateMetadata(type, modelId, body); // Pass three arguments
  }

  /**
   * Deletes metadata for a specific typed model.
   * @param type - The type of the model (e.g., "internal-events", "external-hazards").
   * @param modelId - The ID of the model for which metadata is being deleted.
   * @param body - The body containing the user ID for deletion validation.
   * @param body.user_id - The user ID associated with the metadata to be deleted.
   * @throws Error if `user_id` is not provided in the body.
   * @returns The deleted metadata or null if no metadata is found.
   */
  @Delete("/:type/:modelId")
  async deleteMetadata(
    @Param("type") type: string,
    @Param("modelId") modelId: string,
    @Body() body: { user_id: number },
  ) {
    const { user_id } = body;

    if (!user_id) {
      throw new Error("User ID is required.");
    }
    return this.metaTypedModelService.deleteMetadata(type, modelId, user_id);
  }
}
