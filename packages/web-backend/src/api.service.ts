import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiService {
  public getHello(): string {
    return "Hello World!";
  }
}
