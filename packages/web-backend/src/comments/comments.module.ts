import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Comments, CommentsSchema } from "./schemas/comments.schema";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comments.name, schema: CommentsSchema },
    ]),
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
