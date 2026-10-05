<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { touchMovement } from '../input/MovementAdapters';
import { touchAim } from '../input/AimAdapters';
const props = defineProps<{ disabled: boolean; aim?: boolean }>();
const emit = defineEmits<{ move: [value: { x: number; y: number; active: boolean; angle: number | null }] }>();
const { t } = useTranslation();
const pad = ref<HTMLDivElement>();
const knob = ref({ x: 0, y: 0 });
let pointer: number | null = null;
const knobStyle = computed(() => ({ transform: `translate(${knob.value.x}px, ${knob.value.y}px)` }));
function update(event: PointerEvent): void {
    if (pointer !== event.pointerId || props.disabled) return;
    const rect = pad.value!.getBoundingClientRect(), radius = rect.width * .31;
    const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
    const scale = Math.min(1, radius / Math.max(1, Math.hypot(dx, dy)));
    knob.value = { x: dx * scale, y: dy * scale };
    emit('move', { ...touchMovement(dx, dy, radius), active: true, angle: touchAim(dx, dy, radius) });
}
function down(event: PointerEvent): void {
    if (props.disabled || pointer !== null || event.button !== 0) return;
    event.preventDefault(); pointer = event.pointerId; pad.value!.setPointerCapture(pointer); update(event);
}
function reset(event?: PointerEvent): void {
    if (event && pointer !== event.pointerId) return;
    const previous = pointer; pointer = null; knob.value = { x: 0, y: 0 };
    if (previous !== null && pad.value?.hasPointerCapture(previous)) pad.value.releasePointerCapture(previous);
    emit('move', { x: 0, y: 0, active: false, angle: null });
}
watch(() => props.disabled, disabled => { if (disabled) reset(); });
</script>

<template>
  <div ref="pad" class="movement-stick" :class="{ disabled }" :data-testid="aim ? 'aim-stick' : 'movement-stick'"
    @pointerdown="down" @pointermove="update" @pointerup="reset" @pointercancel="reset" @lostpointercapture="reset">
    <span class="stick-cross horizontal" /><span class="stick-cross vertical" />
    <span class="stick-knob" :style="knobStyle" /><span class="stick-label">{{ aim ? t('shooter.aimStick') : t('shooter.moveStick') }}</span>
  </div>
</template>

<style scoped>
.movement-stick { position: relative; width: 128px; height: 128px; flex: 0 0 128px; border-radius: 50%; background: #10241ed9; border: 1px solid #78907480; touch-action: none; user-select: none; }
.movement-stick.disabled { opacity: .38; }.stick-knob { position: absolute; width: 44px; height: 44px; left: 41px; top: 41px; border-radius: 50%; border: 1px solid #d2ef9b; background: #b5d99045; pointer-events: none; }
.stick-cross { position: absolute; background: #a3bd9125; pointer-events: none; }.horizontal { top: 63px; left: 14px; width: 98px; height: 1px; }.vertical { left: 63px; top: 14px; height: 98px; width: 1px; }
.stick-label { position: absolute; width: 100%; text-align: center; bottom: 10px; font-size: 10px; color: #adc1a0; pointer-events: none; }
</style>
