// src/themes.js

export const THEMES = [
    {
      id: 'dark',
      name: 'Dark',
      splashImage: '/splash-dark.jpg',
      cssVariables: {
        '--color-bg-primary-rgb': '26, 26, 26',
        '--opacity-bg-primary': '0.6',
        '--color-bg-secondary-rgb': '34, 34, 34',
        '--opacity-bg-secondary': '0.75',
        '--color-surface': '26 26 26',
        '--color-card-active': '43 43 43',
        '--color-button-text': '0 0 0',
        '--color-text-primary': '232 234 237',
        '--color-text-secondary': '158 158 158',
        '--color-accent': '255 255 255',
        '--color-border-color': '74 74 74',
        '--color-hover-color': '255 255 255',
      }
    },
    {
      id: 'light',
      name: 'Light',
      splashImage: '/splash-light.jpg',
      cssVariables: {
        '--color-bg-primary-rgb': '250, 250, 250',
        '--opacity-bg-primary': '0.8',
        '--color-bg-secondary-rgb': '255, 255, 255',
        '--opacity-bg-secondary': '0.9',
        '--color-surface': '240 240 240',
        '--color-card-active': '235 235 235',
        '--color-button-text': '255 255 255',
        '--color-text-primary': '20 20 20',
        '--color-text-secondary': '108 108 108',
        '--color-accent': '143 114 83',
        '--color-border-color': '224 224 224',
        '--color-hover-color': '143 114 83',
      }
    },
    {
      id: 'muted-green',
      name: 'Muted Green',
      splashImage: '/splash-green.jpg',
      cssVariables: {
        '--color-bg-primary-rgb': '44, 56, 54',
        '--opacity-bg-primary': '0.7',
        '--color-bg-secondary-rgb': '54, 69, 58',
        '--opacity-bg-secondary': '0.8',
        '--color-surface': '38 48 46',
        '--color-card-active': '60 75 72',
        '--color-button-text': '230 230 230',
        '--color-text-primary': '227 225 220',
        '--color-text-secondary': '140 151 149',
        '--color-accent': '138 173 162',
        '--color-border-color': '70 85 82',
        '--color-hover-color': '138 173 162',
      }
    },
    {
      id: 'graphite',
      name: 'Graphite',
      splashImage: '/splash-graphite.jpg',
      cssVariables: {
        '--color-bg-primary-rgb': '35, 38, 41',
        '--opacity-bg-primary': '0.7',
        '--color-bg-secondary-rgb': '42, 46, 50',
        '--opacity-bg-secondary': '0.85',
        '--color-surface': '35 38 41',
        '--color-card-active': '52 57 62',
        '--color-button-text': '255 255 255',
        '--color-text-primary': '220 225 230',
        '--color-text-secondary': '145 155 165',
        '--color-accent': '94 129 172', // Softer, less aggressive steel blue
        '--color-border-color': '60 65 70',
        '--color-hover-color': '94 129 172',
      }
    },
    {
      id: 'sepia',
      name: 'Sepia',
      splashImage: '/splash-sepia.jpg',
      cssVariables: {
        '--color-bg-primary-rgb': '50, 45, 40',
        '--opacity-bg-primary': '0.7',
        '--color-bg-secondary-rgb': '65, 60, 55',
        '--opacity-bg-secondary': '0.8',
        '--color-surface': '50 45 40',
        '--color-card-active': '80 75 70',
        '--color-button-text': '50 45 40',
        '--color-text-primary': '225 215 205',
        '--color-text-secondary': '160 150 140',
        '--color-accent': '200 145 80',
        '--color-border-color': '90 85 80',
        '--color-hover-color': '200 145 80',
      }
    },
    {
      id: 'arctic',
      name: 'Arctic',
      splashImage: '/splash-arctic.jpg',
      cssVariables: {
        '--color-bg-primary-rgb': '248, 249, 250',
        '--opacity-bg-primary': '0.8',
        '--color-bg-secondary-rgb': '255, 255, 255',
        '--opacity-bg-secondary': '0.9',
        '--color-surface': '248 249 250',
        '--color-card-active': '233 236 239',
        '--color-button-text': '255 255 255',
        '--color-text-primary': '33 37 41',
        '--color-text-secondary': '108 117 125',
        '--color-accent': '100 120 140',
        '--color-border-color': '222 226 230',
        '--color-hover-color': '100 120 140',
      }
    }
  ];
  
  export const DEFAULT_THEME_ID = 'dark';