<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
const { t } = useTranslation();
defineEmits<{ open: [] }>();
</script>
<template>
  <button class="settlement-entry" @click="$emit('open')">{{ t('ext.settlement.ui.open') }}</button>
</template>
<style scoped>
.settlement-entry {
  min-height: 44px;
  background: var(--th-panel);
  color: var(--th-fg);
  border: 1px solid var(--th-line);
  font: inherit;
  padding: 8px;
}
</style>
