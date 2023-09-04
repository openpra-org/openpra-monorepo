import { render } from '@testing-library/react';
import ButtonWithPopover from '../ButtonWithPopover';

describe('ButtonWithPopover', () => {
    it('renders button with popover', () => {
        const { getByText, getByAltText, getByTestId} = render(<ButtonWithPopover />);
    });
  });