import { Module } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as AutoIncrementFactory from 'mongoose-sequence';
import { CollabController } from './collab.controller';
import { CollabService } from './collab.service';
import { User, UserSchema } from "./schemas/user.schema";

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: User.name,
        useFactory: async(connection: Connection) => {
          const userSchema = UserSchema;
          const AutoIncrement = AutoIncrementFactory(connection);
          userSchema.plugin(AutoIncrement, {inc_field: 'id'});
          return userSchema;
        },
        inject: [getConnectionToken()]
      }
    ])
  ],
  controllers: [CollabController],
  providers: [CollabService],
  exports: [CollabService]
})

export class CollabModule {}