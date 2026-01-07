# Architecture Notes

## Canvas System (GM Controller)
The GM controller uses a multi-layer canvas system with viewport transforms:

1. **mapCanvas** (z-index: 1) - Base map image
2. **figureCanvas** (z-index: 2) - Player/enemy figures
3. **fogCanvas** (z-index: 3) - Fog of war overlay (0.7 opacity for GM)
4. **previewCanvas** (z-index: 10) - Preview before confirming actions

## Viewport Transform System
- Uses canvas context transforms (`ctx.setTransform()`) instead of CSS transforms
- **Offscreen canvases**: `fogDataCanvas` and `previewDataCanvas` store untransformed data
- Display canvases render from offscreen canvases with viewport transform applied
- Coordinate conversion: `screenToCanvas()` handles CSS scaling + viewport transform

## Key State Objects
```javascript
const viewport = {
  x: 0,        // Pan offset X (internal canvas pixels)
  y: 0,        // Pan offset Y (internal canvas pixels)
  scale: 1,    // Zoom level (0.5 to 3)
  rotation: 0  // Rotation in degrees (0, 90, 180, 270)
};
```

## Pan/Draw Mode
- At 100% zoom: Always draw mode
- When zoomed in: Drag to pan by default, toggle "Draw Mode" button to draw

## Map Interaction Logic
- **Pinch-Zoom**: Anchored to the **initial** pinch center (not updated during gesture). This prevents "walking" or jumping when moving hands while zooming.
- **Multi-touch**: Panning (`isPanning`) is immediately disabled when a second finger is detected (`e.touches.length === 2`) to prevent conflicting updates from single-touch pan logic.
- **Viewport**: `screenToCanvas()` converts client coordinates -> internal canvas resolution -> applied viewport transform.
