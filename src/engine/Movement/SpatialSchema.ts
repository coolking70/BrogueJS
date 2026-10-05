/** Foundation spatial format v1. Geometry/identity are available to native
 * fixtures in 4a0; production body actions remain closed until their vertical
 * slices ship. No module ID, display glyph or HP can imply a shape. */
import type { Pos } from '../../types';
export type Pose = 'r0' | 'r90' | 'r180' | 'r270' | 'm0' | 'm90' | 'm180' | 'm270';
export interface Ratio { numerator: number; denominator: number }
export interface HitZoneDefinition {
    id: string; nameKey: string;
    health: { kind: 'native' } | { kind: 'local'; maxHp: number; ownerTransfer: Ratio };
    armor: number; damageMultiplier: Ratio; breakRuleId: string;
}
export interface FootprintDefinition {
    id: string; owner: string;
    geometry: { kind: 'rect'; width: number; height: number } | { kind: 'mask'; cells: readonly Readonly<Pos>[] };
    poses: readonly Pose[];
    zoneCells?: readonly { x: number; y: number; zoneId: string }[];
    zones?: readonly HitZoneDefinition[];
}
export interface CreatureSpatialComponent {
    schema: 1; footprintId: string; pose: Pose;
    movementRegionId?: number;
    bodyMember?: { groupId: number; partId: string };
    actionLockInTicks?: number;
    zoneState?: { zoneId: string; hp: number; broken: boolean; generation: number; regenerateInTicks?: number }[];
}
export interface SpatialFormDefinition { id: string; owner: string; footprintId: string }
export interface BodyConstraint {
    childPartId: string; parentPartId: string; kind: 'tether' | 'chain';
    minDistance: number; maxDistance: number; maxStepPerAction: number; requiresClearLink: boolean;
}
export interface PartDefinition {
    partId: string; role: 'core' | 'support' | 'weapon' | 'segment'; providesSupport: boolean;
    formId: string; preferredOffset: Pos; attackProfileIds: readonly string[];
    coreTransfer: Ratio; breakRuleId: string; statusProfileId: string;
}
export interface BodyDefinition {
    id: string; owner: string; parts: readonly PartDefinition[]; constraints: readonly BodyConstraint[];
    minSupportParts: number; noSupport: 'immobile' | 'collapse' | 'die';
    coreDeath: 'remove-members' | 'debris-members'; statusProfileId: string;
}
export interface PartBreakRule {
    id: string; owner: string; trigger: 'hp-zero'; disposition: 'keep-zone' | 'remove' | 'inert-body' | 'debris';
    replacementFootprintId?: string; childrenOnBreak?: 'retire-subtree' | { reparentTo: string };
    modifiers: readonly (
        | { kind: 'move-ticks-multiplier'; numerator: number; denominator: number }
        | { kind: 'disable-attack'; attackId: string }
        | { kind: 'expose-zone'; partId: string; zoneId: string; damageMultiplier: Ratio }
        | { kind: 'balance-loss'; amount: number; fallbackStunTicks: number }
        | { kind: 'locomotion'; mode: 'ground' | 'water' | 'flying' | 'immobile' }
    )[];
    regenerate?: { delayTicks: number; formId: string; maxCycles: number };
}
/** Only native routing is available before body status/action slices open. */
export interface SpatialStatusProfileDefinition { id: string; owner: string; kind: 'native' }
export interface BodyGroupState {
    schema: 1; groupId: number; coreId: number; bodyDefinitionId: string;
    members: { partId: string; entityId: number | null; life: 'active' | 'broken' | 'removed'; generation: number;
        readyInTicks: number; regenerateInTicks?: number }[];
    appliedBreaks: { partId: string; zoneId: string; generation: number }[];
}
export interface SpatialWorldSnapshot {
    schema: 1; definitions: { footprints: FootprintDefinition[]; bodies: BodyDefinition[]; forms?: SpatialFormDefinition[];
        breakRules?: PartBreakRule[]; statusProfiles?: SpatialStatusProfileDefinition[] }; groups: BodyGroupState[];
}
export interface FootprintCell extends Readonly<Pos> { readonly zoneId: string }
export interface CreatureSpatialView {
    readonly entityId: number; readonly groupId: number; readonly partId: string | null;
    readonly anchor: Readonly<Pos>; readonly footprintId: string; readonly pose: Pose;
    readonly cells: readonly FootprintCell[];
}
export const SPATIAL_LIMITS = Object.freeze({ cells: 16, span: 16, poses: 8, sweep: 256,
    zones: 8, members: 17, groupCells: 64, groupZones: 32, entities: 128, occupiedCells: 512 });
const poses: readonly Pose[] = ['r0', 'r90', 'r180', 'r270', 'm0', 'm90', 'm180', 'm270'];
export class SpatialValidationError extends Error {
    constructor(message: string) { super(message); this.name = 'SpatialValidationError'; }
}
const fail = (message: string): never => { throw new SpatialValidationError(message); };
export const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export function keys(v: unknown, allowed: string[], required = allowed): asserts v is Record<string, any> {
    if (!record(v) || Object.keys(v).some(k => !allowed.includes(k)) || required.some(k => !Object.prototype.hasOwnProperty.call(v, k))) fail('Invalid spatial fields');
}
export const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
export const identity = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/.test(v);
export const pos = (p: unknown): p is Pos => record(p) && Object.keys(p).sort().join(',') === 'x,y' && integer(p.x, -32768, 32767) && integer(p.y, -32768, 32767);
export function ratio(v: unknown): asserts v is Ratio {
    keys(v, ['numerator', 'denominator']); if (!integer(v.numerator, 0, 1000000) || !integer(v.denominator, 1, 1000000)) fail('Invalid spatial ratio');
}
export function deepFreeze<T>(v: T): T {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(deepFreeze); Object.freeze(v); }
    return v;
}
export function transform(p: Pos, pose: Pose): Pos {
    let x = pose.startsWith('m') ? -p.x : p.x, y = p.y;
    const turns = Number(pose.slice(1)) / 90;
    for (let n = 0; n < turns; n++) [x, y] = [-y, x];
    return { x: x || 0, y: y || 0 };
}
export function compileFootprint(value: unknown): ReadonlyMap<Pose, readonly FootprintCell[]> {
    keys(value, ['id', 'owner', 'geometry', 'poses', 'zoneCells', 'zones'], ['id', 'owner', 'geometry', 'poses']);
    const d = value as unknown as FootprintDefinition;
    if (!identity(d.id) || !identity(d.owner) || !Array.isArray(d.poses) || !d.poses.length || d.poses.length > SPATIAL_LIMITS.poses
        || new Set(d.poses).size !== d.poses.length || d.poses.some(p => !poses.includes(p))) fail('Invalid footprint identity or poses');
    let cells: readonly Pos[];
    if (d.geometry?.kind === 'rect') {
        keys(d.geometry, ['kind', 'width', 'height']);
        if (!integer(d.geometry.width, 1, 16) || !integer(d.geometry.height, 1, 16)
            || d.geometry.width * d.geometry.height > SPATIAL_LIMITS.cells) fail('Footprint budget exceeded');
        const { width, height } = d.geometry;
        cells = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => ({ x, y }))).flat();
    } else {
        keys(d.geometry, ['kind', 'cells']);
        if (d.geometry.kind !== 'mask' || !Array.isArray(d.geometry.cells)) fail('Invalid mask');
        cells = d.geometry.cells;
    }
    const cellKeys = new Set(cells.map(p => `${p.x},${p.y}`));
    if (!cells.length || cells.length > SPATIAL_LIMITS.cells || cells.some(p => !pos(p)) || cellKeys.size !== cells.length || !cellKeys.has('0,0')) fail('Invalid footprint cells');
    for (const axis of ['x', 'y'] as const) if (Math.max(...cells.map(p => p[axis])) - Math.min(...cells.map(p => p[axis])) + 1 > SPATIAL_LIMITS.span) fail('Footprint span exceeded');
    const visited = new Set(['0,0']), queue: Pos[] = [{ x: 0, y: 0 }];
    for (const p of queue) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: p.x + dx!, y: p.y + dy! }, key = `${next.x},${next.y}`;
        if (cellKeys.has(key) && !visited.has(key)) { visited.add(key); queue.push(next); }
    }
    if (visited.size !== cells.length) fail('Disconnected footprint');
    if (d.zones !== undefined && (!Array.isArray(d.zones) || d.zones.length > SPATIAL_LIMITS.zones)) fail('Invalid zones');
    const zones = new Set<string>();
    for (const z of d.zones ?? []) {
        keys(z, ['id', 'nameKey', 'health', 'armor', 'damageMultiplier', 'breakRuleId']);
        if (!identity(z.id) || z.id === 'body' || zones.has(z.id) || !identity(z.nameKey) || !identity(z.breakRuleId) || !integer(z.armor, 0, 1000000)) fail('Invalid zone');
        zones.add(z.id); ratio(z.damageMultiplier);
        if (z.health.kind === 'native') keys(z.health, ['kind']);
        else { keys(z.health, ['kind', 'maxHp', 'ownerTransfer']); if (z.health.kind !== 'local' || !integer(z.health.maxHp, 1, 1000000)) fail('Invalid zone health'); ratio(z.health.ownerTransfer); }
    }
    if (d.zoneCells !== undefined && !Array.isArray(d.zoneCells)) fail('Invalid zone labels');
    const labels = new Map<string, string>();
    for (const z of d.zoneCells ?? []) {
        keys(z, ['x', 'y', 'zoneId']); const key = `${z.x},${z.y}`;
        if (!integer(z.x, -32768, 32767) || !integer(z.y, -32768, 32767) || !cellKeys.has(key) || labels.has(key) || !zones.has(z.zoneId)) fail('Invalid zone cell');
        labels.set(key, z.zoneId);
    }
    if ([...zones].some(id => ![...labels.values()].includes(id))) fail('Unplaced zone');
    return new Map(d.poses.map(pose => [pose, deepFreeze(cells.map(p => ({ ...transform(p, pose), zoneId: labels.get(`${p.x},${p.y}`) ?? 'body' }))
        .sort((a, b) => a.y - b.y || a.x - b.x))]));
}
export class SpatialCatalog {
    private readonly footprints = new Map<string, { definition: FootprintDefinition; cells: ReadonlyMap<Pose, readonly FootprintCell[]> }>();
    private readonly bodies = new Map<string, BodyDefinition>();
    private readonly forms = new Map<string, SpatialFormDefinition>();
    private readonly breakRules = new Map<string, PartBreakRule>([['foundation:keep-zone', deepFreeze({ id: 'foundation:keep-zone', owner: 'foundation', trigger: 'hp-zero', disposition: 'keep-zone', modifiers: [] })]]);
    private readonly statusProfiles = new Map<string, SpatialStatusProfileDefinition>([['foundation:native', deepFreeze({ id: 'foundation:native', owner: 'foundation', kind: 'native' })]]);
    constructor(readonly fixture = false, private readonly owners: readonly string[] = []) {
        for (const width of [1, 2, 3]) this.registerFootprint({ id: width === 1 ? 'builtin:single' : `builtin:square-${width}`,
            owner: 'foundation', geometry: { kind: 'rect', width, height: width }, poses: ['r0'] });
    }
    registerFootprint(d: FootprintDefinition): void {
        const cells = compileFootprint(d);
        if (this.footprints.has(d.id) || !(d.owner === 'foundation' && (this.fixture || d.id.startsWith('builtin:')) || !this.fixture && this.owners.includes(d.owner) && d.id.startsWith(`${d.owner}.`))) fail('Unknown or duplicate footprint owner');
        for (const zone of d.zones ?? []) {
            const rule = this.breakRule(zone.breakRuleId);
            for (const modifier of rule.modifiers) if (modifier.kind === 'expose-zone'
                && (modifier.partId !== 'self' || !d.zones?.some(z => z.id === modifier.zoneId))) fail('Invalid fixed zone exposure reference');
        }
        this.footprints.set(d.id, { definition: deepFreeze(structuredClone(d)), cells });
    }
    definition(id: string): FootprintDefinition { return this.footprints.get(id)?.definition ?? fail('Unknown footprint'); }
    cells(id: string, pose: Pose): readonly FootprintCell[] { return this.footprints.get(id)?.cells.get(pose) ?? fail('Unknown footprint or pose'); }
    registerForm(d: SpatialFormDefinition): void {
        keys(d, ['id', 'owner', 'footprintId']);
        if (!this.fixture || !identity(d.id) || d.owner !== 'foundation' || this.forms.has(d.id)) fail('Invalid or unopened spatial form identity');
        this.definition(d.footprintId); this.forms.set(d.id, deepFreeze(structuredClone(d)));
    }
    form(id: string): SpatialFormDefinition { return this.forms.get(id) ?? fail('Unknown spatial form'); }
    breakRule(id: string): PartBreakRule { return this.breakRules.get(id) ?? fail('Unknown or unopened spatial break rule'); }
    /** 4c-0: fixed-zone fixture rules only. Production declarations remain
     * closed until native damage, action cancellation and public UI ship. */
    registerBreakRule(d: PartBreakRule): void {
        keys(d, ['id', 'owner', 'trigger', 'disposition', 'modifiers']);
        if (!this.fixture || d.owner !== 'foundation' || !identity(d.id) || this.breakRules.has(d.id)
            || d.trigger !== 'hp-zero' || d.disposition !== 'keep-zone' || !Array.isArray(d.modifiers)
            || d.modifiers.length > 8) fail('Invalid or unopened fixed zone break rule');
        const seen = new Set<string>();
        for (const m of d.modifiers) {
            let key: string;
            switch (m.kind) {
                case 'move-ticks-multiplier':
                    keys(m, ['kind', 'numerator', 'denominator']); ratio({ numerator: m.numerator, denominator: m.denominator });
                    if (!m.numerator) fail('Invalid movement multiplier'); key = m.kind; break;
                case 'disable-attack':
                    keys(m, ['kind', 'attackId']); if (!identity(m.attackId)) fail('Invalid disabled attack'); key = `${m.kind}:${m.attackId}`; break;
                case 'expose-zone':
                    keys(m, ['kind', 'partId', 'zoneId', 'damageMultiplier']); ratio(m.damageMultiplier);
                    if (m.partId !== 'self' || !identity(m.zoneId) || m.zoneId === 'body') fail('Invalid fixed zone exposure');
                    key = `${m.kind}:${m.zoneId}`; break;
                case 'balance-loss':
                    keys(m, ['kind', 'amount', 'fallbackStunTicks']);
                    if (!integer(m.amount, 0, 1000000) || !integer(m.fallbackStunTicks, 0, 1000000)) fail('Invalid break balance loss');
                    key = m.kind; break;
                default: fail('Unopened break modifier');
            }
            if (seen.has(key!)) fail('Duplicate break modifier'); seen.add(key!);
        }
        this.breakRules.set(d.id, deepFreeze(structuredClone(d)));
    }
    statusProfile(id: string): SpatialStatusProfileDefinition { return this.statusProfiles.get(id) ?? fail('Unknown or unopened spatial status profile'); }
    body(id: string): BodyDefinition { return this.bodies.get(id) ?? fail('Unknown body'); }
    registerBody(d: BodyDefinition): void {
        keys(d, ['id', 'owner', 'parts', 'constraints', 'minSupportParts', 'noSupport', 'coreDeath', 'statusProfileId']);
        if (!this.fixture || !identity(d.id) || d.owner !== 'foundation' || this.bodies.has(d.id) || !Array.isArray(d.parts) || !d.parts.length
            || d.parts.length > SPATIAL_LIMITS.members || !Array.isArray(d.constraints) || !integer(d.minSupportParts, 0, d.parts.length)
            || !['immobile', 'collapse', 'die'].includes(d.noSupport) || !['remove-members', 'debris-members'].includes(d.coreDeath) || !identity(d.statusProfileId)) fail('Invalid body definition');
        this.statusProfile(d.statusProfileId);
        const parts = new Set<string>();
        for (const p of d.parts) {
            keys(p, ['partId', 'role', 'providesSupport', 'formId', 'preferredOffset', 'attackProfileIds', 'coreTransfer', 'breakRuleId', 'statusProfileId']);
            if (!identity(p.partId) || parts.has(p.partId) || !['core', 'support', 'weapon', 'segment'].includes(p.role) || typeof p.providesSupport !== 'boolean'
                || !pos(p.preferredOffset) || !Array.isArray(p.attackProfileIds) || p.attackProfileIds.length || !identity(p.breakRuleId) || !identity(p.statusProfileId)) fail('Invalid part');
            this.form(p.formId); this.breakRule(p.breakRuleId); this.statusProfile(p.statusProfileId); ratio(p.coreTransfer); parts.add(p.partId);
        }
        const core = d.parts.filter(p => p.role === 'core'); if (core.length !== 1) fail('Body requires one core');
        const parents = new Map<string, string>();
        for (const c of d.constraints) {
            keys(c, ['childPartId', 'parentPartId', 'kind', 'minDistance', 'maxDistance', 'maxStepPerAction', 'requiresClearLink']);
            if (!parts.has(c.childPartId) || !parts.has(c.parentPartId) || parents.has(c.childPartId) || c.childPartId === core[0]!.partId
                || !['tether', 'chain'].includes(c.kind) || !integer(c.minDistance, 0, 64) || !integer(c.maxDistance, c.minDistance, 64)
                || !integer(c.maxStepPerAction, 1, 32) || typeof c.requiresClearLink !== 'boolean') fail('Invalid body constraint');
            parents.set(c.childPartId, c.parentPartId);
        }
        for (const part of parts) {
            const seen = new Set<string>(); let current = part;
            while (current !== core[0]!.partId) { if (seen.has(current)) fail('Cyclic body'); seen.add(current); current = parents.get(current) ?? fail('Disconnected body'); }
        }
        const cells = d.parts.reduce((n, p) => n + this.cells(this.form(p.formId).footprintId, 'r0').length, 0);
        const zones = d.parts.reduce((n, p) => n + (this.definition(this.form(p.formId).footprintId).zones?.length ?? 0), 0);
        if (cells > SPATIAL_LIMITS.groupCells || zones > SPATIAL_LIMITS.groupZones) fail('Body budget exceeded');
        this.bodies.set(d.id, deepFreeze(structuredClone(d)));
    }
    definitionClosure(footprintIds: readonly string[], bodyIds: readonly string[]): SpatialWorldSnapshot['definitions'] {
        const sorted = (ids: readonly string[]) => [...new Set(ids)].sort();
        const bodies = sorted(bodyIds).map(id => this.body(id));
        const forms = sorted(bodies.flatMap(d => d.parts.map(p => p.formId))).map(id => this.form(id));
        const footprints = sorted([...footprintIds, ...forms.map(d => d.footprintId)]).map(id => this.definition(id));
        const breakRules = sorted([...footprints.flatMap(d => (d.zones ?? []).map(z => z.breakRuleId)), ...bodies.flatMap(d => d.parts.map(p => p.breakRuleId))]).map(id => this.breakRule(id));
        const statusProfiles = sorted(bodies.flatMap(d => [d.statusProfileId, ...d.parts.map(p => p.statusProfileId)])).map(id => this.statusProfile(id));
        return { footprints, bodies, ...(forms.length ? { forms } : {}), ...(breakRules.length ? { breakRules } : {}), ...(statusProfiles.length ? { statusProfiles } : {}) };
    }
}
export const nativeSpatialCatalog = new SpatialCatalog();
export function validateSpatialComponent(v: unknown, catalog = nativeSpatialCatalog, production = true): asserts v is CreatureSpatialComponent {
    keys(v, ['schema', 'footprintId', 'pose', 'movementRegionId', 'bodyMember', 'actionLockInTicks', 'zoneState'], ['schema', 'footprintId', 'pose']);
    if (v.schema !== 1 || !identity(v.footprintId) || !poses.includes(v.pose)) fail('Invalid spatial component');
    const d = catalog.definition(v.footprintId); catalog.cells(v.footprintId, v.pose);
    if (v.movementRegionId !== undefined && !integer(v.movementRegionId, 1)) fail('Invalid movement region');
    if (v.actionLockInTicks !== undefined && !integer(v.actionLockInTicks, 0, 1000000)) fail('Invalid action lock');
    if (v.bodyMember !== undefined) { keys(v.bodyMember, ['groupId', 'partId']); if (!integer(v.bodyMember.groupId, 1) || !identity(v.bodyMember.partId)) fail('Invalid body member'); }
    if (v.zoneState !== undefined) {
        if (!Array.isArray(v.zoneState) || v.zoneState.length > SPATIAL_LIMITS.zones) fail('Invalid zone state');
        const seen = new Set<string>();
        for (const z of v.zoneState) {
            keys(z, ['zoneId', 'hp', 'broken', 'generation', 'regenerateInTicks'], ['zoneId', 'hp', 'broken', 'generation']);
            const zone = d.zones?.find(def => def.id === z.zoneId);
            if (!zone || zone.health.kind !== 'local' || seen.has(z.zoneId) || !integer(z.hp, 0, zone.health.maxHp)
                || typeof z.broken !== 'boolean' || (z.hp === 0) !== z.broken || z.generation !== 0
                || z.regenerateInTicks !== undefined) fail('Invalid zone health');
            seen.add(z.zoneId);
        }
        if (d.zones?.some(z => z.health.kind === 'local' && !seen.has(z.id))) fail('Missing local zone state');
    } else if (d.zones?.some(z => z.health.kind === 'local')) fail('Missing zone state');
    // 4a0 explicitly does not run ANY spatial production actions, even 1x1
    // components with locks/regions/zones. Ordinary creatures omit the field.
    if (production) fail('Spatial production capability is not open in 4a0');
    if (v.regenerateInTicks !== undefined) fail('Regeneration capability is not open');
}
