import i18next from 'i18next';
/** World content uses the extension localization namespace, like module views.
 * Preserve the complete data-owned suffix; do not translate Item descriptions as prose. */
export function worldText(textKey:string):string {
    const suffix=textKey.startsWith('ext.')?textKey.slice(4):textKey;
    return i18next.t(`ext.${suffix}`);
}
