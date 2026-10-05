import type { NativeFormDefinition } from '../../nativeForms';
import type { GenerationContribution } from '../../generation';
import type { BodyDefinition, PartBreakRule } from '../../../engine/Movement/SpatialSchema';
export interface GiantsPack {
  schema: 1;
  moduleVersion: '1.0.0';
  rulesVersion: '1.0.0';
  forms: NativeFormDefinition[];
  transitions?: import('../../bodyTransitions').ActiveBodyTransition[];
  bodies?: { definitions: BodyDefinition[]; breakRules: PartBreakRule[];
    statusProfiles?: import('../../../engine/Movement/SpatialSchema').SpatialStatusProfileDefinition[];
    attackProfiles?: import('../../../engine/Movement/SpatialSchema').SpatialAttackProfileDefinition[] };
  templates: GenerationContribution[];
}
export interface GiantsPlacement {
  instanceKey: string;
  templateId: string;
  depth: number;
  result: 'placed' | 'skipped';
  regionId: number | null;
  reason: 'no-space' | 'budget' | null;
}
export interface GiantsBoss {
  encounterKey: string;
  primaryId: number;
  spawnDefinitionId: string;
  instanceKey: string;
  regionId: number | null;
  subjects: { groupId: number; status: 'alive' | 'dead' | 'lost' }[];
  status: 'alive' | 'defeated' | 'escaped' | 'lost';
}
export interface GiantsState {
  schema: 1;
  revision: number;
  placements: GiantsPlacement[];
  bosses: GiantsBoss[];
}
export interface GiantsBossMarker {
  schema: 1;
  encounterKey: string;
  spawnDefinitionId: string;
}
