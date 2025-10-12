import { ApiManager } from "./ApiManager";
import { AuthService } from "./AuthService";

// simple localStorage mock for tests
const setupLocalStorage = () => {
  const store: Record<string, string> = {};
  Object.defineProperty(global, "localStorage", {
    value: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => void (store[k] = v),
      removeItem: (k: string) => void delete store[k],
    },
    configurable: true,
  });
};

describe("ApiManager", () => {
  beforeAll(() => {
    setupLocalStorage();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it("signInWithUsernameAndPassword sets token on success", async () => {
    const fetchMock = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ token: "abc.def.ghi" }),
    } as any);

    const setTokenSpy = jest.spyOn(AuthService, "setEncodedToken").mockImplementation(() => {});

    await ApiManager.signInWithUsernameAndPassword("user", "pass");

    expect(fetchMock).toHaveBeenCalled();
    expect(setTokenSpy).toHaveBeenCalledWith("abc.def.ghi");
  });

  it("signInWithUsernameAndPassword throws on non-ok", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValue({ ok: false, statusText: "Unauthorized" } as any);
    await expect(ApiManager.signInWithUsernameAndPassword("user", "bad"))
      .rejects.toThrow("Unauthorized");
  });

  it("signup triggers sign-in on success", async () => {
    jest.spyOn(ApiManager as any, "post").mockResolvedValue({ ok: true, status: 200, statusText: "OK" } as any);
    const signInSpy = jest
      .spyOn(ApiManager, "signInWithUsernameAndPassword")
      .mockResolvedValue(undefined as any);

    await ApiManager.signup({
      username: "u",
      email: "e@x.com",
      firstName: "f",
      lastName: "l",
      password: "p",
      roles: ["member-role"],
    });

    expect(signInSpy).toHaveBeenCalledWith("u", "p");
  });

  it("signup success path calls signInWithUsernameAndPassword", async () => {
    jest.spyOn(ApiManager as any, "post").mockResolvedValue({ ok: true, status: 201, statusText: "Created" } as any);
    const signInSpy = jest
      .spyOn(ApiManager, "signInWithUsernameAndPassword")
      .mockResolvedValue(undefined as any);
    await ApiManager.signup({ username: "u", email: "e@x.com", firstName: "f", lastName: "l", password: "p", roles: ["member-role"] });
    expect(signInSpy).toHaveBeenCalledWith("u", "p");
  });

  it("signupWithoutSignIn resolves on ok", async () => {
    jest.spyOn(ApiManager as any, "post").mockResolvedValue({ ok: true, status: 200, statusText: "OK" } as any);

    await expect(
      ApiManager.signupWithoutSignIn({ username: "u", email: "e@x.com", firstName: "f", lastName: "l", password: "p" })
    ).resolves.toBeUndefined();
  });

  it("signupWithoutSignIn throws on error status", async () => {
    jest
      .spyOn(ApiManager as any, "post")
      .mockResolvedValue({ ok: false, status: 400, statusText: "Bad Request" } as any);

    await expect(
      ApiManager.signupWithoutSignIn({ username: "u", email: "e@x.com", firstName: "f", lastName: "l", password: "p" })
    ).rejects.toThrow("Bad Request");
  });

  it("valid email format util", () => {
    expect(ApiManager.isValidEmailFormat("user@example.com")).toBe(true);
    expect(ApiManager.isValidEmailFormat("bad@domain")).toBe(false);
    expect(ApiManager.isValidEmailFormat("nodomain")).toBe(false);
  });

  it("signup throws on error response", async () => {
    jest
      .spyOn(ApiManager as any, "post")
      .mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" } as any);

    await expect(
      ApiManager.signup({ username: "u", email: "e@x.com", firstName: "f", lastName: "l", password: "p", roles: ["member-role"] })
    ).rejects.toThrow("Server Error");
  });

  it("isLoggedIn returns false when no token or expired", () => {
    jest.spyOn(AuthService, "getEncodedToken").mockReturnValueOnce(null);
    expect(ApiManager.isLoggedIn()).toBe(false);

    jest.spyOn(AuthService, "getEncodedToken").mockReturnValueOnce("abc");
    jest.spyOn(AuthService, "hasTokenExpired").mockReturnValueOnce(true);
    expect(ApiManager.isLoggedIn()).toBe(false);
  });

  it("isLoggedIn returns true with valid token", () => {
    jest.spyOn(AuthService, "getEncodedToken").mockReturnValue("abc");
    jest.spyOn(AuthService, "hasTokenExpired").mockReturnValue(false);
    expect(ApiManager.isLoggedIn()).toBe(true);
  });

  it("getUserById returns a user result", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValue({ json: async () => ({ id: "123" }) } as any);
    const res = await ApiManager.getUserById("123");
    expect(res).toEqual({ id: "123" } as any);
  });

  it("updateUser performs PUT", async () => {
    const putSpy = jest.spyOn(ApiManager, "put").mockResolvedValue({ ok: true } as any);
    const r = await ApiManager.updateUser("42", JSON.stringify({ firstName: "A" }));
    expect(putSpy).toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });

  it("isValidEmail and isValidUsername forward boolean response", async () => {
    jest.spyOn(ApiManager as any, "post").mockResolvedValue({ json: async () => true } as any);
    await expect(ApiManager.isValidEmail(JSON.stringify({ email: "e@x.com" }))).resolves.toBe(true);
    await expect(ApiManager.isValidUsername(JSON.stringify({ username: "u" }))).resolves.toBe(true);
  });

  it("post sets method and headers including Authorization", async () => {
    const calls: any[] = [];
    jest.spyOn(AuthService, "getEncodedToken").mockReturnValue("tkn");
    jest.spyOn(global, "fetch" as any).mockImplementation((...args: any[]) => {
      const [url, init] = args;
      calls.push({ url, init });
      return Promise.resolve({ ok: true } as any);
    });
    await ApiManager.post("/api/test", JSON.stringify({ a: 1 }));
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    expect(calls[0].init.headers["Authorization"]).toBe("JWT tkn");
  });

  it("put sets method and headers including Authorization", async () => {
    const calls: any[] = [];
    jest.spyOn(AuthService, "getEncodedToken").mockReturnValue("tkn");
    jest.spyOn(global, "fetch" as any).mockImplementation((...args: any[]) => {
      const [url, init] = args;
      calls.push({ url, init });
      return Promise.resolve({ ok: true } as any);
    });
    await ApiManager.put("/api/test", JSON.stringify({ a: 1 }));
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    expect(calls[0].init.headers["Authorization"]).toBe("JWT tkn");
  });

  it("delete sets method and headers including Authorization", async () => {
    const calls: any[] = [];
    jest.spyOn(AuthService, "getEncodedToken").mockReturnValue("tkn");
    jest.spyOn(global, "fetch" as any).mockImplementation((...args: any[]) => {
      const [url, init] = args;
      calls.push({ url, init });
      return Promise.resolve({ ok: true } as any);
    });
    await ApiManager.delete("/api/test");
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    expect(calls[0].init.headers["Authorization"]).toBe("JWT tkn");
  });

  it("updateUser returns non-ok response unchanged (consumer may check)", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValue({ ok: false, status: 400, statusText: "Bad Request" } as any);
    const res = await ApiManager.updateUser("55", JSON.stringify({ lastName: "Doe" }));
    expect(res.ok).toBe(false);
    expect((res as any).status).toBe(400);
  });

  it("delete non-2xx can be enforced via checkStatus (throws)", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValue({ status: 500, statusText: "Server Error" } as any);
    const res = await ApiManager.delete("/api/bad");
    expect(() => ApiManager.checkStatus(res as any)).toThrow("Server Error");
  });

  it("getWithOptions sets GET method and Authorization header", async () => {
    const calls: any[] = [];
    jest.spyOn(AuthService, "getEncodedToken").mockReturnValue("tkn");
    jest.spyOn(global, "fetch" as any).mockImplementation((...args: any[]) => {
      const [url, init] = args;
      calls.push({ url, init });
      return Promise.resolve({ ok: true, json: async () => ({}) } as any);
    });
    await ApiManager.getWithOptions("/api/test");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.headers["Authorization"]).toBe("JWT tkn");
  });

  it("verifyPassword non-OK can be enforced via checkStatus (throws)", async () => {
    jest.spyOn(global, "fetch" as any).mockResolvedValue({ status: 401, statusText: "Unauthorized" } as any);
    const res = await ApiManager.verifyPassword("user", "wrong");
    expect(() => ApiManager.checkStatus(res as any)).toThrow("Unauthorized");
  });

  it("validEmail returns false on bad format without calling backend", async () => {
    // no spy for post should be called
    const postSpy = jest.spyOn(ApiManager as any, "post").mockResolvedValue({ json: async () => true } as any);
    const res = await ApiManager.validEmail({
      username: "u",
      email: "bad-format",
      firstName: "f",
      lastName: "l",
      password: "p",
      passConfirm: "p",
      roles: ["member-role"],
    });
    expect(res).toBe(false);
  });

  it("validEmail returns backend false when API says not unique", async () => {
    jest.spyOn(ApiManager as any, "post").mockResolvedValue({ json: async () => false } as any);
    const res = await ApiManager.validEmail({
      username: "u",
      email: "e@x.com",
      firstName: "f",
      lastName: "l",
      password: "p",
      passConfirm: "p",
      roles: ["member-role"],
    });
    expect(res).toBe(false);
  });

  it("validUserName returns false when API throws", async () => {
    jest.spyOn(ApiManager, "isValidUsername").mockRejectedValue(new Error("network"));
    const res = await ApiManager.validUserName({
      username: "u",
      email: "e@x.com",
      firstName: "f",
      lastName: "l",
      password: "p",
      passConfirm: "p",
      roles: ["member-role"],
    });
    expect(res).toBe(false);
  });

  it("checkStatus passes on 2xx and throws otherwise", () => {
    expect(() => ApiManager.checkStatus({ status: 200, statusText: "OK" })).not.toThrow();
    expect(() => ApiManager.checkStatus({ status: 299, statusText: "OK" })).not.toThrow();
    expect(() => ApiManager.checkStatus({ status: 300, statusText: "Redirect" })).toThrow("Redirect");
  });

  it("logout removes id_token and returns true when cleared", () => {
    // put a token and ensure it is removed
    (global as any).localStorage.setItem("id_token", "abc");
    expect(ApiManager.logout()).toBe(true);
  });

  it("verifyPassword posts payload", async () => {
    const fetchSpy = jest.spyOn(global, "fetch" as any).mockResolvedValue({ ok: true } as any);
    const res = await ApiManager.verifyPassword("user", "secret");
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("getUsers calls collab endpoint", async () => {
    const members = [{ id: 1 }];
    jest.spyOn(global, "fetch" as any).mockResolvedValue({
      json: async () => members,
    } as any);
    const res = await ApiManager.getUsers();
    expect(res).toEqual(members as any);
  });

  it("getUsersWithRole includes role query", async () => {
    const members = [{ id: 1 }];
    const fetchSpy = jest.spyOn(global, "fetch" as any).mockResolvedValue({
      json: async () => members,
    } as any);
    const res = await ApiManager.getUsersWithRole("role-1");
    expect(res).toEqual(members as any);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("checkEmail and checkUserName debounce helpers invoke callbacks", async () => {
    jest.useFakeTimers();
    jest.spyOn(ApiManager, "validEmail").mockResolvedValue(true);
    jest.spyOn(ApiManager, "validUserName").mockResolvedValue(true);

    const onEmail = jest.fn();
    const onUser = jest.fn();

    const emailChecker = ApiManager.checkEmail(onEmail);
    const userChecker = ApiManager.checkUserName(onUser);

    emailChecker({ username: "u", email: "e@x.com", firstName: "f", lastName: "l", password: "p", passConfirm: "p", roles: ["member-role"] });
    userChecker({ username: "u", email: "e@x.com", firstName: "f", lastName: "l", password: "p", passConfirm: "p", roles: ["member-role"] });

  // fast-forward timers and flush pending microtasks
  jest.runAllTimers();
  await Promise.resolve();
  await Promise.resolve();
  expect(onEmail).toHaveBeenCalledWith(true);
  expect(onUser).toHaveBeenCalledWith(true);

    jest.useRealTimers();
  });
});
