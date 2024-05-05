import {MiddlewareConsumer, Module, NestModule} from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Comments, CommentsSchema } from "./schemas/comments.schema";
import { CommentsController } from "./comments.controller";
import cors from 'cors'; // Import the cors module
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
export class CommentsModule implements NestModule{
    configure(consumer: MiddlewareConsumer) {
    consumer.apply(cors()).forRoutes('*'); // Apply CORS middleware globally
  }
}

// export class AppModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer.apply(cors()).forRoutes('*'); // Apply CORS middleware globally
//   }
// }
