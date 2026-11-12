/** Bounded operator layout adjustments. Never accept raw CSS or model-defined coordinates. */
export const DEFAULT_STUDIO_LAYOUT=Object.freeze({heroHeight:3.35,galleryHeight:2.35,spacing:0.16,presentation:"overlap"});
const clamp=(value,defaultValue,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):defaultValue;
export function normalizeStudioLayout(value={}){
 const source=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
 return {
  heroHeight:clamp(source.heroHeight,DEFAULT_STUDIO_LAYOUT.heroHeight,2.8,3.65),
  galleryHeight:clamp(source.galleryHeight,DEFAULT_STUDIO_LAYOUT.galleryHeight,1.5,2.5),
  spacing:clamp(source.spacing,DEFAULT_STUDIO_LAYOUT.spacing,0.06,0.22),
  presentation:["overlap","grid"].includes(source.presentation)?source.presentation:DEFAULT_STUDIO_LAYOUT.presentation
 };
}
export function studioLayoutStyle(value){
 const v=normalizeStudioLayout(value);
 return `--studio-hero-height:${v.heroHeight.toFixed(2)}in;--studio-gallery-height:${v.galleryHeight.toFixed(2)}in;--studio-gap:${v.spacing.toFixed(2)}in;`;
}
