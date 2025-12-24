import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../../collab/schemas/user.schema';

/**
 * 1. The Local Strategy (AuthGuard('local')) gets the User credentials (username and password) from the request body.
 *    The credentials are then sent to the validate() method.
 * 2. The validate() method checks whether the user is in the database using the AuthService.loginUser() method.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  /**
   * Instantiate the Local strategy.
   *
   * @param authService - Service used to validate user credentials.
   */
  constructor(private readonly authService: AuthService) {
    super();
  }
  /**
   * Validate credentials coming from the local strategy.
   *
   * @param username - Username provided via request body.
   * @param password - Password provided via request body.
   * @returns Authenticated User or throws UnauthorizedException.
   */
  async validate(
    username: string,
    password: string,
  ): Promise<User | UnauthorizedException> {
    const user = await this.authService.loginUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return user;
  }
}
