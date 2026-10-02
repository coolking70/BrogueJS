/** DESIGN-3: glyph is the sole interface; retain its CSS scope. */
if (typeof document !== 'undefined' && document.documentElement?.dataset) {
    document.documentElement.dataset.uiConcept = 'glyph';
}
export {};
