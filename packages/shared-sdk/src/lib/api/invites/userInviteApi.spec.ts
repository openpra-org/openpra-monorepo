import { UserInviteApi } from "./userInviteApi";
import * as ApiModule from "../ApiManager";

describe("UserInviteApi", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it("inviteUser posts invite DTO", async () => {
    const postSpy = jest.spyOn(ApiModule.ApiManager, "post").mockResolvedValue({ ok: true } as any);
    const res = await UserInviteApi.inviteUser(
      { username: "u", email: "e@x.com", firstName: "f", lastName: "l", password: "p", passConfirm: "p" },
      1000,
      2,
    );
    expect(postSpy).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it("verifyInvite posts id", async () => {
    const postSpy = jest.spyOn(ApiModule.ApiManager, "post").mockResolvedValue({ ok: true } as any);
    const res = await UserInviteApi.verifyInvite("abc");
    expect(postSpy).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it("getAllInvites fetches list", async () => {
    const getSpy = jest.spyOn(ApiModule.ApiManager, "getWithOptions").mockResolvedValue({ ok: true } as any);
    const res = await UserInviteApi.getAllInvites();
    expect(getSpy).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it("deleteInviteById deletes resource", async () => {
    const delSpy = jest.spyOn(ApiModule.ApiManager, "delete").mockResolvedValue({ ok: true } as any);
    const res = await UserInviteApi.deleteInviteById("id1");
    expect(delSpy).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it("updateInvite decrements numberOfInvites and PUTs", async () => {
    const getSpy = jest.spyOn(ApiModule.ApiManager, "getWithOptions").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "x", numberOfInvites: 2 }),
    } as any);
    const putSpy = jest.spyOn(ApiModule.ApiManager, "put").mockResolvedValue({ ok: true } as any);
    const res = await UserInviteApi.updateInvite("x");
    expect(getSpy).toHaveBeenCalled();
    expect(putSpy).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it("updateInvite deletes when count reaches zero", async () => {
    jest.spyOn(ApiModule.ApiManager, "getWithOptions").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "x", numberOfInvites: 1 }),
    } as any);
    const delSpy = jest.spyOn(UserInviteApi, "deleteInviteById").mockResolvedValue({ ok: true } as any);
    const res = await UserInviteApi.updateInvite("x");
    expect(delSpy).toHaveBeenCalledWith("x");
    expect(res.ok).toBe(true);
  });
});
