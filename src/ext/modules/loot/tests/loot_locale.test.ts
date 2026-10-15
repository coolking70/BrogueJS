import { describe, expect, it } from 'vitest';
import { loadLootPack } from '../definitions';
import locale from '../locales/zh_CN.json';
import { descriptor } from '../descriptor';

describe('loot locale closed reference set',()=>{
  it('contains exactly every data reference plus descriptor keys',()=>{
    const refs=new Set<string>();
    // Independently mirror the shared i18n scanner rather than use schema's collector.
    const visit=(value:unknown):void=>{
      if(Array.isArray(value)){value.forEach(visit);return;}
      if(!value||typeof value!=='object')return;
      for(const [k,v]of Object.entries(value)){
        if(['nameKey','descriptionKey','textKey','titleKey','unavailableKey','altKey','reasonKey','labelKey'].includes(k)&&typeof v==='string')refs.add(v);
        else visit(v);
      }
    };
    visit(loadLootPack());refs.add(descriptor.labelKey);refs.add(descriptor.descriptionKey!);
    expect(Object.keys(locale).sort()).toEqual([...refs].sort());
    expect(refs.size).toBe(151);
  });
  it('uses nonempty Chinese original text with no placeholder',()=>{
    for(const [key,value]of Object.entries(locale)){
      expect(key).toMatch(/^ext\.loot\./);expect(value.trim()).not.toBe('');
      expect(value).toMatch(/[\u3400-\u9fff]/);expect(value).not.toMatch(/TODO/i);
    }
  });
});
