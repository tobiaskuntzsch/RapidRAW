import { Crop } from 'react-image-crop';
import { v4 as uuidv4 } from 'uuid';
import { SubMask, SubMaskMode } from '../components/panel/right/Masks';

export enum ActiveChannel {
  Blue = 'blue',
  Green = 'green',
  Luma = 'luma',
  Red = 'red',
}

export enum DisplayMode {
  Blue = 'blue',
  Green = 'green',
  Luma = 'luma',
  Red = 'red',
  Rgb = 'rgb',
}

export enum BasicAdjustment {
  Blacks = 'blacks',
  Contrast = 'contrast',
  Exposure = 'exposure',
  Highlights = 'highlights',
  Shadows = 'shadows',
  Whites = 'whites',
}

export enum ColorAdjustment {
  ColorGrading = 'colorGrading',
  Hsl = 'hsl',
  Hue = 'hue',
  Luminance = 'luminance',
  Saturation = 'saturation',
  Temperature = 'temperature',
  Tint = 'tint',
  Vibrance = 'vibrance',
}

export enum ColorGrading {
  Balance = 'balance',
  Blending = 'blending',
  Highlights = 'highlights',
  Midtones = 'midtones',
  Shadows = 'shadows',
}

export enum DetailsAdjustment {
  ColorNoiseReduction = 'colorNoiseReduction',
  LumaNoiseReduction = 'lumaNoiseReduction',
  Sharpness = 'sharpness',
}

export enum Effect {
  Clarity = 'clarity',
  Dehaze = 'dehaze',
  EnableNegativeConversion = 'enableNegativeConversion',
  FilmBaseColor = 'filmBaseColor',
  GrainAmount = 'grainAmount',
  GrainRoughness = 'grainRoughness',
  GrainSize = 'grainSize',
  NegativeBlueBalance = 'negativeBlueBalance',
  NegativeGreenBalance = 'negativeGreenBalance',
  NegativeRedBalance = 'negativeRedBalance',
  Structure = 'structure',
  VignetteAmount = 'vignetteAmount',
  VignetteFeather = 'vignetteFeather',
  VignetteMidpoint = 'vignetteMidpoint',
  VignetteRoundness = 'vignetteRoundness',
}

export interface Adjustments {
  [index: string]: any;
  aiPatches: Array<AiPatch>;
  aspectRatio: number | null;
  blacks: number;
  clarity: number;
  colorGrading: ColorGradingProps;
  colorNoiseReduction: number;
  contrast: number;
  curves: Curves;
  crop: Crop | null;
  dehaze: number;
  enableNegativeConversion: boolean;
  exposure: number;
  filmBaseColor: string;
  flipHorizontal: boolean;
  flipVertical: boolean;
  grainAmount: number;
  grainRoughness: number;
  grainSize: number;
  highlights: number;
  hsl: Hsl;
  lumaNoiseReduction: number;
  masks: Array<MaskContainer>;
  negativeBlueBalance: number;
  negativeGreenBalance: number;
  negativeRedBalance: number;
  orientationSteps: number;
  rating: number;
  rotation: number;
  saturation: number;
  sectionVisibility: SectionVisibility;
  shadows: number;
  sharpness: number;
  structure: number;
  temperature: number;
  tint: number;
  vibrance: number;
  vignetteAmount: number;
  vignetteFeather: number;
  vignetteMidpoint: number;
  vignetteRoundness: number;
  whites: number;
}

export interface AiPatch {
  id: string;
  isLoading: boolean;
  name: string;
  patchData: any | null;
  prompt: string;
  subMasks: Array<SubMask>;
  visible: boolean;
}

export interface Color {
  color: string;
  name: string;
}

interface ColorGradingProps {
  [index: string]: number | HueSatLum;
  balance: number;
  blending: number;
  highlights: HueSatLum;
  midtones: HueSatLum;
  shadows: HueSatLum;
}

export interface Coord {
  x: number;
  y: number;
}

export interface Curves {
  [index: string]: Array<Coord>;
  blue: Array<Coord>;
  green: Array<Coord>;
  luma: Array<Coord>;
  red: Array<Coord>;
}

export interface HueSatLum {
  hue: number;
  saturation: number;
  luminance: number;
}

interface Hsl {
  [index: string]: HueSatLum;
  aquas: HueSatLum;
  blues: HueSatLum;
  greens: HueSatLum;
  magentas: HueSatLum;
  oranges: HueSatLum;
  purples: HueSatLum;
  reds: HueSatLum;
  yellows: HueSatLum;
}

export interface MaskAdjustments {
  [index: string]: any;
  blacks: number;
  clarity: number;
  colorGrading: ColorGradingProps;
  colorNoiseReduction: number;
  contrast: number;
  curves: Curves;
  dehaze: number;
  exposure: number;
  highlights: number;
  hsl: Hsl;
  id?: string;
  lumaNoiseReduction: number;
  saturation: number;
  sectionVisibility: SectionVisibility;
  shadows: number;
  sharpness: number;
  structure: number;
  temperature: number;
  tint: number;
  vibrance: number;
  whites: number;
}

export interface MaskContainer {
  adjustments: MaskAdjustments;
  id?: any;
  invert: boolean;
  name: string;
  opacity: number;
  subMasks: Array<SubMask>;
  visible: boolean;
}

export interface Sections {
  [index: string]: Array<string>;
  basic: Array<string>;
  curves: Array<string>;
  color: Array<string>;
  details: Array<string>;
  effects: Array<string>;
}

export interface SectionVisibility {
  [index: string]: boolean;
  basic: boolean;
  curves: boolean;
  color: boolean;
  details: boolean;
  effects: boolean;
}

export const COLOR_LABELS: Array<Color> = [
  { name: 'red', color: '#ef4444' },
  { name: 'yellow', color: '#facc15' },
  { name: 'green', color: '#4ade80' },
  { name: 'blue', color: '#60a5fa' },
  { name: 'purple', color: '#a78bfa' },
];

const INITIAL_COLOR_GRADING: ColorGradingProps = {
  balance: 0,
  blending: 50,
  highlights: { hue: 0, saturation: 0, luminance: 0 },
  midtones: { hue: 0, saturation: 0, luminance: 0 },
  shadows: { hue: 0, saturation: 0, luminance: 0 },
};

export const INITIAL_MASK_ADJUSTMENTS: MaskAdjustments = {
  blacks: 0,
  clarity: 0,
  colorGrading: { ...INITIAL_COLOR_GRADING },
  colorNoiseReduction: 0,
  contrast: 0,
  curves: {
    blue: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    green: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    luma: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    red: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
  },
  dehaze: 0,
  exposure: 0,
  highlights: 0,
  hsl: {
    aquas: { hue: 0, saturation: 0, luminance: 0 },
    blues: { hue: 0, saturation: 0, luminance: 0 },
    greens: { hue: 0, saturation: 0, luminance: 0 },
    magentas: { hue: 0, saturation: 0, luminance: 0 },
    oranges: { hue: 0, saturation: 0, luminance: 0 },
    purples: { hue: 0, saturation: 0, luminance: 0 },
    reds: { hue: 0, saturation: 0, luminance: 0 },
    yellows: { hue: 0, saturation: 0, luminance: 0 },
  },
  lumaNoiseReduction: 0,
  saturation: 0,
  sectionVisibility: {
    basic: true,
    curves: true,
    color: true,
    details: true,
    effects: true,
  },
  shadows: 0,
  sharpness: 0,
  structure: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  whites: 0,
};

export const INITIAL_MASK_CONTAINER: MaskContainer = {
  adjustments: INITIAL_MASK_ADJUSTMENTS,
  invert: false,
  name: 'New Mask',
  opacity: 100,
  subMasks: [],
  visible: true,
};

export const INITIAL_ADJUSTMENTS: Adjustments = {
  aiPatches: [],
  aspectRatio: null,
  blacks: 0,
  clarity: 0,
  colorGrading: { ...INITIAL_COLOR_GRADING },
  colorNoiseReduction: 0,
  contrast: 0,
  crop: null,
  curves: {
    blue: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    green: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    luma: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    red: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
  },
  dehaze: 0,
  enableNegativeConversion: false,
  exposure: 0,
  filmBaseColor: '#ff8800',
  flipHorizontal: false,
  flipVertical: false,
  grainAmount: 0,
  grainRoughness: 50,
  grainSize: 25,
  highlights: 0,
  hsl: {
    aquas: { hue: 0, saturation: 0, luminance: 0 },
    blues: { hue: 0, saturation: 0, luminance: 0 },
    greens: { hue: 0, saturation: 0, luminance: 0 },
    magentas: { hue: 0, saturation: 0, luminance: 0 },
    oranges: { hue: 0, saturation: 0, luminance: 0 },
    purples: { hue: 0, saturation: 0, luminance: 0 },
    reds: { hue: 0, saturation: 0, luminance: 0 },
    yellows: { hue: 0, saturation: 0, luminance: 0 },
  },
  lumaNoiseReduction: 0,
  masks: [],
  negativeBlueBalance: 0,
  negativeGreenBalance: 0,
  negativeRedBalance: 0,
  orientationSteps: 0,
  rating: 0,
  rotation: 0,
  saturation: 0,
  sectionVisibility: {
    basic: true,
    curves: true,
    color: true,
    details: true,
    effects: true,
  },
  shadows: 0,
  sharpness: 0,
  structure: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  vignetteAmount: 0,
  vignetteFeather: 50,
  vignetteMidpoint: 50,
  vignetteRoundness: 0,
  whites: 0,
};

export const normalizeLoadedAdjustments = (loadedAdjustments: Adjustments): any => {
  if (!loadedAdjustments) {return INITIAL_ADJUSTMENTS;}

  const normalizedMasks = (loadedAdjustments.masks || []).map((maskContainer: MaskContainer) => {
    const containerAdjustments = maskContainer.adjustments || {};
    const normalizedSubMasks = (maskContainer.subMasks || []).map((subMask: Partial<SubMask>) => ({
      visible: true,
      mode: SubMaskMode.Additive,
      ...subMask,
    }));

    return {
      ...INITIAL_MASK_CONTAINER,
      id: maskContainer.id || uuidv4(),
      ...maskContainer,
      adjustments: {
        ...INITIAL_MASK_ADJUSTMENTS,
        ...containerAdjustments,
        colorGrading: { ...INITIAL_MASK_ADJUSTMENTS.colorGrading, ...(containerAdjustments.colorGrading || {}) },
        hsl: { ...INITIAL_MASK_ADJUSTMENTS.hsl, ...(containerAdjustments.hsl || {}) },
        curves: { ...INITIAL_MASK_ADJUSTMENTS.curves, ...(containerAdjustments.curves || {}) },
        sectionVisibility: {
          ...INITIAL_MASK_ADJUSTMENTS.sectionVisibility,
          ...(containerAdjustments.sectionVisibility || {}),
        },
      },
      subMasks: normalizedSubMasks,
    };
  });

  const normalizedAiPatches = (loadedAdjustments.aiPatches || []).map((patch: any) => ({
    visible: true,
    ...patch,
  }));

  return {
    ...INITIAL_ADJUSTMENTS,
    ...loadedAdjustments,
    colorGrading: { ...INITIAL_ADJUSTMENTS.colorGrading, ...(loadedAdjustments.colorGrading || {}) },
    hsl: { ...INITIAL_ADJUSTMENTS.hsl, ...(loadedAdjustments.hsl || {}) },
    curves: { ...INITIAL_ADJUSTMENTS.curves, ...(loadedAdjustments.curves || {}) },
    masks: normalizedMasks,
    aiPatches: normalizedAiPatches,
    sectionVisibility: {
      ...INITIAL_ADJUSTMENTS.sectionVisibility,
      ...(loadedAdjustments.sectionVisibility || {}),
    },
  };
};

export const COPYABLE_ADJUSTMENT_KEYS: Array<string> = [
  BasicAdjustment.Blacks,
  Effect.Clarity,
  ColorAdjustment.ColorGrading,
  DetailsAdjustment.ColorNoiseReduction,
  BasicAdjustment.Contrast,
  'curves',
  Effect.Dehaze,
  Effect.EnableNegativeConversion,
  BasicAdjustment.Exposure,
  Effect.FilmBaseColor,
  Effect.GrainAmount,
  Effect.GrainRoughness,
  Effect.GrainSize,
  BasicAdjustment.Highlights,
  ColorAdjustment.Hsl,
  DetailsAdjustment.LumaNoiseReduction,
  Effect.NegativeBlueBalance,
  Effect.NegativeGreenBalance,
  Effect.NegativeRedBalance,
  ColorAdjustment.Saturation,
  'sectionVisibility',
  BasicAdjustment.Shadows,
  DetailsAdjustment.Sharpness,
  Effect.Structure,
  ColorAdjustment.Temperature,
  ColorAdjustment.Tint,
  ColorAdjustment.Vibrance,
  Effect.VignetteAmount,
  Effect.VignetteFeather,
  Effect.VignetteMidpoint,
  Effect.VignetteRoundness,
  BasicAdjustment.Whites,
];

export const ADJUSTMENT_SECTIONS: Sections = {
  basic: [
    BasicAdjustment.Blacks,
    BasicAdjustment.Contrast,
    BasicAdjustment.Exposure,
    BasicAdjustment.Highlights,
    BasicAdjustment.Shadows,
    BasicAdjustment.Whites,
  ],
  curves: ['curves'],
  color: [
    ColorAdjustment.Saturation,
    ColorAdjustment.Temperature,
    ColorAdjustment.Tint,
    ColorAdjustment.Vibrance,
    ColorAdjustment.Hsl,
    ColorAdjustment.ColorGrading,
  ],
  details: [DetailsAdjustment.Sharpness, DetailsAdjustment.LumaNoiseReduction, DetailsAdjustment.ColorNoiseReduction],
  effects: [
    Effect.Clarity,
    Effect.Dehaze,
    Effect.EnableNegativeConversion,
    Effect.FilmBaseColor,
    Effect.GrainAmount,
    Effect.GrainRoughness,
    Effect.GrainSize,
    Effect.NegativeBlueBalance,
    Effect.NegativeGreenBalance,
    Effect.NegativeRedBalance,
    Effect.Structure,
    Effect.VignetteAmount,
    Effect.VignetteFeather,
    Effect.VignetteMidpoint,
    Effect.VignetteRoundness,
  ],
};
