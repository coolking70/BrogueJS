<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useTranslation } from 'i18next-vue';
import { inputManager } from '../../engine/Input';
import type { GrowthCharacterViewModel, GrowthPortPreview, GrowthResourcePreview, GrowthTargetChoice, GrowthSkillTarget } from '../../ext/modules/growth/view';

const props = defineProps<{ model: GrowthCharacterViewModel; submitting: boolean; error: string | null; notice: string | null; initialTab?: 'attributes' | 'skills'; targetSkillId?: string | null; targets?: readonly GrowthTargetChoice[] }>();
const emit = defineEmits<{ close: []; reset: []; adjust: [id: string, amount: number]; submit: []; respec: []; skill: [action: 'learn' | 'equip' | 'unequip' | 'use', id: string]; target: [target: GrowthSkillTarget]; cancelTarget: [] }>();
const { t } = useTranslation();
// Names and descriptions have been validated against the pack's localization keys.
const text = (key: string) => t(`ext.growth.${key.slice('ext.growth.'.length)}`);
const definitionName = (id: string) => {
    const definition = [...props.model.attributes, ...props.model.skills, ...props.model.identities.flatMap(group => group.definitions)].find(entry => entry.id === id);
    return definition ? text(definition.nameKey) : '';
};
function portContext(port: GrowthPortPreview): string[] {
    const labels: Record<string, string> = { attackKind: 'attack-kind', damageKind: 'damage-kind', role: 'role', searchMode: 'search-mode',
        adjacent: 'adjacent', probabilityRoll: 'probability-roll', hit: 'hit', hpLost: 'positive-hp-damage', directDamage: 'direct-damage', tags: 'tag' };
    return Object.entries({ ...port.facts, role: port.subject }).map(([key, raw]) => {
        const name = t(`ext.growth.ui.condition.${labels[key]}`);
        const value = key === 'tags' ? (raw as readonly string[]).join('、') : typeof raw === 'boolean' || key === 'hpLost'
          ? (raw ? t('ext.growth.ui.condition_true') : t('ext.growth.ui.condition_false')) : t(`ext.growth.ui.value.${raw}`);
        return t('ext.growth.ui.condition', { name, value });
    });
}
const lockText = (mode: string) => t(`ext.growth.ui.lock.${mode}`);
const tab = ref<'attributes' | 'skills' | 'identities'>(props.initialTab ?? 'attributes');
const respecConfirm = ref(false);
watch(() => props.model.revision, () => { respecConfirm.value = false; });
const panel = ref<HTMLElement>();
const tabs = computed(() => [
    { id: 'attributes' as const, label: t('ext.growth.ui.attributes') },
    { id: 'skills' as const, label: t('ext.growth.ui.skills') },
    { id: 'identities' as const, label: t('ext.growth.ui.identities') },
]);
const resourcePreviews = (preview: GrowthResourcePreview) => [
    { id: 'hp', label: t('ext.growth.ui.current_hp'), ...preview.hp },
    { id: 'maxHp', label: t('ext.growth.ui.max_hp'), ...preview.maxHp },
    { id: 'strength', label: t('ext.growth.ui.strength'), ...preview.strength },
    { id: 'focus', label: t('ext.growth.ui.focus'), ...preview.focus },
    { id: 'focusCapacity', label: t('ext.growth.ui.focus_capacity'), ...preview.focusCapacity },
];
const previews = computed(() => resourcePreviews(props.model.preview));
const respecPreviews = computed(() => props.model.respec.preview ? resourcePreviews(props.model.respec.preview) : []);
const resourceName = computed(() => ({
    gold: t('ext.growth.ui.gold'), 'attribute-points': t('ext.growth.ui.attribute_points'),
    'skill-points': t('ext.growth.ui.skill_points'), focus: t('ext.growth.ui.focus'),
})[props.model.respec.cost.resource]);
const recoveryText = computed(() => ({
    none: t('ext.growth.ui.recovery_none'), increase: t('ext.growth.ui.recovery_increase'), full: t('ext.growth.ui.recovery_full'),
}));
let removeKeyboard: (() => void) | undefined;
function close() { if (!props.submitting) { if (props.targetSkillId) emit('cancelTarget'); else emit('close'); } }
onMounted(async () => {
    removeKeyboard = inputManager.registerModalKeyHandler(event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        return true;
    }, 600);
    await nextTick(); panel.value?.focus({ preventScroll: true });
});
onUnmounted(() => removeKeyboard?.());
</script>

<template>
  <Teleport to="body">
    <div class="growth-overlay" @click.self="close" @pointerdown.stop @pointerup.stop @touchstart.stop @touchend.stop>
      <section ref="panel" class="growth-panel" role="dialog" aria-modal="true" :aria-label="$t('ext.growth.ui.character')" tabindex="-1"
               @keydown.stop @keyup.stop @keydown.esc.prevent="close">
        <header class="growth-header">
          <button class="growth-back" @click="close">{{ $t('ext.growth.ui.back') }}</button>
          <h2>{{ $t('ext.growth.ui.character') }}</h2>
          <span class="growth-header-points">{{ $t('ext.growth.ui.points', { attributes: model.attributePoints, skills: model.skillPoints }) }}</span>
        </header>
        <div class="growth-summary">
          <strong>{{ $t('ext.growth.ui.level', { level: model.level }) }}</strong>
          <span>{{ model.atLevelCap ? $t('ext.growth.ui.level_cap') : $t('ext.growth.ui.experience', { current: model.experienceInLevel, next: model.experienceToNext }) }}</span>
          <progress v-if="!model.atLevelCap" :value="model.experienceInLevel" :max="model.experienceToNext ?? 1" :aria-label="$t('ext.growth.ui.experience_label')" />
          <p v-if="model.disabledReason === 'replay'" class="growth-notice">{{ $t('ext.growth.ui.replay_read_only') }}</p>
        </div>
        <nav class="growth-tabs">
          <button v-for="item in tabs" :key="item.id" :data-tab="item.id" :class="{ selected: tab === item.id }" @click="tab = item.id; respecConfirm = false; emit('cancelTarget')">{{ item.label }}</button>
        </nav>
        <main class="growth-body" @click.self="emit('cancelTarget')">
          <template v-if="tab === 'attributes'">
            <p class="growth-hint">{{ $t('ext.growth.ui.draft_hint') }}</p>
            <article v-for="attribute in model.attributes" :key="attribute.id" class="growth-attribute" :data-attribute="attribute.id">
              <div class="growth-attribute-title"><h3>{{ text(attribute.nameKey) }}</h3><strong>{{ attribute.value }}<span v-if="attribute.increment" class="growth-delta"> → {{ attribute.preview }}</span></strong></div>
              <p v-for="(line, index) in attribute.description" :key="index" class="growth-effect-description">{{ line }}</p>
              <div class="growth-attribute-controls">
                <span>{{ $t('ext.growth.ui.attribute_cost_cap', { cost: attribute.pointCost, cap: attribute.cap }) }}</span>
                <span v-if="!attribute.enabled" class="growth-muted">{{ $t('ext.growth.ui.config_disabled') }}</span>
                <div class="growth-stepper">
                  <button data-step="minus" :disabled="!attribute.canDecrease || model.readOnly || submitting" :aria-label="$t('ext.growth.ui.decrease', { name: text(attribute.nameKey) })" @click="emit('adjust', attribute.id, -1)">−</button>
                  <output>{{ $t('ext.growth.ui.increment', { count: attribute.increment }) }}</output>
                  <button data-step="plus" :disabled="!attribute.canIncrease || model.readOnly || submitting" :aria-label="$t('ext.growth.ui.increase', { name: text(attribute.nameKey) })" @click="emit('adjust', attribute.id, 1)">+</button>
                </div>
              </div>
            </article>
            <section class="growth-preview">
              <h3>{{ $t('ext.growth.ui.preview') }}</h3>
              <dl><div v-for="value in previews" :key="value.id" :data-preview="value.id"><dt>{{ value.label }}</dt><dd>{{ value.current }} → {{ value.preview }}<span v-if="value.delta" class="growth-delta"> ({{ value.delta > 0 ? '+' : '' }}{{ value.delta }})</span></dd></div></dl>
              <p>{{ $t('ext.growth.ui.recovery', { hp: recoveryText[model.recovery.hp], focus: recoveryText[model.recovery.focus] }) }}</p>
              <p>{{ model.recovery.clearCooldowns ? $t('ext.growth.ui.cooldown_clear') : $t('ext.growth.ui.cooldown_preserve') }}</p>
            </section>
            <section v-if="model.preview.ports.length" class="growth-preview growth-port-previews">
              <h3>{{ $t('ext.growth.ui.port_preview') }}</h3><p>{{ $t('ext.growth.ui.reference_hint') }}</p>
              <article v-for="port in model.preview.ports" :key="port.contextKey" class="growth-port">
                <div><b>{{ text(port.nameKey) }}</b><span>{{ port.current }} → {{ port.preview }}</span></div>
                <p v-if="port.reference">{{ $t('ext.growth.ui.reference_value', { base: port.baseValue }) }}</p>
                <p v-for="(context, contextIndex) in portContext(port)" :key="contextIndex" class="growth-port-context">{{ context }}</p>
              </article>
            </section>
            <section v-if="model.respec.enabled" class="growth-respec">
              <h3>{{ $t('ext.growth.ui.respec') }}</h3>
              <p>{{ $t('ext.growth.ui.respec_terms', { amount: model.respec.cost.amount, resource: resourceName, percent: model.respec.refundBasisPoints / 100, refund: model.respec.refund }) }}</p>
              <p>{{ model.respec.clearCooldowns ? $t('ext.growth.ui.cooldown_clear') : $t('ext.growth.ui.cooldown_preserve') }}</p>
              <button v-if="!respecConfirm" data-action="review-respec" :disabled="!model.respec.available || model.readOnly || submitting || model.draft.stale" @click="respecConfirm = true">{{ $t('ext.growth.ui.review_respec') }}</button>
              <div v-else class="growth-respec-actions"><dl class="growth-respec-preview"><div v-for="value in respecPreviews" :key="value.id" :data-respec-preview="value.id"><dt>{{ value.label }}</dt><dd>{{ value.current }} → {{ value.preview }}</dd></div></dl><p>{{ $t('ext.growth.ui.respec_confirm_hint') }}</p><button :disabled="submitting" @click="respecConfirm = false">{{ $t('ext.growth.ui.cancel') }}</button><button data-action="confirm-respec" :disabled="!model.respec.available || model.readOnly || submitting || model.draft.stale" @click="emit('respec')">{{ $t('ext.growth.ui.confirm_respec') }}</button></div>
            </section>
          </template>
          <template v-else-if="tab === 'skills'">
            <section v-if="targetSkillId" class="growth-target-picker" @click.self="emit('cancelTarget')">
              <h3>{{ $t('ext.growth.ui.select_target', { name: definitionName(targetSkillId) }) }}</h3>
              <p>{{ $t('ext.growth.ui.target_hint') }}</p>
              <div class="growth-target-grid">
                <button v-for="choice in targets" :key="choice.direction" :data-direction="choice.direction" :class="`growth-direction-${choice.direction}`"
                  :disabled="!choice.enabled || submitting || model.readOnly" @click="emit('target', choice.target)">{{ $t(`ext.growth.ui.direction.${choice.direction}`) }}</button>
                <button class="growth-direction-center" data-action="cancel-target" :disabled="submitting" @click="emit('cancelTarget')">{{ $t('ext.growth.ui.cancel') }}</button>
              </div>
            </section>
            <p v-if="model.draft.changed" class="growth-notice">{{ $t('ext.growth.ui.skill_draft_hint') }}</p>
            <p class="growth-hint">{{ model.equipment.time === 'native-wait' ? $t('ext.growth.ui.equip_native_wait') : $t('ext.growth.ui.equip_no_time') }} · {{ model.equipment.preservesCooldowns ? $t('ext.growth.ui.cooldown_preserve') : $t('ext.growth.ui.cooldown_clear') }} · {{ model.equipment.preservesFocus ? $t('ext.growth.ui.equip_focus_preserve') : $t('ext.growth.ui.equip_focus_full') }}</p>
            <div class="growth-slot-list"><div v-for="slot in model.slots" :key="slot.mode" class="growth-slot"><b>{{ slot.mode === 'active' ? $t('ext.growth.ui.active_slots') : $t('ext.growth.ui.passive_slots') }}</b><span>{{ $t('ext.growth.ui.slot_count', { count: slot.count }) }}</span><small>{{ $t('ext.growth.ui.slot_used', { count: slot.used }) }}</small></div></div>
            <section v-for="skill in model.skills" :key="skill.id" class="growth-skill-card">
              <article class="growth-definition" :data-skill="skill.id">
                <h3>{{ text(skill.nameKey) }}<small>{{ skill.mode === 'active' ? $t('ext.growth.ui.active') : $t('ext.growth.ui.passive') }}</small></h3>
                <p v-for="(line, index) in skill.description" :key="index" class="growth-effect-description">{{ line }}</p>
                <p>{{ $t('ext.growth.ui.skill_cost', { cost: skill.cost }) }} · {{ skill.affordable ? $t('ext.growth.ui.affordable') : $t('ext.growth.ui.unaffordable') }}</p>
                <p v-if="skill.mode === 'active'">{{ $t('ext.growth.ui.skill_resources', { focus: skill.focusCost, cooldown: skill.adjustedCooldown.preview }) }} · {{ $t('ext.growth.ui.cooldown_remaining', { count: skill.cooldownRemaining }) }}</p>
                <p>{{ $t('ext.growth.ui.lock_label', { mode: lockText(skill.effectiveLockMode) }) }}</p>
                <h4>{{ $t('ext.growth.ui.prerequisites') }}</h4>
                <p v-if="!skill.prerequisites.length">{{ $t('ext.growth.ui.no_prerequisites') }}</p>
                <ul v-else><li v-for="(requirement, index) in skill.prerequisites" :key="index" :class="{ 'growth-unmet': !requirement.met }">{{ text(requirement.nameKey) }}<span v-if="requirement.min !== undefined"> ≥ {{ requirement.min }}</span> · {{ requirement.met ? $t('ext.growth.ui.met') : $t('ext.growth.ui.unmet') }}</li></ul>
              </article>
              <!-- Stable action columns: a second click after rendering must not become another action. -->
              <div class="growth-skill-actions" :data-skill-actions="skill.id">
                <span>{{ skill.equipped ? $t('ext.growth.ui.equipped') : skill.learned ? $t('ext.growth.ui.learned') : $t('ext.growth.ui.unlearned') }}</span>
                <button data-action="learn-skill" :disabled="!skill.canLearn || submitting || !!targetSkillId" @click="emit('skill', 'learn', skill.id)">{{ $t('ext.growth.ui.learn_skill') }}</button>
                <button data-action="equip-skill" :disabled="!skill.canEquip || submitting || !!targetSkillId" @click="emit('skill', 'equip', skill.id)">{{ $t('ext.growth.ui.equip_skill') }}</button>
                <button data-action="unequip-skill" :disabled="!skill.canUnequip || submitting || !!targetSkillId" @click="emit('skill', 'unequip', skill.id)">{{ $t('ext.growth.ui.unequip_skill') }}</button>
                <button data-action="use-skill" class="growth-primary" :disabled="!skill.canUse || submitting || !!targetSkillId" @click="emit('skill', 'use', skill.id)">{{ $t('ext.growth.ui.use_skill') }}</button>
              </div>
            </section>
          </template>
          <template v-else>
            <p class="growth-notice">{{ $t('ext.growth.ui.identities_future') }}</p>
            <section v-for="group in model.identities" :key="group.kind" class="growth-identity-group">
              <h3>{{ text(group.nameKey) }} <small v-if="!group.enabled">{{ $t('ext.growth.ui.config_disabled') }}</small></h3>
              <article v-for="identity in group.definitions" :key="identity.id" class="growth-definition" :data-identity="identity.id">
                <h4>{{ text(identity.nameKey) }}</h4><p>{{ text(identity.descriptionKey) }}</p>
                <template v-if="identity.attributes.length"><h4>{{ $t('ext.growth.ui.identity_grants') }}</h4><ul><li v-for="grant in identity.attributes" :key="grant.attributeId">{{ definitionName(grant.attributeId) }} +{{ grant.amount }}</li></ul></template>
                <template v-if="identity.gifts.length"><h4>{{ $t('ext.growth.ui.identity_gifts') }}</h4><ul><li v-for="gift in identity.gifts" :key="gift.skillId">{{ definitionName(gift.skillId) }}</li></ul></template>
                <p v-for="(choice, choiceIndex) in identity.choices" :key="choiceIndex">{{ $t('ext.growth.ui.identity_choices', { names: choice.attributeIds.map(definitionName).join('、'), points: choice.points, cap: choice.perAttributeCap }) }}</p>
                <p v-if="identity.recommendedAttributes.length">{{ $t('ext.growth.ui.recommended_attributes', { names: identity.recommendedAttributes.map(definitionName).join('、') }) }}</p>
                <p v-if="identity.recommendedSkills.length">{{ $t('ext.growth.ui.recommended_skills', { names: identity.recommendedSkills.map(definitionName).join('、') }) }}</p>
                <p v-for="oath in identity.oaths" :key="oath.id">{{ text(oath.descriptionKey) }}</p>
                <span class="growth-future">{{ $t('ext.growth.ui.future_1e') }}</span>
              </article>
            </section>
          </template>
        </main>
        <footer class="growth-footer">
          <p v-if="error || (model.draft.errorKey && (model.draft.changed || model.draft.stale || (model.readOnly && model.disabledReason !== 'replay')))" class="growth-error" role="alert">{{ text(error || model.draft.errorKey!) }}</p>
          <p v-if="notice" class="growth-success" role="status">{{ text(notice) }}</p>
          <p v-if="tab === 'attributes'" class="growth-budget">{{ $t('ext.growth.ui.draft_budget', { cost: model.draft.cost, remaining: model.draft.remainingPoints }) }}</p>
          <div class="growth-footer-actions">
            <button data-action="cancel" :disabled="submitting" @click="close">{{ $t('ext.growth.ui.cancel') }}</button>
            <button v-if="tab === 'attributes'" data-action="reset" :disabled="submitting || (!model.draft.changed && !model.draft.stale) || model.readOnly" @click="emit('reset')">{{ $t('ext.growth.ui.reset') }}</button>
            <button v-if="tab === 'attributes'" data-action="allocate" class="growth-primary" :disabled="submitting || model.readOnly || !model.draft.changed || !model.draft.valid" @click="emit('submit')">{{ submitting ? $t('ext.growth.ui.submitting') : $t('ext.growth.ui.confirm') }}</button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.growth-skill-card{margin-bottom:14px;border:1px solid var(--th-line,#555)}.growth-skill-card .growth-definition{margin:0;border:0}.growth-skill-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;gap:8px;padding:10px 14px;border-top:1px dotted var(--th-line,#555)}.growth-skill-actions>span{grid-column:1/-1;color:var(--th-dim,#aaa);font-size:12px}.growth-panel .growth-skill-actions button{white-space:nowrap;min-width:0;padding:8px 2px}.growth-target-picker{position:sticky;top:0;z-index:2;border:1px solid var(--th-accent,#dcc88d);background:var(--th-panel,#171918);padding:12px;margin-bottom:14px}.growth-target-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-width:320px;margin:auto}.growth-direction-nw{grid-area:1/1}.growth-direction-n{grid-area:1/2}.growth-direction-ne{grid-area:1/3}.growth-direction-w{grid-area:2/1}.growth-direction-center{grid-area:2/2}.growth-direction-e{grid-area:2/3}.growth-direction-sw{grid-area:3/1}.growth-direction-s{grid-area:3/2}.growth-direction-se{grid-area:3/3}

.growth-overlay{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;padding:24px;background:#000b;box-sizing:border-box;color:var(--th-fg,#e4dfd1);font:14px var(--th-font,monospace);overscroll-behavior:contain;touch-action:pan-y}
.growth-panel{display:flex;flex-direction:column;width:min(780px,100%);height:min(780px,calc(100dvh - 48px));max-width:100%;background:var(--th-panel,#171918);border:1px solid var(--th-line,#555);box-shadow:0 20px 80px #0008;outline:none;overflow:hidden}
.growth-header{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--th-line,#555)}
.growth-header h2{font-size:19px;letter-spacing:3px;margin:0;flex:1}.growth-header-points{font-size:12px;color:var(--th-dim,#aaa)}
.growth-panel button{min-height:40px;border:1px solid var(--th-line,#555);background:transparent;color:inherit;padding:8px 12px;font:inherit;cursor:pointer;touch-action:manipulation}
.growth-panel button:disabled{opacity:.4;cursor:default}.growth-panel button:not(:disabled):hover,.growth-panel button:focus-visible{border-color:var(--th-accent,#dcc88d);background:var(--th-raised,#2d2e26)}
.growth-summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px;padding:12px 20px;font-size:13px}.growth-summary strong{color:var(--th-accent,#dcc88d)}
.growth-summary progress{height:5px;flex:1;min-width:60px;max-width:240px;accent-color:var(--th-accent,#dcc88d)}
.growth-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:0 20px;gap:5px;border-bottom:1px solid var(--th-line,#555)}.growth-tabs button{border-bottom:0}.growth-tabs .selected{background:var(--th-raised,#2d2e26);color:var(--th-accent,#dcc88d)}
.growth-body{min-height:0;overflow-y:auto;overscroll-behavior:contain;flex:1;padding:16px 20px;scrollbar-gutter:stable}.growth-body h3,.growth-body h4{font-size:14px;margin:0 0 8px}.growth-body p{margin:7px 0;line-height:1.65;color:var(--th-dim,#aaa);overflow-wrap:anywhere}.growth-body small{font-size:11px;font-weight:normal;color:var(--th-dim,#aaa);margin-left:10px}.growth-hint{font-size:12px;margin-top:0!important}
.growth-attribute,.growth-definition,.growth-preview,.growth-respec{border:1px solid var(--th-line,#555);padding:13px 14px;margin-bottom:12px}.growth-attribute-title{display:flex;justify-content:space-between;gap:10px}.growth-attribute-title h3{margin-bottom:0}.growth-attribute p{font-size:12px}.growth-attribute-controls{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--th-dim,#aaa);font-size:12px}.growth-stepper{display:flex;align-items:center;gap:8px;flex-shrink:0}.growth-stepper button{width:40px;padding:0;font-size:20px}.growth-stepper output{min-width:28px;text-align:center;color:var(--th-fg,#e4dfd1)}.growth-delta{color:var(--th-accent,#dcc88d)}
.growth-port{padding:10px 0;border-top:1px dotted var(--th-line,#555)}.growth-port>div{display:flex;justify-content:space-between;gap:10px;font-size:12px}.growth-port p{margin:3px 0;font-size:11px}.growth-preview dl{margin:0}.growth-preview dl>div{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dotted var(--th-line,#555)}.growth-preview dd{margin:0;font-variant-numeric:tabular-nums}.growth-preview p{font-size:12px}
.growth-notice{padding:9px 12px;border-left:2px solid var(--th-accent,#dcc88d);background:var(--th-raised,#2d2e26);font-size:12px;flex-basis:100%;margin:0!important}.growth-body>.growth-notice{margin-bottom:14px!important}.growth-slot-list{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.growth-slot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--th-line,#555);padding:12px}.growth-slot small{flex-basis:100%;margin:0}.growth-definition ul{padding-left:20px;font-size:12px;line-height:1.7}.growth-definition h4{margin-top:12px}.growth-definition h3{display:flex;align-items:center;justify-content:space-between}.growth-unmet{color:var(--th-warn,#e3aa76)}.growth-future{font-size:11px;color:var(--th-dim,#aaa);display:inline-block;border:1px solid var(--th-line,#555);padding:3px 6px}.growth-identity-group>h3{margin:20px 0 12px}.growth-identity-group:first-of-type>h3{margin-top:0}.growth-respec-actions{display:flex;flex-wrap:wrap;gap:8px}.growth-respec-preview{flex-basis:100%;margin:0}.growth-respec-preview>div{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px dotted var(--th-line,#555)}.growth-respec-preview dd{margin:0}.growth-respec-actions p{flex-basis:100%}
.growth-footer{padding:10px 20px 14px;border-top:1px solid var(--th-line,#555);background:var(--th-panel,#171918);flex-shrink:0}.growth-footer p{font-size:12px;margin:0 0 9px;line-height:1.5}.growth-footer-actions{display:flex;justify-content:flex-end;gap:8px}.growth-footer .growth-primary{background:var(--th-accent,#dcc88d);color:var(--th-bg,#171918);border-color:transparent}.growth-success{color:var(--th-accent,#dcc88d)}.growth-error{color:var(--th-warn,#e3aa76)}
@media(max-width:700px),(max-height:500px){.growth-overlay{padding:0}.growth-panel{width:100%;height:100dvh;max-height:100dvh;border:0}.growth-header{padding:10px 12px;gap:10px;flex-wrap:wrap}.growth-header h2{font-size:17px}.growth-header-points{font-size:11px}.growth-summary{padding:10px 12px;font-size:12px;gap:7px 12px}.growth-tabs{padding:0 12px}.growth-body{padding:12px;scrollbar-gutter:auto}.growth-panel button{min-height:44px;padding:8px 10px}.growth-footer{padding:10px 12px max(12px,env(safe-area-inset-bottom))}.growth-footer-actions>button{flex:1;min-width:0;padding:8px 4px;font-size:12px}.growth-stepper button{width:44px;padding:0}.growth-attribute{padding:11px 10px}.growth-attribute-controls{flex-wrap:wrap;gap:6px}.growth-stepper{margin-left:auto}.growth-slot-list{gap:8px}.growth-slot{padding:10px}.growth-slot b{font-size:12px}}
</style>
