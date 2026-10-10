/** Select inputs only; all choices use the same real-Game assertions. */
export function moduleCombinationSelections(installed, scope = 'all') {
    if (scope === 'all')
        return installed.reduce((sets, id) => [...sets, ...sets.map(set => [...set, id])], [[]]);
    if (scope === 'endpoints') return installed.length ? [[], [...installed]] : [[]];
    throw new Error(`Invalid combination selection: ${scope}`);
}
