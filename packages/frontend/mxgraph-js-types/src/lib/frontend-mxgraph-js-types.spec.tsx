import { render } from '@testing-library/react';

import FrontendMxgraphJsTypes from './frontend-mxgraph-js-types';

describe('FrontendMxgraphJsTypes', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<FrontendMxgraphJsTypes />);
    expect(baseElement).toBeTruthy();
  });
});
