import type {
  ItemDefinitionContribution,
  RecipeDefinition,
  ResourceDefinition,
  StartupItemsDeclaration,
  StationDefinition
} from '../../worldSdk';

export interface CraftingLimits {
  recipes: number;
  itemAndStationDefinitions: number;
  nodeDefinitions: number;
  nodesPerLevel: number;
  nodesPerRun: number;
  stationsPerLevel: number;
  stationsPerRun: number;
  startupReceipts: number;
  placementReceipts: number;
  workHistory: number;
  batchMax: number;
  stack: number;
}

export interface CraftingPack {
  schema: 1;
  moduleId: 'crafting';
  moduleVersion: '1.0.0';
  rulesVersion: '1.0.0';
  materials: ItemDefinitionContribution[];
  tools: ItemDefinitionContribution[];
  resourceNodes: ResourceDefinition[];
  stations: StationDefinition[];
  recipes: RecipeDefinition[];
  startupItems: StartupItemsDeclaration;
  limits: CraftingLimits;
}
