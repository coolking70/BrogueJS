/** Share the exact map primitives with the reference legend; no duplicate icon art. */
import { paintVectorTile } from './mapTileDrawing';
import type { TileSemantic } from './mapTileSemantics';
type Paint = number | { color?: string | number; alpha?: number; width?: number };
export function vectorIconSvg(value: TileSemantic, color = 0xcbbb99): string {
 const shapes: string[] = [];
 let pending = '', path = '';
 const n = (v: number) => Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
 const attr = (v: Paint, stroke = false) => {
  const p = typeof v === 'number' ? {color:v} : v;
  const raw = typeof p.color === 'number' ? p.color : parseInt(String(p.color ?? color).replace('#',''),16);
  const hex = '#' + (Number.isFinite(raw) ? raw : color).toString(16).padStart(6, '0').slice(-6);
  return stroke ? `fill="none" stroke="${hex}" stroke-width="${n(p.width ?? 1)}" stroke-opacity="${n(p.alpha ?? 1)}" stroke-linejoin="round" stroke-linecap="round"` : `fill="${hex}" fill-opacity="${n(p.alpha ?? 1)}"`;
 };
 const emit = (paint: Paint, stroke = false) => {
  if (path) { pending = `<path d="${path}"`; path = ''; }
  if (pending) shapes.push(pending + ' ' + attr(paint,stroke) + '/>');
  return api;
 };
 const api = {
  rect(x:number,y:number,w:number,h:number) { pending=`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"`; return api; },
  roundRect(x:number,y:number,w:number,h:number,r:number) { pending=`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}"`;return api; },
  circle(x:number,y:number,r:number) { pending=`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"`;return api; },
  ellipse(x:number,y:number,rx:number,ry:number) {pending=`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}"`;return api;},
  poly(points:number[]) {pending=`<polygon points="${points.map(n).join(' ')}"`;return api;},
  moveTo(x:number,y:number) {path+=`M${n(x)} ${n(y)}`;return api;},
  lineTo(x:number,y:number) {path+=`L${n(x)} ${n(y)}`;return api;},
  closePath() {path+='Z';return api;},
  bezierCurveTo(a:number,b:number,c:number,d:number,e:number,f:number){path+=`C${[a,b,c,d,e,f].map(n).join(' ')}`;return api;},
  quadraticCurveTo(a:number,b:number,c:number,d:number){path+=`Q${[a,b,c,d].map(n).join(' ')}`;return api;},
  fill(paint:Paint) {return emit(paint);},
  stroke(paint:Paint) {return emit(paint,true);},
 };
 paintVectorTile(api as never,value,color,0,0,16);
 return shapes.join('');
}
