import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { act } from "react";
import { BrowserRouter } from "react-router-dom";
import { RootHeader } from "../rootHeader";

describe("RootHeader", () => {
  //test for workspace selector

  //test for initial render of breadcrumbs
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

  //test for initial render of search icon
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

  //test for displaying search menu on clicking search icon
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

  //test for initial render of user menu
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

  //test for rendering user menu contents on clicking search menu
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

  //test for initial render of header app menu
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

  //test for rendering header app menu contents after clicking header app icon
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
