/** Compile-time boundary: trusted authority cannot be reached by a content import. */
// @ts-expect-error Trusted scope factories are absent from the content SDK.
import { withWorldActorScope } from '../worldSdk';
// @ts-expect-error Content cannot commit a foundation plan.
import { commitWorldWork } from '../worldSdk';
// @ts-expect-error Content cannot submit an offline item delta.
import { commitOfflineSettlement } from '../worldSdk';
// @ts-expect-error Native container transfer is a trusted adapter.
import { planMaterialTransfer } from '../worldSdk';
void [withWorldActorScope, commitWorldWork, commitOfflineSettlement, planMaterialTransfer];
