/** c5-derive-v1: independent, pure, rejection-sampled whole-run domains. */
import { c5Hash } from './WorldCanonical';
import { validId } from '../../ext/json';
import { World5Error } from '../../ext/world5';
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
const seed = (s: string) => /^[0-9a-f]{64}$/.test(s);
export function derivedSeedKey(
  runSeed: string,
  owner: string,
  rulesFingerprintHex: string
): string {
  if (!/^(0|[1-9]\d*)$/.test(runSeed) || !validId(owner) || !seed(rulesFingerprintHex))
    throw new World5Error('C5_BAD_PAYLOAD');
  return c5Hash(['c5-derive-seed-v1', runSeed, owner, rulesFingerprintHex]);
}
export function derivedDraw(
  seedKey: string,
  domainId: string,
  ordinal: number,
  attempt: number
): number {
  if (!seed(seedKey) || !validId(domainId) || !integer(ordinal) || !integer(attempt))
    throw new World5Error('C5_BAD_PAYLOAD');
  return parseInt(c5Hash(['c5-derive-v1', seedKey, domainId, ordinal, attempt]).slice(0, 8), 16);
}
export function derivedRange(
  seedKey: string,
  domainId: string,
  ordinal: number,
  n: number
): number {
  if (!Number.isSafeInteger(n) || n < 1 || n > 0x100000000) throw new World5Error('C5_BAD_PAYLOAD');
  const limit = 0x100000000 - (0x100000000 % n);
  for (let attempt = 0; ; attempt++) {
    const v = derivedDraw(seedKey, domainId, ordinal, attempt);
    if (v < limit) return v % n;
  }
}
