/**
 * Shared Figure Drawing Utilities
 * Common figure rendering for both GM and Table clients
 */

/** Figure type to color mapping */
export const FIGURE_COLORS = {
  enemy: '#ef4444',   // red-500
  player: '#22c55e',  // green-500
  poi: '#f59e0b'      // amber-500
};

/** Default figure radius */
export const FIGURE_RADIUS = 20;

/** Selection ring color */
export const SELECTION_COLOR = '#fbbf24'; // amber-400

/**
 * Draw a single figure on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {{type: string, position: {x: number, y: number}, number?: number, id?: string}} figure - Figure data
 * @param {Object} [options] - Drawing options
 * @param {boolean} [options.isSelected=false] - Whether to draw selection ring
 * @param {number} [options.opacity=1.0] - Figure opacity
 * @param {number} [options.radius=20] - Base radius
 */
export function drawFigure(ctx, figure, options = {}) {
  const {
    isSelected = false,
    opacity = 1.0,
    radius = FIGURE_RADIUS
  } = options;

  const { x, y } = figure.position;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Draw selection ring if selected
  if (isSelected) {
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw colored circle
  ctx.fillStyle = FIGURE_COLORS[figure.type] || FIGURE_COLORS.poi;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Draw white border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw number or POI symbol
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${radius * 1.2}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (figure.type === 'poi') {
    ctx.fillText('\u2605', x, y); // Star symbol
  } else {
    ctx.fillText(String(figure.number || ''), x, y);
  }

  ctx.restore();
}

/**
 * Draw multiple figures on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Array} figures - Array of figure objects
 * @param {Object} [options] - Drawing options
 * @param {string|null} [options.selectedId=null] - ID of selected figure
 * @param {number} [options.opacity=1.0] - Default opacity for all figures
 */
export function drawFigures(ctx, figures, options = {}) {
  const { selectedId = null, opacity = 1.0 } = options;

  figures.forEach(figure => {
    drawFigure(ctx, figure, {
      isSelected: figure.id === selectedId,
      opacity
    });
  });
}

/**
 * Find figure at given position (hit testing)
 * @param {Array} figures - Array of figure objects
 * @param {{x: number, y: number}} pos - Position to test
 * @param {number} [hitRadius=30] - Hit detection radius
 * @returns {Object|undefined} Figure at position, or undefined
 */
export function findFigureAtPosition(figures, pos, hitRadius = 30) {
  return figures.find(fig => {
    const dx = fig.position.x - pos.x;
    const dy = fig.position.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < hitRadius;
  });
}

/**
 * Generate unique ID for a new figure
 * @returns {string} Unique figure ID
 */
export function generateFigureId() {
  return 'fig_' + Math.random().toString(36).substr(2, 9) + Date.now();
}
