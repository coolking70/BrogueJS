import i18next from 'i18next';

/** C5 is a foundation capability, not a dependency on the settlement UI.
 * Translate only stable codes; diagnostic messages and unknown codes stay private. */
export function partyFailureKey(code: string): string {
  const key = /^C5_[A-Z_]+$/.test(code)
    ? 'ext.foundation.world.error.' + code.slice(3).toLowerCase()
    : 'ext.party.error.' + code;
  return i18next.exists(key) ? key : 'ext.party.error.INTERNAL_FAILURE';
}

/** Keep each dynamic vocabulary visible to the existing i18n source scanner. */
export function partyFailureText(code: string): string {
  const key = partyFailureKey(code);
  if (key === 'ext.party.error.INTERNAL_FAILURE')
    return i18next.t('ext.party.error.INTERNAL_FAILURE');
  return key.startsWith('ext.foundation.world.error.')
    ? i18next.t('ext.foundation.world.error.' + code.slice(3).toLowerCase())
    : i18next.t('ext.party.error.' + code);
}
