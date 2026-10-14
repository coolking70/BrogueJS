import type {Plugin} from 'vite';
import type {TestDiscovery} from './test-discovery.mjs';
export interface DependencyRow {file:string; owner:string|null; inferred:string[]; required:string[]; optional:string[]; missing:string[]; needs:{id:string;kind:string;source:string;site:string}[]; available:string[]; imports:string[]}
export interface DependencyAnalysis {root:string; files:DependencyRow[]; errors:string[]; installed:string[]}
export function analyzeTestDependencies(root?:string, options?:{declarations?:{modules:string[];tests:Record<string,{required:string[];optional:string[]}>};discovery?:TestDiscovery}):DependencyAnalysis;
export function testDependencyPlugin(analysis:DependencyAnalysis):Plugin;
