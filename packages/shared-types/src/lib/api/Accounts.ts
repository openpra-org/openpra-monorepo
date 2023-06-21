/**
 * Paths for
 */
export default class Accounts {
  public static BASE = '/accounts';
  private readonly prefix: string;
  constructor(BASE_URL: string) {
    this.prefix = BASE_URL;
  }
  public get PASSWORD_RESET(): string { return `${this.prefix}${Accounts.BASE}/password_reset`; }
  public get PASSWORD_RESET_DONE(): string { return `${this.PASSWORD_RESET}/done`; }

  public get PASSWORD_CHANGE(): string { return `${this.prefix}${Accounts.BASE}/password_change`; }
  public get PASSWORD_CHANGE_DONE(): string { return `${this.PASSWORD_CHANGE}/done`; }
}
