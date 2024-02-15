import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import {
  ButtonWithClosablePopover,
  ButtonWithPopover,
} from "../ButtonWithPopover";

describe(ButtonWithPopover, () => {
  it("Checks the button with icon", () => {
    render(
      <BrowserRouter>
        <ButtonWithClosablePopover
          closeProp="onCancel"
          isIcon
          iconType={"bars"}
        />
      </BrowserRouter>,
    );

    // Find and click the button to open the popover
    const buttonIcon = screen.getByTestId("button-icon");
    expect(buttonIcon).toBeInTheDocument();
  });

  it("Checks the button with text", () => {
    render(
      <BrowserRouter>
        <ButtonWithClosablePopover closeProp="onCancel" />
      </BrowserRouter>,
    );

    // Find and click the button to open the popover
    const buttonText = screen.getByTestId("button-text");
    expect(buttonText).toBeInTheDocument();
  });

  //TODO: Move this to somewhere where its like, easy to check the modal, probably from item add form

  // it('Checks the discard modal', () => {
  //     render(<BrowserRouter><ButtonWithClosablePopover closeProp="onCancel" isIcon={false} confirmDiscard /></BrowserRouter>);

  //     const buttonText = screen.getByTestId('button-text');
  //     fireEvent.click(buttonText);
  //     fireEvent.click(window);

  //     // Find and click the button to open the popover
  //     const modal = screen.getByTestId('modal');
  //     expect(modal).toBeInTheDocument();
  // });
});
