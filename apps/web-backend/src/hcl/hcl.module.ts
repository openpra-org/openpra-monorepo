import { Module } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as AutoIncrementFactory from 'mongoose-sequence';
import { HclController } from './hcl.controller';
import { HclService } from './hcl.service';
import { GlobalParameter, GlobalParameterSchema } from './schemas/global-parameter.schema';
import { HclModel, HclModelSchema } from './schemas/hcl-model.schema';
import { HclModelTree, HclModelTreeSchema } from './schemas/hcl-model-tree.schema';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: HclModel.name,
        useFactory: async(connection: Connection) => {
            const hclModelSchema = HclModelSchema;
            const AutoIncrement = AutoIncrementFactory(connection);
            hclModelSchema.plugin(AutoIncrement, {inc_field: 'model_id'});
            return hclModelSchema;
        },
        inject: [getConnectionToken()]
      }
    ]),
    MongooseModule.forFeatureAsync([
      {
        name: GlobalParameter.name,
        useFactory: async(connection: Connection) => {
            const globalParameterSchema = GlobalParameterSchema;
            const AutoIncrement = AutoIncrementFactory(connection);
            globalParameterSchema.plugin(AutoIncrement, {inc_field: 'pk'});
            return globalParameterSchema;
        },
        inject: [getConnectionToken()]
      }
    ]),
    MongooseModule.forFeature([{ name: HclModelTree.name, schema: HclModelTreeSchema }])
  ],
  controllers: [HclController],
  providers: [HclService]
})

export class HclModule {}