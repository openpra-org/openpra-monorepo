import { Injectable } from '@nestjs/common';
import { HclService } from './hcl/hcl.service';

@Injectable()
export class ApiService {
    constructor(private hclService: HclService) {}

    /* Since right now only the HCL Model is supported, the app is going to look for HCL models that match with the provided keywords. */
    async searchCollabModel(user_id: number, key: string, type: string, url: string, limit?:any, offset?:any) {
        if(limit && offset) {
            return this.hclService.searchHclModel(user_id, key, type, url, limit, offset);
        } else {
            return this.hclService.searchHclModel(user_id, key, type, url, undefined, undefined);
        }
    }
}