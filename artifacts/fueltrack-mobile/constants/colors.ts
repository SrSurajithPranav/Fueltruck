/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#2B3C37',
    tint: '#2D6D5E',

    background: '#F8F5EF',
    foreground: '#2B3C37',

    card: '#FFFDF9',
    cardForeground: '#2B3C37',

    primary: '#2D6D5E',
    primaryForeground: '#FCF8EF',

    secondary: '#EADDC8',
    secondaryForeground: '#34473F',

    muted: '#EEE8DD',
    mutedForeground: '#66716C',

    accent: '#ED7952',
    accentForeground: '#FFF7EF',

    destructive: '#B84E42',
    destructiveForeground: '#FFF8F1',

    border: '#DCCFBE',
    input: '#D4C6B4',
  },

  dark: {
    text: '#F1E9DB',
    tint: '#83CBB3',
    background: '#19302A',
    foreground: '#F1E9DB',
    card: '#214039',
    cardForeground: '#F1E9DB',
    primary: '#83CBB3',
    primaryForeground: '#173128',
    secondary: '#35554B',
    secondaryForeground: '#F1E9DB',
    muted: '#2B4941',
    mutedForeground: '#B3BBAF',
    accent: '#F18A61',
    accentForeground: '#2E241F',
    destructive: '#D86B5F',
    destructiveForeground: '#FFF8F1',
    border: '#3C5A51',
    input: '#45655B',
  },

  radius: 8,
};

export default colors;
