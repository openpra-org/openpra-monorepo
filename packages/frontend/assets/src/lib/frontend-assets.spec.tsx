import { render } from '@testing-library/react';

import FrontendAssets from './frontend-assets';

describe('FrontendAssets', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<FrontendAssets />);
    expect(baseElement).toBeTruthy();
  });
});
