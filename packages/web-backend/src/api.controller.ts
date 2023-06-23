import { Controller } from '@nestjs/common';
import { ApiService } from './api.service';

@Controller()
export class ApiController {
    constructor(private apiService: ApiService) {}
}