import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ValidationService implements OnApplicationBootstrap {
  constructor(private configService: ConfigService) {}
  public async onApplicationBootstrap(): Promise<void> {}
}
