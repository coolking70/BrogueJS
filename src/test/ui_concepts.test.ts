import { describe, it, expect } from 'vitest';
import { concept, selectConcept, registerConceptTool, type Concept } from '../ui/concept';
describe('UI concept presentation contract', () => {
  it('switches all three concepts without requiring a browser or game mutation', () => {
    for (const name of ['classic','tactical','immersive'] as Concept[]) { selectConcept(name); expect(concept.value).toBe(name); }
    expect(() => selectConcept('invalid' as Concept)).toThrow(); expect(concept.value).toBe('immersive');
  });
  it('registers the browser tool, shares selection state and rejects invalid input', async () => {
    let tool: any; let signal: AbortSignal | undefined;
    const cleanup = registerConceptTool({ registerTool(t, options) { tool = t; signal = options.signal; } });
    expect(tool.name).toBe('select_ui_concept'); expect(tool.annotations.readOnlyHint).toBe(false);
    expect(tool.inputSchema.properties.concept.enum).toEqual(['classic','tactical','immersive','glyph','umbra','ember','codex','zen','manual']);
    expect(await tool.execute({concept:'tactical'})).toEqual({concept:'tactical'}); expect(concept.value).toBe('tactical');
    expect(() => tool.execute({concept:'other'})).toThrow(); expect(() => tool.execute({concept:'classic',extra:true})).toThrow(); expect(concept.value).toBe('tactical');
    cleanup?.(); expect(signal?.aborted).toBe(true);
  });
});
