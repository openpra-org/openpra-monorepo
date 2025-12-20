import { EuiThemeModifications } from '@elastic/eui';

/**
 * Local theme overrides applied to the Elastic UI theme.
 *
 * Currently configures the Cereal font family and weights used by the app.
 */
export const ThemeMods: EuiThemeModifications = {
  font: {
    family:
      'Cereal,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"',
    weight: {
      medium: 400,
      semiBold: 500,
      bold: 600,
    },
  },
};
