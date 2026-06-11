// Warm beige "toy town" palette — cute, low-saturation, no arcade colors.
export const PAL = {
  sky: '#f1e7d6',
  water: '#a3c6bf',
  waterDeep: '#8fb5ae',
  sand: '#e9dab6',
  landLow: '#ddcfac',
  landHigh: '#c9ba92',
  park: '#aec692',
  parkDark: '#9ab981',
  road: '#cfbf9f',
  rail: '#b9a886',
  building: ['#f2e6d0', '#ead9bd', '#f6ecd9', '#e0c9ab', '#d9b294', '#d8c3b0', '#e6d2c4', '#cdb295'],
  roofAccent: '#b48a6a',
  bridgeOrange: '#c96f4a',
  bridgeGray: '#b0a796',
  treeTrunk: '#a0795a',
  treeCrown: ['#8fae72', '#a3bd84', '#7da06a'],
  cloud: '#fbf6ec',

  // transit systems (muted, pastel)
  bus: '#d9a13c',
  metro: '#cf7a68',
  streetcar: '#c98a4b',
  bart: '#7fa6c9',
  cable: '#a9744f',
  ferry: '#6fa8a0',
} as const;

// Night theme: warm dark indigo with amber "lit street" roads.
export const NIGHT = {
  sky: '#262433',
  water: '#1d2733',
  roadMajor: '#e3a95e',
  roadMid: '#c2914f',
  roadMinor: '#967242',
  ambient: { color: '#9aa3c8', intensity: 0.28 },
  moon: { color: '#b8c4e8', intensity: 0.4 },
  hemi: { sky: '#3a3f5c', ground: '#221f2e', intensity: 0.35 },
} as const;
