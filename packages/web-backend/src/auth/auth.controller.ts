import { Controller, Options, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

/*
    1.  User credentials (username, password) are verified through 'Local Strategy' (AuthGuard('local')).
        After verification the User object is attached with the request header.
    2.  Then a JWT is generated against the User data (id, username, email) using the AuthService.getJwtToken() method.
        The token is attached as 'Authorization' property with each request header in 'JWT <token>' format.
    3.  'JWT Strategy' (AuthGuard('jwt')) extracts this token, verifies the expiration date, decrypts the token and retrieves the User data.
        After retrieval, the User data is attached with the request as an object called 'user'.
*/
@Controller()
export class AuthController {
    constructor(private authService: AuthService) {}

    @Options('/token-obtain/')
    async loginUser_Options() {}

    @UseGuards(AuthGuard('local'))
    @Post('/token-obtain/')
    async loginUser(@Request() req) {
        return this.authService.getJwtToken(req.user);
    }
}
