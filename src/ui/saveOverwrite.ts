import i18next from 'i18next';
import type { SaveSummary } from '../engine/Core/SaveStorage';
import type { DialogService } from './dialogService';

/** An incompatible save remains recoverable until the user explicitly replaces it. */
export async function approveSaveOverwrite(summary: SaveSummary | null, dialogs: DialogService): Promise<boolean> {
  if (!summary || summary.compatible) return true;
  const result = await dialogs.request({ kind: 'confirm', owner: 'menu-save', danger: true,
    text: i18next.t('save.overwrite_incompatible'), defaultAction: 'no', onAnswer: () => {} }).result;
  return result.status === 'answered' && result.action === 'yes';
}
