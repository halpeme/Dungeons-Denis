/**
 * GM Controller - Figures Module
 * Handles figure palette, placement, and rendering
 */

import {
    figures, setFigures, figureCanvas, figureCtx, selectedFigureType, setSelectedFigureType,
    selectedPlacedFigure, setSelectedPlacedFigure, isFigurePaletteOpen, setIsFigurePaletteOpen,
    ws
} from './state.js';
import { applyViewportTransform } from './viewport.js';

/**
 * Generate unique ID for figures
 */
export function generateFigureId() {
    return 'fig_' + Math.random().toString(36).substr(2, 9) + Date.now();
}

/**
 * Render all confirmed figures with viewport transform
 */
export function renderFiguresLayer() {
    if (!figureCtx || !figureCanvas) return;
    figureCtx.setTransform(1, 0, 0, 1, 0, 0);
    figureCtx.clearRect(0, 0, figureCanvas.width, figureCanvas.height);
    applyViewportTransform(figureCtx);
    figures.forEach(fig => drawFigure(figureCtx, fig, 1.0));
}

/**
 * Render figures and update palette
 */
export function renderFigures() {
    renderFiguresLayer();
    updateFigurePalette();
}

/**
 * Draw a single figure on the canvas
 */
export function drawFigure(ctx, figure, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;

    const radius = 20;
    const { x, y } = figure.position;
    const isSelected = figure.id === selectedPlacedFigure;

    // Draw selection ring if selected
    if (isSelected) {
        ctx.strokeStyle = '#fbbf24'; // amber-400
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw colored circle
    ctx.fillStyle = figure.type === 'enemy' ? '#ef4444' :
        figure.type === 'player' ? '#22c55e' : '#f59e0b';
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
        ctx.fillText('★', x, y);
    } else {
        ctx.fillText(figure.number, x, y);
    }

    ctx.restore();
}

/**
 * Toggle figure type selection from palette
 */
export function toggleFigureSelection(type, number, btn) {
    // Check if this figure type+number already exists on the map
    if (type !== 'poi' && number) {
        const existing = figures.find(f => f.type === type && f.number === number);
        if (existing) {
            // Figure already placed - double-tap removes it
            setFigures(figures.filter(f => f.id !== existing.id));
            renderFigures();
            sendFiguresUpdate();
            updateFigurePalette();
            return;
        }
    }

    // Check if already selected - toggle off
    if (selectedFigureType &&
        selectedFigureType.type === type &&
        selectedFigureType.number === number) {
        setSelectedFigureType(null);
        clearPaletteSelection();
        return;
    }

    // Clear any placed figure selection
    setSelectedPlacedFigure(null);
    renderFigures();

    // Select this figure type
    setSelectedFigureType({ type, number });

    // Update button styling
    clearPaletteSelection();
    btn.classList.add('selected');
}

/**
 * Clear palette button selection styling
 */
export function clearPaletteSelection() {
    document.querySelectorAll('.figure-btn, .figure-btn-float').forEach(btn => {
        btn.classList.remove('selected');
    });
}

/**
 * Update palette to show which figures are already placed
 */
export function updateFigurePalette() {
    document.querySelectorAll('.figure-btn, .figure-btn-float').forEach(btn => {
        const type = btn.dataset.type;
        const number = btn.dataset.number ? parseInt(btn.dataset.number) : undefined;

        if (type !== 'poi' && number) {
            const isPlaced = figures.some(f => f.type === type && f.number === number);
            btn.classList.toggle('placed', isPlaced);
        }
    });
}

/**
 * Find figure at given canvas position
 */
export function findFigureAtPosition(pos) {
    const hitRadius = 30;
    return figures.find(fig => {
        const dist = Math.sqrt(
            Math.pow(fig.position.x - pos.x, 2) +
            Math.pow(fig.position.y - pos.y, 2)
        );
        return dist < hitRadius;
    });
}

/**
 * Clear all figures from the map
 */
export function clearAllFigures() {
    if (!confirm('Clear all figures?')) return;

    setFigures([]);
    setSelectedFigureType(null);
    setSelectedPlacedFigure(null);
    clearPaletteSelection();

    if (figureCtx && figureCanvas) {
        figureCtx.setTransform(1, 0, 0, 1, 0, 0);
        figureCtx.clearRect(0, 0, figureCanvas.width, figureCanvas.height);
    }
    updateFigurePalette();
    if (ws) ws.send('figures:clear');
}

/**
 * Send figures update to server
 */
export function sendFiguresUpdate() {
    if (ws) ws.send('figures:update', { figures });
}

/**
 * Toggle floating figure palette visibility
 */
export function toggleFigurePalette() {
    setIsFigurePaletteOpen(!isFigurePaletteOpen);

    const expanded = document.getElementById('figure-palette-expanded');
    const toggleBtn = document.getElementById('figure-palette-toggle');

    if (expanded) {
        if (isFigurePaletteOpen) {
            expanded.classList.remove('hidden');
        } else {
            expanded.classList.add('hidden');
        }
    }

    if (toggleBtn) {
        toggleBtn.classList.toggle('active', isFigurePaletteOpen);
    }
}
