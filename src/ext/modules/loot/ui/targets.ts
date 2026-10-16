/** Display catalog receives only already-known target IDs. */
export const LOOT_TARGET_NAMES:Readonly<Record<string,{nameKey:string}>> = Object.freeze({
  'abomination':{nameKey:'ext.loot.ui.target.abomination'},
  'dar':{nameKey:'ext.loot.ui.target.dar'},
  'animal':{nameKey:'ext.loot.ui.target.animal'},
  'goblin':{nameKey:'ext.loot.ui.target.goblin'},
  'ogre':{nameKey:'ext.loot.ui.target.ogre'},
  'dragon':{nameKey:'ext.loot.ui.target.dragon'},
  'undead':{nameKey:'ext.loot.ui.target.undead'},
  'jelly':{nameKey:'ext.loot.ui.target.jelly'},
  'turret':{nameKey:'ext.loot.ui.target.turret'},
  'infernal':{nameKey:'ext.loot.ui.target.infernal'},
  'mage':{nameKey:'ext.loot.ui.target.mage'},
  'waterborne':{nameKey:'ext.loot.ui.target.waterborne'},
  'airborne':{nameKey:'ext.loot.ui.target.airborne'},
  'fireborne':{nameKey:'ext.loot.ui.target.fireborne'},
  'troll':{nameKey:'ext.loot.ui.target.troll'},
});
