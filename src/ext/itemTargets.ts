/** Stable host target order/weights, shared by native and contributed equipment. */
export const ITEM_RUNIC_TARGETS = Object.freeze([
        { name: 'abomination', frequency: 10, maxDepth: -1 },
        { name: 'dar',         frequency: 10, maxDepth: 22 },
        { name: 'animal',      frequency: 10, maxDepth: 10 },
        { name: 'goblin',      frequency: 10, maxDepth: 10 },
        { name: 'ogre',        frequency: 10, maxDepth: 16 },
        { name: 'dragon',      frequency: 10, maxDepth: -1 },
        { name: 'undead',      frequency: 10, maxDepth: -1 },
        { name: 'jelly',       frequency: 10, maxDepth: 15 },
        { name: 'turret',      frequency: 5,  maxDepth: 18 },
        { name: 'infernal',    frequency: 10, maxDepth: -1 },
        { name: 'mage',        frequency: 10, maxDepth: -1 },
        { name: 'waterborne',  frequency: 10, maxDepth: 17 },
        { name: 'airborne',    frequency: 10, maxDepth: 15 },
        { name: 'fireborne',   frequency: 10, maxDepth: 12 },
        { name: 'troll',       frequency: 10, maxDepth: 15 },
    ].map(row=>Object.freeze(row)));
