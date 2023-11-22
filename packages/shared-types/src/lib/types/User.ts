import Label from "./Label";

export default class User {
  private readonly username: string;
  private readonly firstName: string;
  private readonly lastName: string;
  private readonly email: string;
  private readonly password: string;

  constructor(
    username = "",
    firstName = "",
    lastName = "",
    email = "",
    password = "",
  ) {
    this.username = username;
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.password = password;
  }
}
