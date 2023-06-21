import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import App from "./app/app";
import {EuiThemeProvider} from '@elastic/eui'
import './assets/css/eui_theme_dark.css'
import './assets/css/eui_theme_light.css'

ReactDOM.render(
  <StrictMode>
         <App />
  </StrictMode>
, document.getElementById('root') as HTMLElement);
