import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Stage, Layer, Ellipse, Line, Transformer, Group, Circle, Rect } from 'react-konva';
import { PercentCrop, Crop } from 'react-image-crop';
import clsx from 'clsx';
import { Adjustments, AiPatch, Coord, MaskContainer } from '../../../utils/adjustments';
import { Mask, SubMask, SubMaskMode, ToolType } from '../right/Masks';
import { BrushSettings, SelectedImage } from '../../ui/AppProperties';
import { RenderSize } from '../../../hooks/useImageRenderSize';

interface CursorPreview {
  visible: boolean;
  x: number;
  y: number;
}

interface DrawnLine {
  brushSize: number;
  feather?: number;
  points: Array<Coord>;
  tool: ToolType;
}

interface ImageCanvasProps {
  activeAiPatchContainerId: string | null;
  activeAiSubMaskId: string | null;
  activeMaskContainerId: string | null;
  activeMaskId: string | null;
  adjustments: Adjustments;
  brushSettings: BrushSettings | null;
  crop: Crop | null;
  finalPreviewUrl: string | null;
  handleCropComplete(c: Crop, cp: PercentCrop): void;
  imageRenderSize: RenderSize;
  isAdjusting: boolean;
  isAiEditing: boolean;
  isCropping: boolean;
  isMaskControlHovered: boolean;
  isMasking: boolean;
  isStraightenActive: boolean;
  maskOverlayUrl: string | null;
  onGenerateAiMask(id: string | null, start: Coord, end: Coord): void;
  onQuickErase(subMaskId: string | null, startPoint: Coord, endpoint: Coord): void;
  onSelectAiSubMask(id: string | null): void;
  onSelectMask(id: string | null): void;
  onStraighten(val: number): void;
  selectedImage: SelectedImage;
  setCrop(crop: Crop, perfentCrop: PercentCrop): void;
  setIsMaskHovered(isHovered: boolean): void;
  showOriginal: boolean;
  uncroppedAdjustedPreviewUrl: string | null;
  updateSubMask(id: string | null, subMask: Partial<SubMask>): void;
  fullResolutionUrl?: string | null;
  isFullResolution?: boolean;
  isLoadingFullRes?: boolean;
}

interface ImageLayer {
  id: string;
  opacity: number;
  url: string | null;
}

interface MaskOverlay {
  adjustments: Adjustments;
  isSelected: boolean;
  onMaskMouseEnter(): void;
  onMaskMouseLeave(): void;
  onSelect(): void;
  onUpdate(id: string, subMask: Partial<SubMask>): void;
  scale: number;
  subMask: SubMask;
}

const ORIGINAL_LAYER = 'original';

function linesIntersect(eraserLine: DrawnLine, drawnLine: DrawnLine) {
  const threshold = eraserLine.brushSize / 2 + drawnLine.brushSize / 2;
  for (const p1 of eraserLine.points) {
    for (const p2 of drawnLine.points) {
      const distance = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
      if (distance < threshold) {
        return true;
      }
    }
  }
  return false;
}

const MaskOverlay = memo(
  ({
    adjustments,
    isSelected,
    onMaskMouseEnter,
    onMaskMouseLeave,
    onSelect,
    onUpdate,
    scale,
    subMask,
  }: MaskOverlay) => {
    const shapeRef = useRef<any>(null);
    const trRef = useRef<any>(null);

    const crop = adjustments.crop;
    const cropX = crop ? crop.x : 0;
    const cropY = crop ? crop.y : 0;

    useEffect(() => {
      if (isSelected && trRef.current && shapeRef.current) {
        trRef.current?.nodes([shapeRef.current]);
        trRef.current?.getLayer().batchDraw();
      }
    }, [isSelected]);

    const handleRadialDrag = useCallback(
      (e: any) => {
        onUpdate(subMask.id, {
          parameters: {
            ...subMask.parameters,
            centerX: e.target.x() / scale + cropX,
            centerY: e.target.y() / scale + cropY,
          },
        });
      },
      [subMask.id, subMask.parameters, onUpdate, scale, cropX, cropY],
    );

    const handleRadialTransform = useCallback(() => {
      const node = shapeRef.current;
      if (!node) {
        return;
      }

      onUpdate(subMask.id, {
        parameters: {
          ...subMask.parameters,
          centerX: node.x() / scale + cropX,
          centerY: node.y() / scale + cropY,
          radiusX: (node.radiusX() * node.scaleX()) / scale,
          radiusY: (node.radiusY() * node.scaleY()) / scale,
          rotation: node.rotation(),
        },
      });
    }, [subMask.id, subMask.parameters, onUpdate, scale, cropX, cropY]);

    const handleRadialTransformEnd = useCallback(() => {
      const node = shapeRef.current;
      if (!node) {
        return;
      }

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      node.scaleX(1);
      node.scaleY(1);

      onUpdate(subMask.id, {
        parameters: {
          ...subMask.parameters,
          centerX: node.x() / scale + cropX,
          centerY: node.y() / scale + cropY,
          radiusX: (node.radiusX() * scaleX) / scale,
          radiusY: (node.radiusY() * scaleY) / scale,
          rotation: node.rotation(),
        },
      });
    }, [subMask.id, subMask.parameters, onUpdate, scale, cropX, cropY]);

    const handleGroupDragEnd = (e: any) => {
      const group = e.target;
      const { startX, startY, endX, endY } = subMask.parameters;
      const dx = endX - startX;
      const dy = endY - startY;
      const centerX = startX + dx / 2;
      const centerY = startY + dy / 2;
      const groupX = (centerX - cropX) * scale;
      const groupY = (centerY - cropY) * scale;
      const moveX = group.x() - groupX;
      const moveY = group.y() - groupY;
      onUpdate(subMask.id, {
        parameters: {
          ...subMask.parameters,
          startX: startX + moveX / scale,
          startY: startY + moveY / scale,
          endX: endX + moveX / scale,
          endY: endY + moveY / scale,
        },
      });
    };

    const handlePointDrag = (e: any, point: string) => {
      const stage = e.target.getStage();
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) {
        return;
      }

      const newX = pointerPos.x / scale + cropX;
      const newY = pointerPos.y / scale + cropY;

      const newParams = { ...subMask.parameters };
      if (point === 'start') {
        newParams.startX = newX;
        newParams.startY = newY;
      } else {
        newParams.endX = newX;
        newParams.endY = newY;
      }
      onUpdate(subMask.id, { parameters: newParams });
    };

    const handleRangeDrag = (e: any) => {
      const newRange = Math.abs(e.target.y() / scale);
      onUpdate(subMask.id, {
        parameters: { ...subMask.parameters, range: newRange },
      });
    };

    if (!subMask.visible) {
      return null;
    }

    const commonProps = {
      dash: [4, 4],
      onClick: onSelect,
      onTap: onSelect,
      opacity: isSelected ? 1 : 0.7,
      stroke: isSelected ? '#0ea5e9' : subMask.mode === SubMaskMode.Subtractive ? '#f43f5e' : 'white',
      strokeScaleEnabled: false,
      strokeWidth: isSelected ? 3 : 2,
    };

    if (subMask.type === Mask.AiSubject) {
      const { startX, startY, endX, endY } = subMask.parameters;
      if (endX > startX && endY > startY) {
        return (
          <Rect
            height={(endY - startY) * scale}
            onMouseEnter={onMaskMouseEnter}
            onMouseLeave={onMaskMouseLeave}
            width={(endX - startX) * scale}
            x={(startX - cropX) * scale}
            y={(startY - cropY) * scale}
            {...commonProps}
          />
        );
      }
      return null;
    }

    if (subMask.type === Mask.Brush) {
      const { lines = [] } = subMask.parameters;
      return (
        <Group onClick={onSelect} onTap={onSelect}>
          {lines.map((line: DrawnLine, i: number) => (
            <Line
              dash={[4, 4]}
              hitStrokeWidth={line.brushSize * scale}
              key={i}
              lineCap="round"
              lineJoin="round"
              opacity={isSelected ? 1 : 0.7}
              points={line.points.flatMap((p: Coord) => [(p.x - cropX) * scale, (p.y - cropY) * scale])}
              stroke={isSelected ? '#0ea5e9' : subMask.mode === SubMaskMode.Subtractive ? '#f43f5e' : 'white'}
              strokeScaleEnabled={false}
              strokeWidth={isSelected ? 3 : 2}
              tension={0.5}
            />
          ))}
        </Group>
      );
    }

    if (subMask.type === Mask.Radial) {
      const { centerX, centerY, radiusX, radiusY, rotation } = subMask.parameters;
      return (
        <>
          <Ellipse
            draggable
            onDragEnd={handleRadialDrag}
            onDragMove={handleRadialDrag}
            onMouseEnter={onMaskMouseEnter}
            onMouseLeave={onMaskMouseLeave}
            onTransform={handleRadialTransform}
            onTransformEnd={handleRadialTransformEnd}
            radiusX={radiusX * scale}
            radiusY={radiusY * scale}
            ref={shapeRef}
            rotation={rotation}
            x={(centerX - cropX) * scale}
            y={(centerY - cropY) * scale}
            {...commonProps}
          />
          {isSelected && (
            <Transformer
              boundBoxFunc={(oldBox, newBox) => newBox}
              onMouseEnter={onMaskMouseEnter}
              onMouseLeave={onMaskMouseLeave}
              ref={trRef}
            />
          )}
        </>
      );
    }

    if (subMask.type === Mask.Linear) {
      const { startX, startY, endX, endY, range = 50 } = subMask.parameters;
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const centerX = startX + dx / 2;
      const centerY = startY + dy / 2;
      const groupX = (centerX - cropX) * scale;
      const groupY = (centerY - cropY) * scale;
      const scaledLen = len * scale;
      const r = range * scale;

      const lineProps = {
        ...commonProps,
        strokeWidth: isSelected ? 2.5 : 2,
        dash: [6, 6],
        hitStrokeWidth: 20,
      };

      const perpendicularDragBoundFunc = function (pos: any) {
        const group = this.getParent();
        const transform = group.getAbsoluteTransform().copy();
        transform.invert();
        const localPos = transform.point(pos);
        const constrainedLocalPos = { x: 0, y: localPos.y };
        return group.getAbsoluteTransform().point(constrainedLocalPos);
      };

      return (
        <Group
          draggable={isSelected}
          onClick={onSelect}
          onDragEnd={handleGroupDragEnd}
          onMouseEnter={(e: any) => {
            onMaskMouseEnter();
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'move';
            }
          }}
          onMouseLeave={(e: any) => {
            onMaskMouseLeave();
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'default';
            }
          }}
          onTap={onSelect}
          rotation={(angle * 180) / Math.PI}
          x={groupX}
          y={groupY}
        >
          <Line points={[-5000, 0, 5000, 0]} {...lineProps} dash={[2, 3]} />
          <Line
            {...lineProps}
            dragBoundFunc={perpendicularDragBoundFunc}
            draggable={isSelected}
            onDragMove={handleRangeDrag}
            onDragEnd={(e: any) => {
              handleRangeDrag(e);
              e.cancelBubble = true;
            }}
            onMouseEnter={(e: any) => {
              e.target.getStage().container().style.cursor = 'row-resize';
              onMaskMouseEnter();
            }}
            onMouseLeave={(e: any) => {
              e.target.getStage().container().style.cursor = 'move';
              onMaskMouseLeave();
            }}
            points={[-scaledLen / 2, 0, scaledLen / 2, 0]}
            y={-r}
          />
          <Line
            {...lineProps}
            draggable={isSelected}
            dragBoundFunc={perpendicularDragBoundFunc}
            onDragEnd={(e: any) => {
              handleRangeDrag(e);
              e.cancelBubble = true;
            }}
            onDragMove={handleRangeDrag}
            onMouseEnter={(e: any) => {
              e.target.getStage().container().style.cursor = 'row-resize';
              onMaskMouseEnter();
            }}
            onMouseLeave={(e: any) => {
              e.target.getStage().container().style.cursor = 'move';
              onMaskMouseLeave();
            }}
            points={[-scaledLen / 2, 0, scaledLen / 2, 0]}
            y={r}
          />
          {isSelected && (
            <>
              <Circle
                draggable
                fill="#0ea5e9"
                onDragEnd={(e: any) => {
                  handlePointDrag(e, 'start');
                  e.cancelBubble = true;
                }}
                onDragMove={(e: any) => handlePointDrag(e, 'start')}
                onMouseEnter={(e: any) => {
                  e.target.getStage().container().style.cursor = 'grab';
                  onMaskMouseEnter();
                }}
                onMouseLeave={(e: any) => {
                  e.target.getStage().container().style.cursor = 'move';
                  onMaskMouseLeave();
                }}
                radius={8}
                stroke="white"
                strokeWidth={2}
                x={-scaledLen / 2}
                y={0}
              />
              <Circle
                draggable
                fill="#0ea5e9"
                onDragEnd={(e: any) => {
                  handlePointDrag(e, 'end');
                  e.cancelBubble = true;
                }}
                onDragMove={(e: any) => handlePointDrag(e, 'end')}
                onMouseEnter={(e: any) => {
                  e.target.getStage().container().style.cursor = 'grab';
                  onMaskMouseEnter();
                }}
                onMouseLeave={(e: any) => {
                  e.target.getStage().container().style.cursor = 'move';
                  onMaskMouseLeave();
                }}
                radius={8}
                stroke="white"
                strokeWidth={2}
                x={scaledLen / 2}
                y={0}
              />
            </>
          )}
        </Group>
      );
    }
    return null;
  },
);

const ImageCanvas = memo(
  ({
    activeAiPatchContainerId,
    activeAiSubMaskId,
    activeMaskContainerId,
    activeMaskId,
    adjustments,
    brushSettings,
    crop,
    finalPreviewUrl,
    handleCropComplete,
    imageRenderSize,
    isAdjusting,
    isAiEditing,
    isCropping,
    isMaskControlHovered,
    isMasking,
    isStraightenActive,
    maskOverlayUrl,
    onGenerateAiMask,
    onQuickErase,
    onSelectAiSubMask,
    onSelectMask,
    onStraighten,
    selectedImage,
    setCrop,
    setIsMaskHovered,
    showOriginal,
    uncroppedAdjustedPreviewUrl,
    updateSubMask,
    fullResolutionUrl,
    isFullResolution,
    isLoadingFullRes,
  }: ImageCanvasProps) => {
    const [isCropViewVisible, setIsCropViewVisible] = useState(false);
    const imagePathRef = useRef<string>(null);
    const latestEditedUrlRef = useRef<string>(null);
    const [layers, setLayers] = useState<Array<ImageLayer>>([]);
    const cropImageRef = useRef<HTMLImageElement>(null);
    const prevTransformPropsRef = useRef<any>(null);

    const isDrawing = useRef(false);
    const currentLine = useRef<DrawnLine>(null);
    const [previewLine, setPreviewLine] = useState<DrawnLine | null>(null);
    const [cursorPreview, setCursorPreview] = useState<CursorPreview>({ x: 0, y: 0, visible: false });
    const [straightenLine, setStraightenLine] = useState<any>(null);
    const isStraightening = useRef(false);

    const activeContainer = useMemo(() => {
      if (isMasking) {
        return adjustments.masks.find((c: MaskContainer) => c.id === activeMaskContainerId);
      }
      if (isAiEditing) {
        return adjustments.aiPatches.find((p: AiPatch) => p.id === activeAiPatchContainerId);
      }
      return null;
    }, [
      adjustments.masks,
      adjustments.aiPatches,
      activeMaskContainerId,
      activeAiPatchContainerId,
      isMasking,
      isAiEditing,
    ]);

    const activeSubMask = useMemo(() => {
      if (!activeContainer) {
        return null;
      }
      if (isMasking) {
        return activeContainer.subMasks.find((m: SubMask) => m.id === activeMaskId);
      }
      if (isAiEditing) {
        return activeContainer.subMasks.find((m: SubMask) => m.id === activeAiSubMaskId);
      }
      return null;
    }, [activeContainer, activeMaskId, activeAiSubMaskId, isMasking, isAiEditing]);

    const isBrushActive = (isMasking || isAiEditing) && activeSubMask?.type === Mask.Brush;
    const isAiSubjectActive =
      (isMasking || isAiEditing) &&
      (activeSubMask?.type === Mask.AiSubject || activeSubMask?.type === Mask.QuickEraser);
    const isToolActive = isBrushActive || isAiSubjectActive;

    const sortedSubMasks = useMemo(() => {
      if (!activeContainer) {
        return [];
      }
      const activeId = isMasking ? activeMaskId : activeAiSubMaskId;
      const selectedMask = activeContainer.subMasks.find((m: SubMask) => m.id === activeId);
      const otherMasks = activeContainer.subMasks.filter((m: SubMask) => m.id !== activeId);
      return selectedMask ? [...otherMasks, selectedMask] : activeContainer.subMasks;
    }, [activeContainer, activeMaskId, activeAiSubMaskId, isMasking, isAiEditing]);

    useEffect(() => {
      const { path: currentImagePath, originalUrl, thumbnailUrl } = selectedImage;
      const topLayer = layers[layers.length - 1];
      const imageChanged = currentImagePath !== imagePathRef.current;

      const rotationChanged =
        !imageChanged &&
        prevTransformPropsRef.current &&
        prevTransformPropsRef.current.rotation !== adjustments.rotation;
      const aspectRatioChanged =
        !imageChanged &&
        prevTransformPropsRef.current &&
        prevTransformPropsRef.current.aspectRatio !== adjustments.aspectRatio;

      if (imageChanged || rotationChanged || aspectRatioChanged) {
        imagePathRef.current = currentImagePath;
        prevTransformPropsRef.current = {
          rotation: adjustments.rotation,
          aspectRatio: adjustments.aspectRatio,
        };
        latestEditedUrlRef.current = null;

        const initialUrl = thumbnailUrl || originalUrl;
        if (initialUrl) {
          setLayers([{ id: initialUrl, url: initialUrl, opacity: 1 }]);
        } else {
          setLayers([]);
        }
        return;
      }

      if (showOriginal) {
        if (topLayer?.id !== ORIGINAL_LAYER) {
          setLayers((prev: Array<ImageLayer>) => [...prev, { id: ORIGINAL_LAYER, url: originalUrl, opacity: 0 }]);
        }
        return;
      } else if (!showOriginal && topLayer?.id === ORIGINAL_LAYER) {
        const urlToShow = (isFullResolution && fullResolutionUrl) 
          ? fullResolutionUrl 
          : (latestEditedUrlRef.current || finalPreviewUrl || originalUrl || thumbnailUrl);
        if (urlToShow) {
            setLayers((prev: Array<ImageLayer>) => [...prev, { id: urlToShow, url: urlToShow, opacity: 0 }]);
        }
        return;
      }

      if (!showOriginal) {
        if (isFullResolution && fullResolutionUrl && fullResolutionUrl !== latestEditedUrlRef.current) {
          latestEditedUrlRef.current = fullResolutionUrl;
          const img = new Image();
          img.src = fullResolutionUrl;
          img.onload = () => {
            if (img.src === latestEditedUrlRef.current && !showOriginal) {
              if (layers.length === 0) {
                setLayers([{ id: img.src, url: img.src, opacity: 1 }]);
              } else {
                setLayers((prev: Array<ImageLayer>) => [...prev, { id: img.src, url: img.src, opacity: 0 }]);
              }
            }
          };
          return () => { img.onload = null; };
        }

        if (!isFullResolution && !fullResolutionUrl && finalPreviewUrl && finalPreviewUrl !== latestEditedUrlRef.current) {
          latestEditedUrlRef.current = finalPreviewUrl;
          const img = new Image();
          img.src = finalPreviewUrl;
          img.onload = () => {
            if (img.src === latestEditedUrlRef.current && !showOriginal) {
              if (layers.length === 0) {
                setLayers([{ id: img.src, url: img.src, opacity: 1 }]);
              } else {
                setLayers((prev: Array<ImageLayer>) => [...prev, { id: img.src, url: img.src, opacity: 0 }]);
              }
            }
          };
          return () => { img.onload = null; };
        }
      }

      if (layers.length === 0 && !finalPreviewUrl && !fullResolutionUrl) {
        const initialUrl = originalUrl || thumbnailUrl;
        if (initialUrl && initialUrl !== latestEditedUrlRef.current) {
          latestEditedUrlRef.current = initialUrl;
          setLayers([{ id: initialUrl, url: initialUrl, opacity: 1 }]);
        }
      }
    }, [selectedImage, finalPreviewUrl, fullResolutionUrl, isFullResolution, showOriginal, layers, adjustments.rotation, adjustments.aspectRatio]);

    useEffect(() => {
      const layerToFadeIn = layers.find((l: ImageLayer) => l.opacity === 0);
      if (layerToFadeIn) {
        const timer = setTimeout(() => {
          setLayers((prev: Array<ImageLayer>) =>
            prev.map((l: ImageLayer) => (l.id === layerToFadeIn.id ? { ...l, opacity: 1 } : l)),
          );
        }, 10);

        return () => clearTimeout(timer);
      }
    }, [layers]);

    const handleTransitionEnd = useCallback((finishedId: string) => {
      setLayers((prev: Array<ImageLayer>) =>
        prev.length > 1 ? prev.filter((l: ImageLayer) => l.id === finishedId) : prev,
      );
    }, []);

    useEffect(() => {
      if (isCropping) {
        const timer = setTimeout(() => setIsCropViewVisible(true), 10);
        return () => clearTimeout(timer);
      } else {
        setIsCropViewVisible(false);
      }
    }, [isCropping]);

    const handleMouseDown = useCallback(
      (e: any) => {
        if (isToolActive) {
          e.evt.preventDefault();
          isDrawing.current = true;
          const stage = e.target.getStage();
          const pos = stage.getPointerPosition();
          if (!pos) {
            return;
          }

          const toolType = isAiSubjectActive ? ToolType.AiSeletor : ToolType.Brush;

          const newLine: DrawnLine = {
            brushSize: isBrushActive && brushSettings?.size ? brushSettings.size : 2,
            points: [pos],
            tool: toolType,
          };
          currentLine.current = newLine;
          setPreviewLine(newLine);
        } else {
          if (e.target === e.target.getStage()) {
            if (isMasking) {
              onSelectMask(null);
            }
            if (isAiEditing) {
              onSelectAiSubMask(null);
            }
          }
        }
      },
      [isBrushActive, isAiSubjectActive, brushSettings, onSelectMask, onSelectAiSubMask, isMasking, isAiEditing],
    );

    const handleMouseMove = useCallback(
      (e: any) => {
        if (isToolActive) {
          const stage = e.target.getStage();
          const pos = stage.getPointerPosition();
          if (pos) {
            setCursorPreview({ x: pos.x, y: pos.y, visible: true });
          } else {
            setCursorPreview((p: CursorPreview) => ({ ...p, visible: false }));
          }
        }

        if (!isDrawing.current || !isToolActive) {
          return;
        }

        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) {
          return;
        }

        if (currentLine.current) {
          const updatedLine = {
            ...currentLine.current,
            points: [...currentLine.current.points, pos],
          };
          currentLine.current = updatedLine;
          setPreviewLine(updatedLine);
        }
      },
      [isBrushActive, isAiSubjectActive],
    );

    const handleMouseUp = useCallback(() => {
      if (!isDrawing.current || !currentLine.current) {
        return;
      }

      const wasDrawing = isDrawing.current;
      isDrawing.current = false;
      const line = currentLine.current;
      currentLine.current = null;
      setPreviewLine(null);

      if (!wasDrawing || !line) {
        return;
      }

      const { scale } = imageRenderSize;
      const cropX = adjustments.crop?.x || 0;
      const cropY = adjustments.crop?.y || 0;

      const activeId = isMasking ? activeMaskId : activeAiSubMaskId;

      if (activeSubMask?.type === Mask.AiSubject || activeSubMask?.type === Mask.QuickEraser) {
        const points = line.points;
        if (points.length > 1) {
          const xs = points.map((p: Coord) => p.x);
          const ys = points.map((p: Coord) => p.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);

          const startPoint = { x: minX / scale + cropX, y: minY / scale + cropY };
          const endPoint = { x: maxX / scale + cropX, y: maxY / scale + cropY };

          if (activeSubMask.type === Mask.QuickEraser && onQuickErase) {
            onQuickErase(activeId, startPoint, endPoint);
          } else if (activeSubMask.type === Mask.QuickEraser && onGenerateAiMask) {
            onGenerateAiMask(activeId, startPoint, endPoint);
          }
        }
      } else if (isBrushActive) {
        const imageSpaceLine: DrawnLine = {
          brushSize: brushSettings?.size ?? 0,
          feather: brushSettings?.feather ? brushSettings?.feather / 100 : 0,
          points: line.points.map((p: Coord) => ({
            x: p.x / scale + cropX,
            y: p.y / scale + cropY,
          })),
          tool: brushSettings?.tool ?? ToolType.Brush,
        };

        const existingLines = activeSubMask.parameters.lines || [];

        if (brushSettings?.tool === ToolType.Eraser) {
          const remainingLines = existingLines.filter(
            (drawnLine: DrawnLine) => !linesIntersect(imageSpaceLine, drawnLine),
          );
          if (remainingLines.length !== existingLines.length) {
            updateSubMask(activeId, {
              parameters: { ...activeSubMask.parameters, lines: remainingLines },
            });
          }
        } else {
          updateSubMask(activeId, {
            parameters: {
              ...activeSubMask.parameters,
              lines: [...existingLines, imageSpaceLine],
            },
          });
        }
      }
    }, [
      activeAiSubMaskId,
      activeMaskId,
      activeSubMask,
      adjustments.crop,
      brushSettings,
      imageRenderSize.scale,
      isAiEditing,
      isAiSubjectActive,
      isBrushActive,
      isMasking,
      onGenerateAiMask,
      onQuickErase,
      updateSubMask,
    ]);

    const handleMouseEnter = useCallback(() => {
      if (isToolActive) {
        setCursorPreview((p: CursorPreview) => ({ ...p, visible: true }));
      }
    }, [isBrushActive, isAiSubjectActive]);

    const handleMouseLeave = useCallback(() => {
      setCursorPreview((p: CursorPreview) => ({ ...p, visible: false }));
      if (isDrawing.current) {
        handleMouseUp();
      }
    }, [handleMouseUp]);

    const handleStraightenMouseDown = (e: any) => {
      if (e.evt.button !== 0) {
        return;
      }

      isStraightening.current = true;
      const pos = e.target.getStage().getPointerPosition();
      setStraightenLine({ start: pos, end: pos });
    };

    const handleStraightenMouseMove = (e: any) => {
      if (!isStraightening.current) {
        return;
      }

      const pos = e.target.getStage().getPointerPosition();
      setStraightenLine((prev: any) => ({ ...prev, end: pos }));
    };

    const handleStraightenMouseUp = () => {
      if (!isStraightening.current) {
        return;
      }
      isStraightening.current = false;
      if (
        !straightenLine ||
        (straightenLine.start.x === straightenLine.end.x && straightenLine.start.y === straightenLine.start.y)
      ) {
        setStraightenLine(null);
        return;
      }

      const { start, end } = straightenLine;
      const { rotation = 0 } = adjustments;
      const theta_rad = (rotation * Math.PI) / 180;
      const cos_t = Math.cos(theta_rad);
      const sin_t = Math.sin(theta_rad);
      const width = uncroppedImageRenderSize?.width ?? 0;
      const height = uncroppedImageRenderSize?.height ?? 0;
      const cx = width / 2;
      const cy = height / 2;

      const unrotate = (p: Coord) => {
        const x = p.x - cx;
        const y = p.y - cy;
        return {
          x: cx + x * cos_t + y * sin_t,
          y: cy - x * sin_t + y * cos_t,
        };
      };

      const start_unrotated = unrotate(start);
      const end_unrotated = unrotate(end);
      const dx = end_unrotated.x - start_unrotated.x;
      const dy = end_unrotated.y - start_unrotated.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      let targetAngle;

      if (angle > -45 && angle <= 45) {
        targetAngle = 0;
      } else if (angle > 45 && angle <= 135) {
        targetAngle = 90;
      } else if (angle > 135 || angle <= -135) {
        targetAngle = 180;
      } else {
        targetAngle = -90;
      }

      let correction = targetAngle - angle;
      if (correction > 180) {
        correction -= 360;
      }
      if (correction < -180) {
        correction += 360;
      }

      onStraighten(correction);
      setStraightenLine(null);
    };

    const handleStraightenMouseLeave = () => {
      if (isStraightening.current) {
        isStraightening.current = false;
        setStraightenLine(null);
      }
    };

    const cropPreviewUrl = uncroppedAdjustedPreviewUrl || selectedImage.originalUrl;
    const isContentReady = layers.length > 0 || selectedImage.thumbnailUrl;

    const uncroppedImageRenderSize = useMemo<Partial<RenderSize> | null>(() => {
      if (!selectedImage?.width || !selectedImage?.height || !imageRenderSize?.width || !imageRenderSize?.height) {
        return null;
      }

      const viewportWidth = imageRenderSize.width + 2 * imageRenderSize.offsetX;
      const viewportHeight = imageRenderSize.height + 2 * imageRenderSize.offsetY;

      let uncroppedEffectiveWidth = selectedImage.width;
      let uncroppedEffectiveHeight = selectedImage.height;
      const orientationSteps = adjustments.orientationSteps || 0;
      if (orientationSteps === 1 || orientationSteps === 3) {
        [uncroppedEffectiveWidth, uncroppedEffectiveHeight] = [uncroppedEffectiveHeight, uncroppedEffectiveWidth];
      }

      if (uncroppedEffectiveWidth <= 0 || uncroppedEffectiveHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
        return null;
      }

      const scale = Math.min(viewportWidth / uncroppedEffectiveWidth, viewportHeight / uncroppedEffectiveHeight);

      const renderWidth = uncroppedEffectiveWidth * scale;
      const renderHeight = uncroppedEffectiveHeight * scale;

      return { width: renderWidth, height: renderHeight };
    }, [selectedImage?.width, selectedImage?.height, imageRenderSize, adjustments.orientationSteps]);

    const cropImageTransforms = useMemo(() => {
      const transforms = [`rotate(${adjustments.rotation || 0}deg)`];
      if (adjustments.flipHorizontal) {
        transforms.push('scaleX(-1)');
      }
      if (adjustments.flipVertical) {
        transforms.push('scaleY(-1)');
      }
      return transforms.join(' ');
    }, [adjustments.rotation, adjustments.flipHorizontal, adjustments.flipVertical]);

    return (
      <div className="relative" style={{ width: '100%', height: '100%' }}>
        <div
          className="absolute inset-0 w-full h-full transition-opacity duration-200 flex items-center justify-center"
          style={{
            opacity: isCropViewVisible ? 0 : 1,
            pointerEvents: isCropViewVisible ? 'none' : 'auto',
          }}
        >
          <div
            className={clsx(
              'transition-opacity duration-300',
              isAdjusting && !showOriginal ? 'opacity-70' : 'opacity-100',
            )}
            style={{
              height: '100%',
              opacity: isContentReady ? 1 : 0,
              position: 'relative',
              width: '100%',
            }}
          >
            <div className="absolute inset-0 w-full h-full">
              {layers.map((layer: ImageLayer) => (
                <img
                  alt={layer.id === ORIGINAL_LAYER ? 'Original' : 'Edited'}
                  className="absolute inset-0 w-full h-full object-contain"
                  key={layer.id}
                  onTransitionEnd={() => handleTransitionEnd(layer.id)}
                  src={layer.url ?? ''}
                  style={{
                    opacity: layer.opacity,
                    transition: 'opacity 150ms ease-in-out',
                    imageRendering: 'high-quality',
                    WebkitImageRendering: 'high-quality',
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                  }}
                />
              ))}
              {(isMasking || isAiEditing) && maskOverlayUrl && (
                <img
                  alt="Mask Overlay"
                  className="absolute object-contain pointer-events-none"
                  src={maskOverlayUrl}
                  style={{
                    height: `${imageRenderSize.height}px`,
                    left: `${imageRenderSize.offsetX}px`,
                    opacity: showOriginal || isMaskControlHovered ? 0 : 1,
                    top: `${imageRenderSize.offsetY}px`,
                    transition: 'opacity 150ms ease-in-out',
                    width: `${imageRenderSize.width}px`,
                  }}
                />
              )}
            </div>
          </div>

          <Stage
            className="transition-opacity duration-300"
            height={imageRenderSize.height}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              cursor: isToolActive ? 'crosshair' : 'default',
              left: `${imageRenderSize.offsetX}px`,
              opacity: showOriginal ? 0 : 1,
              pointerEvents: showOriginal ? 'none' : 'auto',
              position: 'absolute',
              top: `${imageRenderSize.offsetY}px`,
              zIndex: 4,
            }}
            width={imageRenderSize.width}
          >
            <Layer>
              {(isMasking || isAiEditing) &&
                activeContainer &&
                sortedSubMasks.map((subMask: SubMask) => (
                  <MaskOverlay
                    adjustments={adjustments}
                    isSelected={subMask.id === (isMasking ? activeMaskId : activeAiSubMaskId)}
                    key={subMask.id}
                    onMaskMouseEnter={() => !isToolActive && setIsMaskHovered(true)}
                    onMaskMouseLeave={() => !isToolActive && setIsMaskHovered(false)}
                    onSelect={() => (isMasking ? onSelectMask(subMask.id) : onSelectAiSubMask(subMask.id))}
                    onUpdate={updateSubMask}
                    scale={imageRenderSize.scale}
                    subMask={subMask}
                  />
                ))}
              {previewLine && (
                <Line
                  dash={previewLine.tool === ToolType.AiSeletor ? [4, 4] : undefined}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                  opacity={0.8}
                  points={previewLine.points.flatMap((p: Coord) => [p.x, p.y])}
                  stroke={previewLine.tool === ToolType.Eraser ? '#f43f5e' : '#0ea5e9'}
                  strokeWidth={previewLine.tool === ToolType.AiSeletor ? 2 : previewLine.brushSize}
                  tension={0.5}
                />
              )}
              {isBrushActive && cursorPreview.visible && (
                <Circle
                  listening={false}
                  perfectDrawEnabled={false}
                  stroke={brushSettings?.tool === ToolType.Eraser ? '#f43f5e' : '#0ea5e9'}
                  radius={brushSettings?.size ? brushSettings.size / 2 : 0}
                  strokeWidth={1}
                  x={cursorPreview.x}
                  y={cursorPreview.y}
                />
              )}
            </Layer>
          </Stage>
        </div>

        <div
          className="absolute inset-0 w-full h-full flex items-center justify-center transition-opacity duration-200"
          style={{
            opacity: isCropViewVisible ? 1 : 0,
            pointerEvents: isCropViewVisible ? 'auto' : 'none',
          }}
        >
          {cropPreviewUrl && uncroppedImageRenderSize && (
            <div
              style={{
                height: uncroppedImageRenderSize.height,
                position: 'relative',
                width: uncroppedImageRenderSize.width,
              }}
            >
              <ReactCrop
                aspect={adjustments.aspectRatio}
                crop={crop}
                onChange={setCrop}
                onComplete={handleCropComplete}
                ruleOfThirds={!isStraightenActive}
              >
                <img
                  alt="Crop preview"
                  ref={cropImageRef}
                  src={cropPreviewUrl}
                  style={{
                    display: 'block',
                    width: `${uncroppedImageRenderSize.width}px`,
                    height: `${uncroppedImageRenderSize.height}px`,
                    objectFit: 'contain',
                    transform: cropImageTransforms,
                  }}
                />
              </ReactCrop>

              {isStraightenActive && (
                <Stage
                  height={uncroppedImageRenderSize.height}
                  onMouseDown={handleStraightenMouseDown}
                  onMouseLeave={handleStraightenMouseLeave}
                  onMouseMove={handleStraightenMouseMove}
                  onMouseUp={handleStraightenMouseUp}
                  style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, cursor: 'crosshair' }}
                  width={uncroppedImageRenderSize.width}
                >
                  <Layer>
                    {straightenLine && (
                      <Line
                        dash={[4, 4]}
                        listening={false}
                        points={[
                          straightenLine.start.x,
                          straightenLine.start.y,
                          straightenLine.end.x,
                          straightenLine.end.y,
                        ]}
                        stroke="#0ea5e9"
                        strokeWidth={2}
                      />
                    )}
                  </Layer>
                </Stage>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

export default ImageCanvas;
