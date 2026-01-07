/**
 * GM Controller - UI Module
 * Handles DOM event listeners and UI updates
 */

import {
    MODE, currentMode, setCurrentMode, isSettingsModalOpen, setIsSettingsModalOpen,
    viewport, brushSize, setBrushSizeValue, elements
} from './state.js';
import { setZoom, setRotation, resetViewport, updateCursor, updateZoomDisplay } from './viewport.js';
import { toggleFigurePalette, toggleFigureSelection, clearAllFigures } from './figures.js';
import { clearFog, revealAll, confirmPreview, cancelPreview } from './fog.js';

/**
 * Set interaction mode (zoom, draw, or figure)
 */
export function setMode(mode) {
    setCurrentMode(mode);

    const zoomBtn = document.getElementById('mode-zoom-btn');
    const figureBtn = document.getElementById('mode-figure-btn');
    const drawBtn = document.getElementById('mode-draw-btn');

    // Update button styling for 3-way toggle
    if (zoomBtn) {
        zoomBtn.classList.toggle('active', mode === MODE.ZOOM);
        zoomBtn.classList.toggle('bg-amber-600', mode === MODE.ZOOM);
        zoomBtn.classList.toggle('bg-gray-700', mode !== MODE.ZOOM);
    }
    if (figureBtn) {
        figureBtn.classList.toggle('active', mode === MODE.FIGURE);
        figureBtn.classList.toggle('bg-amber-600', mode === MODE.FIGURE);
        figureBtn.classList.toggle('bg-gray-700', mode !== MODE.FIGURE);
    }
    if (drawBtn) {
        drawBtn.classList.toggle('active', mode === MODE.DRAW);
        drawBtn.classList.toggle('bg-amber-600', mode === MODE.DRAW);
        drawBtn.classList.toggle('bg-gray-700', mode !== MODE.DRAW);
    }

    updateCursor();

    // Show/hide reveal size controls
    const sizeControls = document.getElementById('reveal-size-controls');
    if (sizeControls) {
        sizeControls.classList.toggle('hidden', mode !== MODE.DRAW);
    }

    // Show/hide figure palette
    const figurePalette = document.getElementById('figure-palette-floating');
    const figureExpanded = document.getElementById('figure-palette-expanded');
    if (figurePalette) {
        figurePalette.classList.toggle('hidden', mode !== MODE.FIGURE);
    }
    // Auto-expand palette when entering Figure mode
    if (figureExpanded && mode === MODE.FIGURE) {
        figureExpanded.classList.remove('hidden');
    }
}

/**
 * Toggle settings modal visibility
 */
export function toggleSettingsModal() {
    setIsSettingsModalOpen(!isSettingsModalOpen);

    const modal = document.getElementById('settings-modal');
    const toggleBtn = document.getElementById('settings-toggle-btn');

    if (modal) {
        if (isSettingsModalOpen) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    }

    if (toggleBtn) {
        if (isSettingsModalOpen) {
            // X icon
            toggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-gray-300">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>`;
        } else {
            // Cog icon
            toggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-gray-300">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>`;
        }
    }
}

/**
 * Set brush size (S/M/L)
 */
export function setBrushSize(size) {
    const sBtn = document.getElementById('size-s-btn');
    const mBtn = document.getElementById('size-m-btn');
    const lBtn = document.getElementById('size-l-btn');

    // Reset styling
    [sBtn, mBtn, lBtn].forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-amber-600', 'text-white');
            btn.classList.add('bg-gray-700', 'text-gray-300');
        }
    });

    // Set active style and size
    let activeBtn;
    if (size === 'S') {
        setBrushSizeValue(25);
        activeBtn = sBtn;
    } else if (size === 'M') {
        setBrushSizeValue(50);
        activeBtn = mBtn;
    } else {
        setBrushSizeValue(100);
        activeBtn = lBtn;
    }

    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-700', 'text-gray-300');
        activeBtn.classList.add('bg-amber-600', 'text-white');
    }
}

/**
 * Show a specific tab
 */
export function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('text-amber-400', btn.dataset.tab === tabName);
        btn.classList.toggle('text-gray-400', btn.dataset.tab !== tabName);
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');
}

/**
 * Update connection status indicator
 */
export function updateConnectionStatus(connected) {
    if (elements.statusDot) {
        elements.statusDot.className = `w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`;
    }
    if (elements.statusText) {
        elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }
}

/**
 * Show join code panel
 */
export function showJoinCode(joinCode) {
    if (elements.createSessionPanel) elements.createSessionPanel.classList.add('hidden');
    if (elements.joinCodePanel) elements.joinCodePanel.classList.remove('hidden');
    if (elements.joinCode) elements.joinCode.textContent = joinCode;
    if (elements.settingsJoinCode) elements.settingsJoinCode.textContent = joinCode;

    // Set the table display links
    const baseUrl = window.location.origin;
    const tableUrl = `${baseUrl}/table?code=${joinCode}`;

    const tableLink = document.getElementById('table-link');
    if (tableLink) tableLink.value = tableUrl;

    const sessionTableLink = document.getElementById('session-table-link');
    if (sessionTableLink) sessionTableLink.value = tableUrl;
}

/**
 * Show control panel
 */
export function showControlPanel() {
    if (elements.sessionPanel) elements.sessionPanel.classList.add('hidden');
    if (elements.controlPanel) elements.controlPanel.classList.remove('hidden');
}

/**
 * Setup copy button functionality
 */
function setupCopyButton(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);

    if (!btn || !input) return;

    const showCopyFeedback = () => {
        btn.textContent = 'Copied!';
        btn.classList.remove('bg-amber-600', 'hover:bg-amber-500');
        btn.classList.add('bg-green-600', 'hover:bg-green-500');

        setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('bg-green-600', 'hover:bg-green-500');
            btn.classList.add('bg-amber-600', 'hover:bg-amber-500');
        }, 2000);
    };

    btn.addEventListener('click', () => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(input.value)
                .then(showCopyFeedback)
                .catch(() => fallbackCopyText(input.value, showCopyFeedback));
        } else {
            fallbackCopyText(input.value, showCopyFeedback);
        }
    });

    function fallbackCopyText(text, onSuccess) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.cssText = "top:0;left:0;position:fixed;opacity:0;pointer-events:none";
        textArea.contentEditable = "true";
        textArea.readOnly = false;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 999999);

        try {
            if (document.execCommand('copy')) {
                onSuccess();
            }
        } catch (err) {
            console.error('Copy failed:', err);
        }
        document.body.removeChild(textArea);
    }

    // Auto-select on click
    input.addEventListener('click', function () { this.select(); this.setSelectionRange(0, 99999); });
    input.addEventListener('focus', function () { this.select(); this.setSelectionRange(0, 99999); });
}

/**
 * Initialize all UI event listeners
 */
export function initEventListeners(handlers) {
    const { onCreateSession, onReconnect, onEndSession, onMapUpload, ws } = handlers;

    // Create session
    document.getElementById('create-session-btn')?.addEventListener('click', onCreateSession);

    // Reconnect
    document.getElementById('reconnect-btn')?.addEventListener('click', onReconnect);

    // Copy code
    document.getElementById('copy-code-btn')?.addEventListener('click', () => {
        const joinCode = elements.joinCode?.textContent;
        if (joinCode) {
            navigator.clipboard.writeText(joinCode);
            document.getElementById('copy-code-btn').textContent = 'Copied!';
            setTimeout(() => document.getElementById('copy-code-btn').textContent = 'Copy Code', 2000);
        }
    });

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    // Map upload
    document.getElementById('upload-map-btn')?.addEventListener('click', () => {
        document.getElementById('map-image-file').click();
    });
    document.getElementById('map-image-file')?.addEventListener('change', onMapUpload);
    document.getElementById('camera-map-btn')?.addEventListener('click', () => {
        document.getElementById('map-camera-file').click();
    });
    document.getElementById('map-camera-file')?.addEventListener('change', onMapUpload);
    document.getElementById('change-map-btn')?.addEventListener('click', () => {
        document.getElementById('map-image-file').click();
    });

    // Fog controls
    document.getElementById('clear-fog-btn')?.addEventListener('click', clearFog);
    document.getElementById('reveal-all-btn')?.addEventListener('click', revealAll);

    // Close settings on outside click
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('settings-modal');
        const toggleBtn = document.getElementById('settings-toggle-btn');
        if (modal && !modal.classList.contains('hidden')) {
            if (!modal.contains(e.target) && !toggleBtn.contains(e.target)) {
                modal.classList.add('hidden');
                setIsSettingsModalOpen(false);
                toggleSettingsModal(); // Reset icon
                setIsSettingsModalOpen(false); // Force state
            }
        }
    });

    // Zoom slider
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomTooltip = document.getElementById('zoom-tooltip');
    if (zoomSlider) {
        zoomSlider.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
        zoomSlider.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: false });
        zoomSlider.addEventListener('pointerdown', (e) => e.stopPropagation());

        const updateTooltip = () => {
            const val = Math.round(parseFloat(zoomSlider.value) * 100);
            if (zoomTooltip) {
                zoomTooltip.textContent = `${val}%`;
                zoomTooltip.classList.remove('opacity-0');
            }
            setZoom(parseFloat(zoomSlider.value));
        };
        const hideTooltip = () => zoomTooltip?.classList.add('opacity-0');

        zoomSlider.addEventListener('input', updateTooltip);
        zoomSlider.addEventListener('change', hideTooltip);
        zoomSlider.addEventListener('pointerup', hideTooltip);
        zoomSlider.addEventListener('touchend', hideTooltip);
    }

    // Rotation controls
    document.getElementById('rotate-left-btn')?.addEventListener('click', () => setRotation(viewport.rotation - 90));
    document.getElementById('rotate-right-btn')?.addEventListener('click', () => setRotation(viewport.rotation + 90));

    // Mode toggle
    document.getElementById('mode-zoom-btn')?.addEventListener('click', () => setMode(MODE.ZOOM));
    document.getElementById('mode-figure-btn')?.addEventListener('click', () => setMode(MODE.FIGURE));
    document.getElementById('mode-draw-btn')?.addEventListener('click', () => setMode(MODE.DRAW));
    document.getElementById('reset-zoom-btn')?.addEventListener('click', resetViewport);

    // Settings toggle
    document.getElementById('settings-toggle-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSettingsModal();
    });

    // Display mode
    document.querySelectorAll('.display-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => ws?.send('display:mode', { mode: btn.dataset.mode }));
    });

    // Copy buttons
    setupCopyButton('copy-session-link-btn', 'session-table-link');
    setupCopyButton('copy-link-btn', 'table-link');

    // Prevent global scrolling
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('.overflow-y-auto') ||
            e.target.closest('#preset-maps-grid') ||
            e.target.closest('#preset-maps-grid-loaded')) return;
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    // Reveal size controls
    document.getElementById('size-s-btn')?.addEventListener('click', () => setBrushSize('S'));
    document.getElementById('size-m-btn')?.addEventListener('click', () => setBrushSize('M'));
    document.getElementById('size-l-btn')?.addEventListener('click', () => setBrushSize('L'));
    setBrushSize('L'); // Default

    // Preview actions
    const confirmBtn = document.getElementById('confirm-preview-btn');
    const cancelBtn = document.getElementById('cancel-preview-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); confirmPreview(); });
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); cancelPreview(); });
    }

    // End session
    document.getElementById('end-session-btn')?.addEventListener('click', onEndSession);

    // Figure palette
    document.querySelectorAll('.figure-btn, .figure-btn-float').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const number = btn.dataset.number ? parseInt(btn.dataset.number) : undefined;
            toggleFigureSelection(type, number, btn);
        });
    });
    document.getElementById('clear-figures-btn')?.addEventListener('click', (e) => { e.stopPropagation(); clearAllFigures(); });
    document.getElementById('clear-figures-btn-float')?.addEventListener('click', (e) => { e.stopPropagation(); clearAllFigures(); });
    document.getElementById('figure-palette-toggle')?.addEventListener('click', toggleFigurePalette);
}
