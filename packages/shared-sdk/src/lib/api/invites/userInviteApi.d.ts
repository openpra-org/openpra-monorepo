import { SignUpProps } from "../AuthTypes";
export declare class UserInviteApi {
    static inviteUser(userData: SignUpProps, expiry: number, numberOfInvites: number): Promise<Response>;
    static verifyInvite(inviteId: string): Promise<Response>;
    static getAllInvites(): Promise<Response>;
    static deleteInviteById(id: string): Promise<Response>;
    static updateInvite(id: string): Promise<Response>;
}
