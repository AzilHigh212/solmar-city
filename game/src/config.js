// Solmar City — configuration: world size, districts, colours, tuning.
// A sun-soaked coastal city of our own: no borrowed names, maps or art.
export const WORLD = { width: 3600, height: 2600 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-city-save-v1';

// The road grid: vertical and horizontal road centrelines, road width in px.
export const ROADS = {
  vertical: [300, 700, 1100, 1500, 1900, 2300, 2700, 3100],
  horizontal: [250, 600, 950, 1300, 1650, 2000, 2350],
  width: 100,
  lane: 22,
};

// Districts, by region. Each has a name, a bounds box and a palette of building colours.
export const DISTRICTS = [
  { name: 'Marina Bay', x: 0, y: 0, w: 560, h: 2600, palette: ['#f2d8a7', '#eec27f', '#f7e3b8', '#e8b06a'] },
  { name: 'Old Town', x: 560, y: 0, w: 900, h: 1300, palette: ['#e8a56b', '#d98d4f', '#f0b878', '#c97e46'] },
  { name: 'Downtown', x: 1460, y: 800, w: 1180, h: 1050, palette: ['#9fb4c7', '#8aa3b8', '#b7c9d8', '#7e97ab'] },
  { name: 'Harbor', x: 560, y: 1300, w: 900, h: 1300, palette: ['#b8a88f', '#a3907a', '#c9b797', '#8f7d63'] },
  { name: 'Hillside', x: 2640, y: 0, w: 960, h: 2600, palette: ['#a8c69f', '#93b489', '#bdd3ae', '#7fa877'] },
];

// Landmark positions (world coords), used by missions and the map. Each one sits on a
// sidewalk beside a road — never inside a building — so the player can always reach it.
export const LANDMARKS = {
  safehouse: { x: 744, y: 470, label: 'Safehouse' },
  marinaPier: { x: 220, y: 1200, label: 'Marina Pier' },
  downtownHotel: { x: 1544, y: 1100, label: 'Grand Solmar Hotel' },
  harborWarehouse: { x: 744, y: 2100, label: 'Harbor Warehouse' },
  oldTownCafe: { x: 1144, y: 800, label: 'Cafe Alba' },
  bank: { x: 1944, y: 1450, label: 'Solmar National Bank' },
  hospital: { x: 2344, y: 800, label: 'St. Lumen Hospital' },
  policeStation: { x: 1144, y: 1800, label: 'Solmar PD HQ' },
  hillsLookout: { x: 2744, y: 450, label: 'Hillside Lookout' },
  taxiStand: { x: 720, y: 520, label: 'Taxi Stand' },
};

// Player tuning.
export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 330,
  healthMax: 100,
  pistolDamage: 34,
  pistolRange: 520,
  magazine: 12,
  reloadSeconds: 1.4,
};

// Car tuning (arcade, top-down).
export const CAR = {
  width: 46,
  length: 78,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.6,
  drag: 0.55,
  offroadDrag: 1.6,
};

// Traffic + pedestrians.
export const TRAFFIC = { cars: 26, peds: 42, carSpeed: 170, pedSpeed: 55 };

// Police / wanted.
export const POLICE = {
  maxStars: 5,
  decaySeconds: 26,
  bustDistance: 30,
  bustHoldSeconds: 0.9,
  copCarSpeed: 620,
  spawnDistance: 650,
};

// Car paint jobs (model name -> colours). All original models.
export const CAR_MODELS = [
  { name: 'Solmar Comet', body: '#e8443a', roof: '#b32d26' },
  { name: 'Bayside Cruiser', body: '#3a7bd5', roof: '#2a5aa8' },
  { name: 'Palm Taxi', body: '#f7c948', roof: '#f7c948' },
  { name: 'Hillside Rover', body: '#5aa469', roof: '#3f7d4e' },
  { name: 'Sunset Coupe', body: '#e87ea1', roof: '#c75d84' },
  { name: 'Harbor Van', body: '#e8e4da', roof: '#c9c2b2' },
  { name: 'Midnight Sedan', body: '#3d4452', roof: '#2a2f39' },
  { name: 'Coral Hatchback', body: '#ff8c42', roof: '#d96a1e' },
];

// Pedestrian shirt colours.
export const PED_COLORS = ['#e86a6a', '#6aa5e8', '#7bc96f', '#e8c96a', '#b07be8', '#e89ec0', '#6ad0c8', '#f0f0f0'];

// Palette for rendering.
export const COLORS = {
  grass: '#8fbf6a',
  grassDark: '#7fae5c',
  sand: '#ecd9a0',
  water: '#3fa7c4',
  waterDeep: '#2b87a8',
  road: '#4a4a52',
  roadEdge: '#33333a',
  sidewalk: '#b9b3a4',
  lane: '#e8d44d',
  park: '#6fae5f',
  buildingShadow: 'rgba(0,0,0,0.25)',
  hudPanel: 'rgba(12,18,28,0.72)',
  hudText: '#f5f2e8',
  accent: '#ffd34d',
  wanted: '#ff4d4d',
  police: '#2f6df6',
};
