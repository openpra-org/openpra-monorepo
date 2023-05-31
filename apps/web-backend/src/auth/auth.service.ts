import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import pbkdf2 from 'pbkdf2-passworder';
import { CollabService } from '../collab/collab.service';

@Injectable()
export class AuthService {
    constructor(
        private collabService: CollabService,
        private jwtService: JwtService
    ) {}

    async loginUser(username: string, password: string): Promise<any> {
        const user = await this.collabService.loginUser(username);
        if(user) {
            const validUser = await pbkdf2.compare(user.password, password);
            if(validUser) {
                return user;
            } else {
                throw new UnauthorizedException('Password does not match!');
            }
        } else {
            throw new UnauthorizedException('User not found!');
        }
    }

    async getJwtToken(user: any) {
        const payload = { username: user.username, sub: user.id };
        return {
            token: this.jwtService.sign(payload)
        };
    }
}
