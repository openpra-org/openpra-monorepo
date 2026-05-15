import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { act } from "react";
import { BrowserRouter } from "react-router-dom";
import { RootHeader } from "../rootHeader";
describe("RootHeader", () => {
  it("renders header breadcrumbs", async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RootHeader />
        </BrowserRouter>,
      );
    });
    const headerBreadcrumbs = await screen.findByTestId("breadcrumbs");
    expect(headerBreadcrumbs).toBeInTheDocument();
  });
  it("renders header search icon", async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RootHeader />
        </BrowserRouter>,
      );
    });
    const searchIcon = await screen.findByTestId("search-icon");
    expect(searchIcon).toBeInTheDocument();
  });
  it("renders search menu on clicking search icon", async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RootHeader />
        </BrowserRouter>,
      );
    });
    const searchIcon = await screen.findByTestId("search-icon");
    act(() => {
      fireEvent.click(searchIcon);
    });
    const searchMenuMessage = (await screen.findAllByTestId("search-menu"))[0];
    expect(searchMenuMessage).toBeInTheDocument();
  });
  it("renders header user menu", async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RootHeader />
        </BrowserRouter>,
      );
    });
    const userMenu = await screen.findByTestId("user-menu");
    expect(userMenu).toBeInTheDocument();
  });
  it("renders user menu contents on clicking user menu", async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RootHeader />
        </BrowserRouter>,
      );
    });
    const userMenu = await screen.findByTestId("user-menu");
    act(() => {
      fireEvent.click(userMenu);
    });
    const userMenuContents = await screen.findByTestId("user-menu-content");
    expect(userMenuContents).toBeInTheDocument();
  });
  it("renders header app menu", async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RootHeader />
        </BrowserRouter>,
      );
    });
    const appMenu = await screen.findByTestId("app-menu");
    expect(appMenu).toBeInTheDocument();
  });
  it("renders header app menu content on clicking header user app icon", async () => {
    act(() => {
      render(
        <BrowserRouter>
          <RootHeader />
        </BrowserRouter>,
      );
    });
    const appMenu = await screen.findByTestId("app-menu");
    act(() => {
      fireEvent.click(appMenu);
    });
    const appMenuContents = await screen.findByTestId("app-menu-content");
    expect(appMenuContents).toBeInTheDocument();
  });
});
