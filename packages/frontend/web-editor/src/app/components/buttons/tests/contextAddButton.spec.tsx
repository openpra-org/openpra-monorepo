import { render } from '@testing-library/react';
import ContextAddButton from '../contextAddButton';

describe('ContextAddButton', () => {
    it('renders button with popover', () => {
        const { getByText, getByAltText, getByTestId} = render(<ContextAddButton />);
    });
  });