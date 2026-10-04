export function isCandidateInput(path: string): boolean;
export function hashCandidate(root: string): { sha256: string; files: { path: string; sha256: string }[] };
export interface RemovalRow {
    id: string;
    retained: string[];
    removed: string[];
}
export type GateProfile = 'full' | 'removal';
export interface PlannedGate {
    id: 'boundaries' | 'typecheck' | 'build' | 'extension-tests' | 'complete-npm-test' | 'composition-smoke';
    command: string[];
}
export interface PlannedRemovalRow extends RemovalRow {
    profile: GateProfile;
    plannedGates: PlannedGate[];
}
export interface RemovalPlan {
    source: string;
    requestedProfile: 'auto' | GateProfile;
    foundationFixtureDirectories: string[];
    preservedCeReference: boolean;
    installedModules: string[];
    matrix: PlannedRemovalRow[];
    ownedRoots: string[];
    tests: Record<string, number>;
    normalTreeFullGate: { required: true; includedInMatrix: boolean; status: 'not-run' | 'passed' | 'failed'; note: string };
    removalPolicy: string;
    smokeScope: string;
    caveat: string;
}
export interface RemovalCase extends PlannedRemovalRow {
    temporaryCopy: string;
    beforeDeletionHash: string;
    deleted: { id: string; directory: string; files: string[]; verifiedAbsent: true }[];
    gates: (PlannedGate & { startedAt: string; endedAt: string; exitCode: number | null; signal: string | null; error?: string; log: string })[];
    completeNpmTest: 'not-run' | 'passed' | 'failed' | 'not-required-in-removal-profile';
    status: 'running' | 'prepared-not-verified' | 'passed' | 'failed';
    afterDeletionHash?: string;
    removedTests?: string[];
    remainingTests?: string[];
    remainingModules?: string[];
    finalInputHash?: string;
    sourceMutation?: string;
}
export interface RemovalEvidence extends RemovalPlan {
    browserRequired: boolean;
    browserStatus: 'not-run' | 'required-in-smoke';
    inputHash: string;
    startedAt: string;
    endedAt: string;
    cases: RemovalCase[];
    sourceFinalHash: string;
    status: 'prepared-not-verified' | 'partial-browser-not-verified' | 'passed' | 'failed';
    error?: string;
}
export function removalMatrix(modules: { id: string }[]): RemovalRow[];
export function removalGates(row: Pick<RemovalRow, 'id' | 'removed'>, options?: {
    maxWorkers?: number; engineOnly?: boolean; output?: string;
}): { profile: GateProfile; commands: PlannedGate[] };
export function checkModuleRemoval(argv?: string[]): Promise<RemovalPlan | RemovalEvidence>;
