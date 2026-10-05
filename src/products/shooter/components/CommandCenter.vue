<script setup lang="ts">
import {ref} from 'vue';
import {useTranslation} from 'i18next-vue';
import type {MetaView,OperationView,OperationDescriptor,MetaDescriptor} from '../../../engine/Simulation/StrategicRuntime';
const props=defineProps<{operation:OperationView|null;meta:MetaView|null;operations:OperationDescriptor|null;armory:MetaDescriptor|null;weapons:{slot:number;labelKey:string}[];abilities:{slot:number;labelKey:string}[];canDeploy:boolean}>();
const emit=defineEmits<{start:[region:number,difficulty:number];deploy:[];purchase:[kind:'weapon'|'support',slot:number];equip:[slots:number[]];training:[]}>();
const {t}=useTranslation(),region=ref(0),difficulty=ref(0);
function equip(slot:number){const equipped=props.meta!.equipped;if(equipped.includes(slot))return;emit('equip',[equipped[0]!,slot]);}
</script>
<template>
<section class="command-center" data-testid="command-center">
  <div class="command-heading"><div><p class="eyebrow">{{ t('shooter.strategy.eyebrow') }}</p><h2>{{ t('shooter.strategy.title') }}</h2></div><button data-testid="training" @click="emit('training')">{{ operation?.ticket?t('shooter.strategy.continue'):t('shooter.strategy.training') }}</button></div>
  <p class="strategy-help">{{ t('shooter.strategy.help') }}</p>
  <div v-if="meta" class="account" data-testid="account">{{ t('shooter.strategy.account',{credits:meta.credits,samples:meta.samples,completed:meta.completed}) }}</div>
  <template v-if="operations && operation">
    <div class="sector-map" data-testid="sector-map"><div class="map-grid" />
      <button v-for="(r,index) in operations.regions" :key="r.labelKey" :data-testid="'region-'+index" :class="{selected:(operation.status==='active'?operation.region:region)===index}" :style="{left:r.x+'%',top:r.y+'%'}" :disabled="operation.status==='active'" @click="region=index"><span class="pin" /><strong>{{ t(r.labelKey) }}</strong></button>
    </div>
    <div class="operation-setup">
      <label>{{ t('shooter.strategy.difficulty') }} <select v-model.number="difficulty" data-testid="difficulty" :disabled="operation.status==='active'"><option v-for="(d,index) in operations.difficulties" :key="d.labelKey" :value="index" :disabled="index>(meta?.difficulty??2)">{{ t(d.labelKey) }}{{ index>(meta?.difficulty??2)?t('shooter.strategy.locked'):'' }}</option></select></label>
      <button v-if="operation.status!=='active'" class="primary" data-testid="operation-start" :disabled="!canDeploy" @click="emit('start',region,difficulty)">{{ t('shooter.strategy.start') }}</button>
    </div>
    <div v-if="operation.status!=='idle'" class="operation-card" data-testid="operation-status">
      <h3>{{ t(operations.regions[operation.region]!.labelKey) }} · {{ t(operations.difficulties[operation.difficulty]!.labelKey) }}</h3>
      <p>{{ t('shooter.strategy.status.'+operation.status) }}</p>
      <div class="sorties"><span v-for="index in 3" :key="index" :class="{done:index<=operation.index,current:operation.status==='active'&&index===operation.index+1}"><b>{{ t('shooter.strategy.sortie',{index}) }}</b><small v-if="index<=operation.index">{{ t('shooter.strategy.done') }}</small></span></div>
      <button v-if="operation.status==='active'" data-testid="deploy" class="primary" :disabled="!canDeploy" @click="emit('deploy')">{{ operation.ticket?t('shooter.strategy.continue'):t('shooter.strategy.deploy',{index:operation.index+1}) }}</button>
    </div>
  </template>
  <div v-if="meta && armory" class="armory">
    <h3>{{ t('shooter.strategy.armory') }}</h3><p>{{ t('shooter.strategy.loadoutHelp') }}</p>
    <div class="armory-grid"><article v-for="w in weapons" :key="w.slot" :data-testid="'armory-weapon-'+w.slot"><strong>{{ t(w.labelKey) }}</strong>
      <button v-if="!meta.weapons.includes(w.slot)" :disabled="meta.credits<armory.weaponCosts[w.slot]! || !!operation?.ticket" @click="emit('purchase','weapon',w.slot)">{{ t('shooter.strategy.unlock',{cost:armory.weaponCosts[w.slot]}) }}</button>
      <button v-else :class="{equipped:meta.equipped.includes(w.slot)}" :disabled="!!operation?.ticket||meta.equipped.includes(w.slot)" @click="equip(w.slot)">{{ meta.equipped.includes(w.slot)?t('shooter.strategy.equipped'):t('shooter.strategy.equip') }}</button>
    </article></div>
    <h3>{{ t('shooter.strategy.support') }}</h3><p>{{ t('shooter.strategy.upgradeHelp') }}</p>
    <div class="armory-grid"><article v-for="a in abilities" :key="a.slot" :data-testid="'armory-support-'+a.slot"><strong>{{ t(a.labelKey) }}</strong><small>{{ meta.support[a.slot]!<0?t('shooter.strategy.locked'):t('shooter.strategy.level',{level:meta.support[a.slot]!+1}) }}</small>
      <button :disabled="meta.support[a.slot]===2 || !!operation?.ticket || meta.credits<(meta.support[a.slot]!<0?armory.supportCosts[a.slot]!:armory.upgradeCosts[meta.support[a.slot]!]!)" @click="emit('purchase','support',a.slot)">{{ meta.support[a.slot]===2?t('shooter.strategy.max'):meta.support[a.slot]!<0?t('shooter.strategy.unlock',{cost:armory.supportCosts[a.slot]}):t('shooter.strategy.upgrade',{cost:armory.upgradeCosts[meta.support[a.slot]!]}) }}</button>
    </article></div>
  </div>
</section>
</template>
<style scoped>
.command-center{margin:24px 0}.command-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.command-heading h2{font-size:30px;margin:8px 0}.strategy-help,.armory p{color:#94ac9e;font-size:12px;line-height:1.8}.account{padding:14px;background:#233529;border-left:3px solid #d2ef9b;font-size:14px;margin:18px 0}.sector-map{height:280px;position:relative;overflow:hidden;border:1px solid #405b4b;border-radius:12px;background:radial-gradient(ellipse at 50% 70%,#345343,#14251e 72%);margin:18px 0}.map-grid{position:absolute;inset:0;opacity:.15;background-image:linear-gradient(#91ba99 1px,transparent 1px),linear-gradient(90deg,#91ba99 1px,transparent 1px);background-size:28px 28px}.sector-map button{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:12px;border:0;background:transparent;padding:10px;white-space:nowrap}.pin{width:16px;height:16px;border:2px solid #92b3a1;border-radius:50%;background:#162a20}.sector-map .selected .pin{background:#d2ef9b;box-shadow:0 0 22px #d2ef9b}.sector-map .selected{color:#d2ef9b}.operation-setup{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:12px}select{color:#d2ef9b;background:#18291e;padding:10px;border:1px solid #49634e;border-radius:6px}.operation-card{border:1px solid #405942;background:#192c21;padding:18px;border-radius:10px;margin:18px 0}h3{font-size:15px;font-weight:500}.operation-card p{color:#b7d8ba;font-size:13px}.sorties{display:flex;gap:8px;margin:18px 0}.sorties span{flex:1;padding:12px;border:1px solid #394b3c;color:#718d7d;font-size:12px;text-align:center}.sorties b{display:block;font-weight:500}.sorties small{display:block;margin-top:6px;font-size:10px}.sorties .current{border-color:#d2ef9b;color:#d2ef9b}.sorties .done{color:#a0dac0;background:#294737}.armory{margin-top:28px}.armory-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.armory-grid article{padding:14px;border:1px solid #385040;border-radius:9px;background:#15251b;display:flex;flex-direction:column;gap:12px;min-width:0}.armory-grid strong{font-size:13px}.armory-grid small{font-size:11px;color:#93ad9a}.armory-grid button{margin-top:auto;padding:9px;font-size:11px}.equipped{color:#d2ef9b}@media(max-width:600px){.armory-grid{grid-template-columns:repeat(2,1fr)}.command-heading h2{font-size:24px}.sector-map{height:250px}.sector-map strong{font-size:10px}.sector-map button{padding:4px}.operation-setup{flex-wrap:wrap}.sorties{gap:5px}.sorties span{padding:10px 4px}.account{font-size:12px}.command-heading{gap:6px}}
</style>
