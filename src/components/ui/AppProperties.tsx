import React from 'react';
import { Adjustments, Color } from '../../utils/adjustments';
import { ToolType } from '../panel/right/Masks';

export const GLOBAL_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'f', 'b', 'w'];
export const OPTION_SEPARATOR = 'separator';

export enum Invokes {
  ApplyAdjustments = 'apply_adjustments',
  ApplyAdjustmentsToPaths = 'apply_adjustments_to_paths',
  ApplyAutoAdjustmentsToPaths = 'apply_auto_adjustments_to_paths',
  BatchExportImages = 'batch_export_images',
  CalculateAutoAdjustments = 'calculate_auto_adjustments',
  CancelExport = 'cancel_export',
  CheckComfyuiStatus = 'check_comfyui_status',
  ClearAllSidecars = 'clear_all_sidecars',
  ClearAllTags = 'clear_all_tags',
  ClearThumbnailCache = 'clear_thumbnail_cache',
  CopyFiles = 'copy_files',
  CreateFolder = 'create_folder',
  DeleteFolder = 'delete_folder',
  DuplicateFile = 'duplicate_file',
  ExportImage = 'export_image',
  GenerateAiForegroundMask = 'generate_ai_foreground_mask',
  GenerateAiSubjectMask = 'generate_ai_subject_mask',
  GenerateFullscreenPreview = 'generate_fullscreen_preview',
  GenerateHistogram = 'generate_histogram',
  GenerateMaskOverlay = 'generate_mask_overlay',
  GeneratePresetPreview = 'generate_preset_preview',
  GenerateThumbnailsProgressive = 'generate_thumbnails_progressive',
  GenerateUncroppedPreview = 'generate_uncropped_preview',
  GenerateWaveform = 'image_processing::generate_waveform',
  GetFolderTree = 'get_folder_tree',
  GetSupportedFileTypes = 'get_supported_file_types',
  HandleExportPresetsToFile = 'handle_export_presets_to_file',
  HandleImportPresetsFromFile = 'handle_import_presets_from_file',
  ImportFiles = 'import_files',
  InvokeGenerativeReplace = 'invoke_generative_replace',
  InvokeGenerativeReplaseWithMaskDef = 'invoke_generative_replace_with_mask_def',
  ListImagesInDir = 'list_images_in_dir',
  LoadImage = 'load_image',
  LoadMetadata = 'load_metadata',
  LoadPresets = 'load_presets',
  LoadSettings = 'load_settings',
  MoveFiles = 'move_files',
  RenameFiles = 'rename_files',
  RenameFolder = 'rename_folder',
  ResetAdjustmentsForPaths = 'reset_adjustments_for_paths',
  SaveMetadataAndUpdateThumbnail = 'save_metadata_and_update_thumbnail',
  SavePanorama = 'save_panorama',
  SavePresets = 'save_presets',
  SaveSettings = 'save_settings',
  SetColorLabelForPaths = 'set_color_label_for_paths',
  ShowInFinder = 'show_in_finder',
  StartBackgroundIndexing = 'start_background_indexing',
  StitchPanorama = 'stitch_panorama',
  TestComfyuiConnection = 'test_comfyui_connection',
  UpdateWindowEffect = 'update_window_effect',
}

export enum Panel {
  Adjustments = 'adjustments',
  Ai = 'ai',
  Crop = 'crop',
  Export = 'export',
  Masks = 'masks',
  Metadata = 'metadata',
  Presets = 'presets',
}

export enum RawStatus {
  All = 'all',
  NonRawOnly = 'nonRawOnly',
  RawOnly = 'rawOnly',
}

export enum SortDirection {
  Ascending = 'asc',
  Descening = 'desc',
}

export enum Theme {
  Arctic = 'arctic',
  Blue = 'blue',
  Dark = 'dark',
  Grey = 'grey',
  Light = 'light',
  MutedGreen = 'muted-green',
  Sepia = 'sepia',
  Snow = 'snow',
}

export enum ThumbnailAspectRatio {
  Cover = 'cover',
  Contain = 'contain',
}

export interface AppSettings {
  adaptiveEditorTheme?: Theme;
  decorations?: any;
  enableAiTagging?: boolean;
  filterCriteria?: FilterCriteria;
  lastFolderState?: any;
  lastRootPath: string | null;
  sortCriteria?: SortCriteria;
  theme: Theme;
  thumbnailSize?: ThumbnailSize;
  thumbnailAspectRatio?: ThumbnailAspectRatio;
  uiVisibility?: UiVisibility;
}

export interface BrushSettings {
  feather: number;
  size: number;
  tool: ToolType;
}

export interface FilterCriteria {
  colors: Array<string>;
  rating: number;
  rawStatus: RawStatus;
}

export interface Folder {
  children: any;
  id?: string | undefined;
  name?: string | undefined;
}

export interface ImageFile {
  is_edited: boolean;
  modified: number;
  path: string;
  tags: Array<string>;
}

export interface Option {
  color?: string;
  disabled?: boolean;
  icon?: any;
  isDestructive?: boolean;
  label?: string;
  onClick?(): void;
  submenu?: any;
  type?: string;
}

export enum Orientation {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

export interface Preset {
  adjustments: Partial<Adjustments>;
  folder?: Folder;
  id: string;
  name: string;
}

export interface Progress {
  completed?: number;
  current?: number;
  total: number;
}

export interface SelectedImage {
  exif: any;
  height: number;
  isRaw: boolean;
  isReady: boolean;
  metadata?: any;
  original_base64?: string;
  originalUrl: string | null;
  path: string;
  thumbnailUrl: string;
  width: number;
}

export interface SortCriteria {
  key: string;
  label?: string;
  order: string;
}

export interface SupportedTypes {
  nonRaw: Array<string>;
  raw: Array<string>;
}

export enum ThumbnailSize {
  Large = 'large',
  Medium = 'medium',
  Small = 'small',
}

export interface TransformState {
  positionX: number;
  positionY: number;
  scale: number;
}

export interface UiVisibility {
  folderTree: boolean;
  filmstrip: boolean;
}

export interface WaveformData {
  [index: string]: Array<number> | number;
  blue: Array<number>;
  green: Array<number>;
  height: number;
  luma: Array<number>;
  red: Array<number>;
  width: number;
}