import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; 
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private configService: ConfigService) {
        super({
           jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("JWT"),
           ignoreExpiration: false,
           secretOrKey: configService.get<string>('JWT_SECRET_KEY')
        });
    }

    async validate(payload: any) {
        return { user_id: payload.sub, username: payload.username };
    }
}