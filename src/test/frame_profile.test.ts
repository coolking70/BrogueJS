import { describe, expect, it } from 'vitest';
import { FrameProfile, timingSummary } from '../ui/frameProfile';
describe('Opt-in frame diagnostics', () => {
 it('reports measured median, tail and long frames without fabricating missing samples', () => {
  expect(timingSummary([])).toEqual({n:0,median:0,p95:0,max:0,over50:0});
  expect(timingSummary([10,16,100])).toEqual({n:3,median:16,p95:100,max:100,over50:1});
 });
 it('bounds the sample memory, separates auto frames, and resets all counters', () => {
  const profile=new FrameProfile();
  for(let i=1;i<=2001;i++) profile.frame(i*17,i>500);
  profile.record('autoStepCpuMs',12);profile.record('drawCpuMs',2);
  const state=JSON.parse(profile.report(50000,{mode:'tiles'})!);
  expect(state.timings.frameMs.n).toBe(1800);expect(state.timings.autoFrameMs.n).toBe(1500);
  expect(state.autoSteps).toBe(1);expect(state.draws).toBe(1);
  expect(profile.report(50100,{})).toBeNull();profile.reset();
  expect(JSON.parse(profile.report(51000,{})!).timings).toEqual({});
 });
});
