import type { DefinitionId, ModuleId } from './worldSdk';
export interface KindKnowledgeGroup {
  owner: ModuleId;
  id: string; // owner. 前缀；每 owner ≤8
  kinds: readonly Readonly<{
    id: string;
    raw: DefinitionId;
    roasted: DefinitionId | null;
    node: DefinitionId | null;
    knownNameKey: string;
    knownDescriptionKey: string;
  }>[]; // 1..32
  appearancePool: readonly Readonly<{ id: string; nameKey: string; descriptionKey: string }>[]; // kinds..64
  assignmentDomainId: string;
  templates: Readonly<{
    roasted: string;
    node: string;
    tastedNote: string;
    roastUnknownNote: string;
    called: string;
    unknownDetail: string;
  }>;
}
export type KindKnowledgeState = 'unknown' | 'tasted' | 'known';
export interface KindKnowledgeView {
  groupId: string;
  rows: readonly Readonly<{
    definitionId: DefinitionId;
    state: KindKnowledgeState;
    title: string | null;
  }>[];
}
