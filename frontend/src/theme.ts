import { extendTheme } from '@chakra-ui/react';

const colors = {
  brand: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#2563eb',
    600: '#1d4ed8',
    700: '#1e40af',
    800: '#1e3a8a',
    900: '#172554'
  }
};

const fonts = {
  heading: 'Inter, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial',
  body: 'Inter, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial'
};

const styles = {
  global: {
    'html, body': {
      height: '100%',
      background: 'gray.50',
      color: 'gray.800'
    },
    '#root': {
      minHeight: '100%'
    }
  }
};

const components = {
  Button: {
    baseStyle: {
      borderRadius: '8px'
    }
  },
  Input: {
    defaultProps: {
      focusBorderColor: 'brand.500'
    }
  },
  Container: {
    baseStyle: {
      maxW: 'container.lg'
    }
  }
};

const theme = extendTheme({ colors, fonts, styles, components, config: { initialColorMode: 'light', useSystemColorMode: false } });

export default theme;
