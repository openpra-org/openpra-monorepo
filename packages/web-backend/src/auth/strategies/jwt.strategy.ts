import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; 
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/* 
1.  The JWT Strategy (AuthGuard('jwt')) is going to extract the 'Authorization' property from the request header.
    The Authorization property has the format: 'JWT <token>'.
    This <token> is extracted and then the expiration is checked (the token expires 24 hours after it is generated).
    The encrypted information (the User object) from the token is decrypted using a 'secret key' known by the user only.
    The secret key is set as an environment variable ('JWT_SECRET_KEY') in '.env' file.
2.  After decrypting the User object, it is sent to the validate function where the User data (userID, username, email) is separated.
*/
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private configService: ConfigService) {
        super({
           jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('JWT'),
           ignoreExpiration: false,
           secretOrKey: configService.get<string>('JWT_SECRET_KEY')
        });
    }

    async validate(payload: any) {
        return { user_id: payload.user_id, username: payload.username, email: payload.email };
    }
}