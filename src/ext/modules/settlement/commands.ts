import type { WorldWorkCommand } from '../../worldSdk';
import { exact, uint, World5Error } from '../../worldBasics';
export const worldWorkCommands: Partial<Record<'harvest' | 'cancel-work', WorldWorkCommand>> = {
  harvest: {
    prepare(payload, sdk) {
      try {
        exact(
          payload,
          'v,nodeId,nodeRevision,inventoryStamp,destinationId,destinationRevision',
          'harvest'
        );
        if (payload.v !== 1 || typeof payload.inventoryStamp !== 'string')
          throw new World5Error('C5_BAD_PAYLOAD');
        uint(payload.nodeId, 'nodeId', 1);
        uint(payload.nodeRevision, 'nodeRevision');
        if (payload.destinationId !== null) {
          uint(payload.destinationId, 'destinationId', 1);
          uint(payload.destinationRevision, 'destinationRevision');
        } else if (payload.destinationRevision !== null) throw new World5Error('C5_BAD_PAYLOAD');
        return sdk.planTimedWork({
          kind: 'harvest',
          nodeId: payload.nodeId,
          nodeRevision: payload.nodeRevision,
          inventoryStamp: payload.inventoryStamp,
          destinationId: payload.destinationId as number | null,
          destinationRevision: payload.destinationRevision as number | null
        });
      } catch {
        return { ok: false, code: 'C5_BAD_PAYLOAD', field: null };
      }
    }
  },
  'cancel-work': {
    prepare(payload, sdk) {
      try {
        exact(payload, 'v,ticketId,ticketRevision', 'cancel');
        if (payload.v !== 1) throw new World5Error('C5_BAD_PAYLOAD');
        uint(payload.ticketId, 'ticketId', 1);
        uint(payload.ticketRevision, 'ticketRevision');
        return sdk.planCancelWork({
          ticketId: payload.ticketId,
          ticketRevision: payload.ticketRevision
        });
      } catch {
        return { ok: false, code: 'C5_BAD_PAYLOAD', field: null };
      }
    }
  }
};
