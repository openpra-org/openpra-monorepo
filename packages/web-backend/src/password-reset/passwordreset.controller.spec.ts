import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetController } from './passwordreset.controller';
import { PasswordResetService } from './passwordreset.service';
import { MailerService } from './mailer.service';
import { Response } from 'express';
import { HttpException } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { THROTTLER_OPTIONS } from '@nestjs/throttler/dist/throttler.constants';

describe('PasswordResetController', () => {
  let controller: PasswordResetController;
  let passwordResetService: PasswordResetService;
  let mailerService: MailerService;

  beforeEach(async () => {
    const mockPasswordResetService = {
      validateEmail: jest.fn(),
      addPasswordResetEntry: jest.fn(),
      getUserByToken: jest.fn(),
      updatePassword: jest.fn(),
      deleteEntry: jest.fn(),
    };

    const mockMailerService = {
      sendMail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasswordResetController],
      providers: [
        { provide: PasswordResetService, useValue: mockPasswordResetService },
        { provide: MailerService, useValue: mockMailerService },
        ThrottlerGuard,
        Reflector,
        {
          provide: THROTTLER_OPTIONS,
          useValue: { ttl: 60, limit: 10 },
        },
        {
          provide: ThrottlerStorage,
          useValue: {
            getRecord: jest.fn().mockReturnValue([]),
            addRecord: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PasswordResetController>(PasswordResetController);
    passwordResetService = module.get<PasswordResetService>(PasswordResetService);
    mailerService = module.get<MailerService>(MailerService);

    // Simulate environment variables
    (controller as any).FRONTEND_URL = 'http://localhost';
    process.env.BACKEND_URL = 'http://localhost';
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('renderEmailRequestForm', () => {
    it('should return "Password Reset Form"', () => {
      const result = controller.renderEmailRequestForm();
      expect(result).toBe('Password Reset Form');
    });
  });

  describe('validatePasswordResetRequest', () => {
    it('should return generic message and send email if email is valid', async () => {
      const mockEmail = 'test@example.com';
      const mockToken = '12345-token';
      const mockResetLink = `http://localhost/api/password-reset/create-new-password/?token=${mockToken}`;

      passwordResetService.validateEmail.mockResolvedValue(true);
      passwordResetService.addPasswordResetEntry.mockResolvedValue({
        status: true,
        token: mockToken,
      });
      mailerService.sendMail.mockResolvedValue(undefined);

      const response = await controller.validatePasswordResetRequest(mockEmail);

      expect(passwordResetService.validateEmail).toHaveBeenCalledWith(mockEmail);
      expect(passwordResetService.addPasswordResetEntry).toHaveBeenCalledWith(mockEmail);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        mockEmail,
        'Password Reset Instructions',
        expect.stringContaining(mockResetLink),
        expect.stringContaining(`<a href="${mockResetLink}">${mockResetLink}</a>`)
      );
      expect(response).toEqual({
        message: 'If an account with that email exists, instructions have been sent.',
      });
    });

    it('should return generic message and not send email if email is invalid', async () => {
      const mockEmail = 'invalid@example.com';
      passwordResetService.validateEmail.mockResolvedValue(false);

      const response = await controller.validatePasswordResetRequest(mockEmail);

      expect(passwordResetService.validateEmail).toHaveBeenCalledWith(mockEmail);
      expect(passwordResetService.addPasswordResetEntry).not.toHaveBeenCalled();
      expect(mailerService.sendMail).not.toHaveBeenCalled();
      expect(response).toEqual({
        message: 'If an account with that email exists, instructions have been sent.',
      });
    });
  });

  describe('renderCreateNewPasswordForm', () => {
    it('should redirect to success URL if token is valid', async () => {
      const mockToken = 'valid-token';
      const mockUser = { email: 'user@example.com' };
      const mockRes = { redirect: jest.fn() } as any as Response;

      passwordResetService.getUserByToken.mockResolvedValue(mockUser);

      await controller.renderCreateNewPasswordForm(mockToken, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        `http://localhost/create-new-password?token=${encodeURIComponent(mockToken)}`
      );
    });

    it('should redirect to failure URL if token is invalid', async () => {
      const mockToken = 'invalid-token';
      const mockRes = { redirect: jest.fn() } as any as Response;

      passwordResetService.getUserByToken.mockResolvedValue(null);

      await controller.renderCreateNewPasswordForm(mockToken, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(`http://localhost/error`);
    });
  });

  describe('createNewPassword', () => {
    it('should throw if token or password is missing', async () => {
      await expect(controller.createNewPassword('', 'token')).rejects.toThrow(HttpException);
      await expect(controller.createNewPassword('pass', '')).rejects.toThrow(HttpException);
    });

    it('should throw if token is invalid', async () => {
      passwordResetService.getUserByToken.mockResolvedValue(null);
      await expect(controller.createNewPassword('pass', 'badtoken')).rejects.toThrow('Invalid or expired token');
    });

    it('should throw if updatePassword fails', async () => {
      const mockUser = { email: 'user@example.com' };
      passwordResetService.getUserByToken.mockResolvedValue(mockUser);
      passwordResetService.updatePassword.mockResolvedValue(false);
      await expect(controller.createNewPassword('pass', 'token')).rejects.toThrow('Failed to update password');
    });

    it('should throw if deleteEntry fails', async () => {
      const mockUser = { email: 'user@example.com' };
      passwordResetService.getUserByToken.mockResolvedValue(mockUser);
      passwordResetService.updatePassword.mockResolvedValue(true);
      passwordResetService.deleteEntry.mockResolvedValue(false);
      await expect(controller.createNewPassword('pass', 'token')).rejects.toThrow('Failed to clean up password reset entry');
    });

    it('should succeed and return message if all steps pass', async () => {
      const mockUser = { email: 'user@example.com' };
      passwordResetService.getUserByToken.mockResolvedValue(mockUser);
      passwordResetService.updatePassword.mockResolvedValue(true);
      passwordResetService.deleteEntry.mockResolvedValue(true);
      mailerService.sendMail.mockResolvedValue(undefined);

      const result = await controller.createNewPassword('newPass123', 'validToken');

      expect(passwordResetService.updatePassword).toHaveBeenCalledWith(mockUser.email, 'newPass123');
      expect(passwordResetService.deleteEntry).toHaveBeenCalledWith(mockUser.email);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        mockUser.email,
        'Password Reset Request Successful',
        expect.any(String),
        expect.stringContaining('<p>Your password has been reset.</p>')
      );
      expect(result).toEqual({ message: 'Password reset successful, redirecting to login page' });
    });
  });
});
