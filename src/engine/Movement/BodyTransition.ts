import type { BodyTransitionRequest } from '../../ext/bodyTransitions';
import { integer, SpatialValidationError } from './SpatialSchema';

/** HP policies are evaluated before any live write. Split is an exact integer
 * partition: earlier results receive the remainder; an empty child is refused. */
export function bodyTransitionHp(request: BodyTransitionRequest, hp: number, maxHp: number, maxima: readonly number[]): number[] | null {
    if (!integer(hp, 1) || !integer(maxHp, 1) || !maxima.length || maxima.some(n => !integer(n, 1)))
        throw new SpatialValidationError('Invalid body transition health');
    if (request.hp === 'conserve') {
        if (hp < maxima.length) return null;
        const share = Math.floor(hp / maxima.length), remainder = hp % maxima.length;
        const result = maxima.map((_, i) => share + Number(i < remainder));
        return result.some((n, i) => n > maxima[i]!) ? null : result;
    }
    return maxima.map(maximum => request.hp === 'injury' ? Math.max(1, maximum - (maxHp - hp))
        : request.hp === 'current' ? hp : Math.max(1, Math.floor(maximum * hp / maxHp)));
}
export function assertBodyTransitionRequest(request: BodyTransitionRequest): void {
    if (!request || Object.keys(request).sort().join(',') !== 'hp,placement,reason,relationships,results,sourceGroupId,statuses'
        || !integer(request.sourceGroupId, 1) || !['phase','split','clone','summon','polymorph'].includes(request.reason)
        || !['ratio','injury','conserve','current','polymorph'].includes(request.hp)
        || !['preserve','clear'].includes(request.statuses) || !['preserve','clear','native-polymorph'].includes(request.relationships)
        || !['nearest','random-nearest'].includes(request.placement) || !Array.isArray(request.results) || !request.results.length || request.results.length > 4
        || ['phase','polymorph'].includes(request.reason) && request.results.length !== 1
        || request.reason === 'split' && (request.results.length < 2 || request.hp !== 'conserve')
        || request.reason !== 'split' && request.hp === 'conserve'
        || ['clone','summon'].includes(request.reason) && request.hp !== 'current'
        || request.reason === 'polymorph' !== (request.hp === 'polymorph')
        || request.reason === 'polymorph' !== (request.relationships === 'native-polymorph'))
        throw new SpatialValidationError('Invalid body transition request');
    for (const result of request.results) if (!result || Object.keys(result).sort().join(',') !== 'formId,memberMap'
        || typeof result.formId !== 'string' || !Array.isArray(result.memberMap) || result.memberMap.length > 16)
        throw new SpatialValidationError('Invalid body transition result');
}
