import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/**
* 1. The Local Strategy (AuthGuard('local')) gets the User credentials (username and password) from the request body.
*    The credentials are then sent to the validate() method.
* 2. The validate() method checks whether the user is in the database using the AuthService.loginUser() method.
*/
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super();
    }

    async validate(username: string, password: string): Promise<any> {
        const user = await this.authService.loginUser(username, password);
        if(!user) {
            throw new UnauthorizedException('User credentials are not valid!');
        }
        return user;
    }
}