import { render } from '@testing-library/react';
import ContextAddButton from '../contextAddButton';

jest.mock("react-router-dom", () => ({
    ...jest.requireActual("react-router-dom"),
    useLocation: () => ({
      pathname: "localhost:4200/internal-events"
    })
  }));

describe('ContextAddButton', () => {
    it('renders button with popover', () => {
        const { getByText, getByAltText, getByTestId} = render(<ContextAddButton />);
    });
});