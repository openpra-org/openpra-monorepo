// import { createContext, useContext } from "react";
// import { Route, Navigate } from "react-router-dom";


// const authContext = createContext(null);

// export function useAuth() {
//   return useContext(authContext);
// }

// export function PrivateRoute({ children, location, ...rest }) {
//   const auth = useAuth();
//   const loginLocation = {
//     pathname: '/login',
//     state: { from: location }
//   };
//   return (
//     <Route
//       {...rest}
//       render={() =>
//         auth.user ? (
//           children
//         ) : (
//           <Navigate to={loginLocation.pathname} state={loginLocation.state} replace />
//         )
//       }
//     />
//   );
// }
