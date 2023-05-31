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

    /* 
        1. The Local Strategy (AuthGuard('local')) sends the User credentials to loginUser() method.    
        2. The loginUser() method checks if the User exists in the database using the CollabService.loginUser() method.
        3. If the User exists, then the password is verified as well.
    */
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

    /*
        1. After the Local Strategy verifies the User credentials, the User object is sent to getJwtToken() method.
        2. The userID, username, and email is extracted from the User object. Then a JWT is generated against these data.
    */
    async getJwtToken(user: any) {
        const payload = { user_id: user.id, username: user.username, email: user.email };
        await this.collabService.updateLastLogin(user.id);
        return {
            token: this.jwtService.sign(payload)
        };
    }
}