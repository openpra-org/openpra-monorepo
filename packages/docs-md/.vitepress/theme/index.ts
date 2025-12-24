// Extend the default theme to include our custom CSS overrides
import DefaultTheme from 'vitepress/theme';
import './custom.css';

export default {
  ...DefaultTheme,
};
