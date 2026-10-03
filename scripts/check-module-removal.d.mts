export function isCandidateInput(path: string): boolean;
export function hashCandidate(root: string): { sha256: string; files: { path: string; sha256: string }[] };
export function removalMatrix(modules: { id: string }[]): { id: string; retained: string[]; removed: string[] }[];
