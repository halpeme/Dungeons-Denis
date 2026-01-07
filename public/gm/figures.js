/**
 * GM Controller - Figures Module
 * Handles figure palette, placement, and rendering
 */

import {
    figures, setFigures, figureCanvas, figureCtx, selectedFigureType, setSelectedFigureType,
    selectedPlacedFigure, setSelectedPlacedFigure, ws
} from './state.js';
import { applyViewportTransform } from './viewport.js';
import { drawFigure as sharedDrawFigure, generateFigureId as sharedGenerateId, findFigureAtPosition as sharedFindFigure } from '../shared/figures.js';

/**
 * Generate unique ID for figures
 */
export function generateFigureId() {
    return sharedGenerateId();
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
 * Draw a single figure on the canvas - uses shared figures module
 */
export function drawFigure(ctx, figure, opacity) {
    const isSelected = figure.id === selectedPlacedFigure;
    sharedDrawFigure(ctx, figure, { isSelected, opacity });
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
 * Find figure at given canvas position - uses shared figures module
 */
export function findFigureAtPosition(pos) {
    return sharedFindFigure(figures, pos, 30);
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

