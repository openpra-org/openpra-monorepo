/**
 * Paths for
 */
export default class Admin {
  public static BASE = '/admin';
  private readonly prefix: string;
  constructor(BASE_URL: string) {
    this.prefix = BASE_URL;
  }
  public get ADMIN_HOME(): string { return `${this.prefix}${Admin.BASE}`; }
}
