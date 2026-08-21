import { Module } from "@nestjs/common";
import { ProjectsModule } from "../../projects/projects.module";
import { NewlyDevelopedMethodsSharedModule } from "../shared/newly-developed-methods-shared.module";
import { FaultTreeBasicEventCataloguesController } from "./fault-tree-basic-event-catalogues.controller";
import { FaultTreeBasicEventCataloguesService } from "./fault-tree-basic-event-catalogues.service";

@Module({
  imports: [NewlyDevelopedMethodsSharedModule, ProjectsModule],
  controllers: [FaultTreeBasicEventCataloguesController],
  providers: [FaultTreeBasicEventCataloguesService],
  exports: [FaultTreeBasicEventCataloguesService],
})
export class FaultTreeModule {}
