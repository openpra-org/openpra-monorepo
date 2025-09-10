import { IsEmail } from 'class-validator';

export class RequestResetPasswordDto {
  @IsEmail()
  email: string;
}
