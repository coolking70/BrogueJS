<script setup lang="ts">
import { computed, ref } from 'vue';
import i18next from 'i18next';
import type { GrowthCharacterViewModel } from '../view';
const props = defineProps<{ model: GrowthCharacterViewModel; blocked: boolean; submitting: boolean; immersive: boolean; loadStatus?: 'loading' | 'failed' | null }>();
const emit = defineEmits<{ open: []; use: [id: string] }>();
const growthSkillBarExpanded = ref(false);
const equippedSkills = computed(() => props.model.skills.filter(skill => skill.mode === 'active' && skill.equipped));
const growthName = (key: string) => i18next.t(`ext.growth.${key.slice('ext.growth.'.length)}`);
</script>
<template>
      <section  class="area-skills growth-skill-bar" @keydown.stop @keyup.stop @pointerdown.stop @touchstart.stop>
        <button data-action="show-skills" :title="loadStatus === 'loading' ? $t('ext.growth.ui.loading_panel') : loadStatus === 'failed' ? $t('ext.growth.ui.load_panel_failed') : $t('ext.growth.ui.skills_list')" :disabled="blocked" @click="emit('open')">{{ loadStatus === 'loading' ? $t('ext.growth.ui.loading_panel') : loadStatus === 'failed' ? $t('ext.growth.ui.load_panel_failed') : $t('ext.growth.ui.skills_list') }}</button>
        <button v-if="immersive && equippedSkills.length" data-action="toggle-skills" :aria-expanded="growthSkillBarExpanded" @click="growthSkillBarExpanded = !growthSkillBarExpanded">{{ growthSkillBarExpanded ? '−' : '+' }}</button>
        <div v-if="!immersive || growthSkillBarExpanded" class="growth-equipped-skills">
          <button v-for="skill in equippedSkills" :key="skill.id" :data-use-skill="skill.id" :disabled="!skill.canUse || blocked || submitting" @click="emit('use', skill.id)">{{ skill.cooldownRemaining ? $t('ext.growth.ui.skill_bar_cooldown', { name: growthName(skill.nameKey), count: skill.cooldownRemaining }) : $t('ext.growth.ui.skill_bar_ready', { name: growthName(skill.nameKey), focus: skill.focusCost }) }}</button>
        </div>
        <span class="growth-bar-focus">{{ $t('ext.growth.ui.focus_compact', { current: model.focus.current, capacity: model.focus.capacity }) }}</span>
      </section>
</template>
<style scoped>
.growth-skill-bar{grid-area:skills;display:flex;align-items:center;gap:6px;padding:4px 8px;min-width:0;border-top:1px solid var(--th-line,#555);background:var(--th-panel,#171918);font:12px var(--th-font,monospace);color:var(--th-fg,#eee);z-index:31;box-sizing:border-box}.growth-skill-bar button{min-height:40px;flex:0 0 auto;white-space:nowrap;padding:6px 9px;border:1px solid var(--th-line,#555);background:var(--th-raised,#222);color:inherit;font:inherit;touch-action:manipulation;cursor:pointer}.growth-skill-bar [data-action=show-skills]{flex:0 1 auto;min-width:0;max-width:55%;overflow:hidden;text-overflow:ellipsis}.growth-skill-bar button:disabled{opacity:.45;cursor:default}.growth-equipped-skills{display:flex;gap:6px;min-width:0;overflow-x:auto;scrollbar-width:thin;flex:1}.growth-bar-focus{margin-left:auto;white-space:nowrap;flex:0 0 auto;color:var(--th-dim,#aaa)}
@media(max-width:700px){.growth-skill-bar{gap:4px;padding:3px 6px;font-size:11px}.growth-skill-bar button{min-height:44px;padding:5px 7px}.growth-equipped-skills{gap:4px}}
</style>
