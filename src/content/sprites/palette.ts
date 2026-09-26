/** Shared colours for pixel-map sprites. */

/** 1 px dark outline used on every actor (DESIGN: readable silhouettes). */
export const OUTLINE = '#0d0b14';

/** The Gutterways (chapter 1) palette: deep blue-grey stone, mossy accents, rainwater. */
export const GUTTER = {
  floor: '#283044',
  floorLight: '#2e374c',
  floorDark: '#232a3b',
  mortar: '#181c29',
  deep: '#0b0d14',
  brick: '#39435a',
  brickShade: '#2c3447',
  brickLight: '#4b5773',
  moss: '#35523a',
  mossLight: '#4f7447',
  stone: '#5c6580',
  stoneLight: '#8691ad',
  stoneShade: '#3e455a',
  void: '#05060a',
  voidSpeck: '#0c0f18',
  water: '#3b5f7e',
  waterLight: '#6d9ac0',
  leaf: '#8a5a2b',
  leafLight: '#b98040',
} as const;

/** Candle-gold glow used by marbles and UI accents. */
export const GLOW = {
  core: '#ffcf57',
  hot: '#fffbe8',
  rim: '#e8862e',
  outline: '#5a2410',
  halo: '#ffb347',
} as const;

/** UI colours (menus, HUD). */
export const UI = {
  panel: '#1a2031',
  panelLight: '#2a3350',
  border: '#56648a',
  borderHot: '#ffd76a',
  text: '#e9edf7',
  textDim: '#8e98b5',
  shadow: '#07080d',
  accent: '#ffcf57',
  danger: '#e0515a',
  heart: '#e0515a',
} as const;
