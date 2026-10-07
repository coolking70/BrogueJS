import { markItemStatsDirty } from './ItemStatInvalidation';
import { ItemCategory, type Item } from './Item';
import { WAND_INITIAL_RANGES } from './ArcanaInstance';
import { charmRechargeDelay, isCharmKind } from './CharmModel';

/** Only existing CE wand ranges have an enchanting increment. Retired invented
 * wands have no CE lower bound; don't invent one from their legacy capacity.
 */
export function canEnchantArcana(item: Item): boolean {
    if (item.category === ItemCategory.CHARM) return Number.isInteger(item.enchantment) && item.enchantment >= 1;
    if (!Number.isInteger(item.charges) || item.charges! < 0) return false;
    if (item.category === ItemCategory.STAFF) {
        return Number.isInteger(item.enchantment) && item.enchantment > 0;
    }
    return item.category === ItemCategory.WAND
        && !!WAND_INITIAL_RANGES[(item as Item & { identityId?: string }).identityId ?? ''];
}

/** CE Items.c:7860-7867 (ordinary scroll power = 1). No RNG, discovery or effects.
 * CE uses enchant1 itself as staff capacity. W-5 stores that capacity separately;
 * synchronize it to the new E without filling the existing charge deficit.
 */
export function arcanaEnchantmentGain(item: Item, magnitude: number): Partial<Pick<Item, 'enchantment' | 'maxCharges' | 'charges'>> {
    if (!canEnchantArcana(item)) throw new RangeError('Invalid arcana enchantment target');
    if (!Number.isSafeInteger(magnitude) || magnitude < 0) throw new RangeError('Invalid enchantment magnitude');
    if (!magnitude) return {};
    const gain = item.category === ItemCategory.STAFF
        ? { enchantment: item.enchantment + magnitude, maxCharges: item.enchantment + magnitude, charges: item.charges! + magnitude }
        : item.category === ItemCategory.CHARM ? { enchantment: item.enchantment + magnitude }
        : { charges: item.charges! + WAND_INITIAL_RANGES[item.identityId!]![0] * magnitude };
    if (!Object.values(gain).every(value => Number.isSafeInteger(value) && value! >= 0)) throw new RangeError('Unsafe arcana enchantment gain');
    return gain;
}

/** Native non-permanent effects still occur at zero growth magnitude. */
export function finishArcanaEnchantment(item: Item): void {
    if (item.category === ItemCategory.STAFF) {
        // This is 500/new E, NOT the 5000/new E recurring recharge duration.
        item.staffRechargeRemaining = Math.floor(500 / item.enchantment);
    } else if (item.category === ItemCategory.CHARM) {
        item.cooldownRemaining = 0; // CE Items.c:7868-7871
        if (isCharmKind(item.identityId)) item.cooldownTurns = charmRechargeDelay(item.identityId, item.enchantment);
    }
    item.isCursed = false; // Items.c:7892, common post-enchantment uncurse.
}

export function enchantArcana(item: Item, magnitude = 1): boolean {
    if (!canEnchantArcana(item)) return false;
    Object.assign(item, arcanaEnchantmentGain(item, magnitude));
    markItemStatsDirty(item);
    finishArcanaEnchantment(item);
    return true;
}
