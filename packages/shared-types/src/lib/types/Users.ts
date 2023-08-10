import Label from "./Label";

export default class User {
    private username: string;
    private firstName: string;
    private lastName: string;
    private email: string;
    private password: string;

    constructor(username = '', firstName = '', lastName = '', email = '', password = '') {
        this.username = username;
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.password = password;
    }
}