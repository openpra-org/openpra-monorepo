import { render } from '@testing-library/react';
import { CreateBayesianEstimationButton } from '../CreateItemButton';

describe('CreateItemButton', () => {
    it('renders button with popover', () => {
        const { getByText, getByAltText, getByTestId} = render(<CreateBayesianEstimationButton />);
    });
  });