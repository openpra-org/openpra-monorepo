import { render } from '@testing-library/react';
import ContextAddButton from '../contextAddButton';

/**
 * tests all of the create item button types
 * this also does tests for create item button because of this
 * as this function creates those, just with different parameters
 */

jest.mock("react-router-dom", () => ({
    ...jest.requireActual("react-router-dom"),
    useLocation: () => ({
      pathname: "/internal-events"
    })
}));

describe('Internal events button renders', () => {
    it('Renders the internal events button', () => { 
        
        const { getByText, getByAltText, getByTestId } = render(<ContextAddButton />);

        const buttonText = getByText('Create Internal Events');

        expect(buttonText).toBeTruthy();

    });
});

// describe('Internal hazards button renders', () => {
//     it('Renders the internal hazards button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/internal-hazards"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Internal Hazards');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('External hazards button renders', () => {
//     it('Renders the external hazards button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/external-hazards"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create External Hazards');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Full Scope button renders', () => {
//     it('Renders the full scope button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Full Scope');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Bayesian estimation button renders', () => {
//     it('Renders the bayesian estimation button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope/bayesian-estimations"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Bayesian Estimation');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Bayesian network button renders', () => {
//     it('Renders the bayesian network button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope/bayesian-networks"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Bayesian Network');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Event sequence diagram button renders', () => {
//     it('Renders the event sequence diagram button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope/event-sequence-diagrams"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Event Sequence Diagram');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Event tree button renders', () => {
//     it('Renders the event tree button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope/event-trees"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Event Tree');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Fault tree button renders', () => {
//     it('Renders the fault tree button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope/fault-trees"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Fault Tree');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Functional event button renders', () => {
//     it('Renders the functional event button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope/functional-events"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Functional Event');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Initiating events button renders', () => {
//     it('Renders the intiating events button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope/initiating-events"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Initiating Events');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Markov chains button renders', () => {
//     it('Renders the markov chains button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope/markov-chains"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Markov Chains');

//         expect(buttonText).toBeTruthy();

//     });
// });

// describe('Weibull analysis button renders', () => {
//     it('Renders the weibull analysis button', () => { 

//         jest.mock("react-router-dom", () => ({
//             ...jest.requireActual("react-router-dom"),
//             useLocation: () => ({
//               pathname: "/full-scope/weibull-analysis"
//             })
//         }));
        
//         const { getByText, getByAltText, getByTestId, } = render(<ContextAddButton />);

//         const buttonText = getByText('Create Weibull Analysis');

//         expect(buttonText).toBeTruthy();

//     });
// });