import { ref } from 'vue';
export const conceptNames = ['classic', 'tactical', 'immersive'] as const;
export type Concept = typeof conceptNames[number];
const candidate = typeof window === 'undefined' || !window.location ? null : new URLSearchParams(window.location.search).get('concept');
export const concept = ref<Concept>(conceptNames.includes(candidate as Concept) ? candidate as Concept : 'classic');
export function selectConcept(value: Concept) {
  if (!conceptNames.includes(value)) throw new Error('Unknown interface concept');
  concept.value = value;
  if (typeof document !== 'undefined' && document.documentElement?.dataset) document.documentElement.dataset.uiConcept = value;
  if (typeof window !== 'undefined' && window.location && window.history) {
    const url = new URL(window.location.href); url.searchParams.set('concept', value);
    window.history.replaceState({}, '', url);
  }
}
if (typeof document !== 'undefined' && document.documentElement?.dataset) document.documentElement.dataset.uiConcept = concept.value;

interface ConceptTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: unknown): { concept: Concept };
}
interface ModelContext { registerTool(tool: ConceptTool, options: { signal: AbortSignal }): void | Promise<void> }
export function registerConceptTool(context?: ModelContext): (() => void) | undefined {
  const registry = context ?? (typeof document !== 'undefined' ? (document as Document & { modelContext?: ModelContext }).modelContext : undefined);
  if (!registry?.registerTool) return;
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(registry.registerTool({
      name: 'select_ui_concept',
      description: 'Switch between the three BrogueJS interface designs. Keeps the current game and does not record a preferred design.',
      inputSchema: { type: 'object', properties: { concept: { type: 'string', enum: [...conceptNames] } }, required: ['concept'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        if (!input || typeof input !== 'object' || Object.keys(input).length !== 1 || !('concept' in input) || !conceptNames.includes(input.concept as Concept)) throw new Error('Expected a supported interface concept');
        selectConcept(input.concept as Concept);
        return { concept: concept.value };
      },
    }, { signal: lifecycle.signal })).catch(() => {});
  } catch { lifecycle.abort(); }
  return () => lifecycle.abort();
}
