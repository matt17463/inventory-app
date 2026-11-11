/** Shared client-safe visual themes. Suggested logo colors must be reviewed by staff. */
export const marketingDesigns = Object.freeze({
  schoolSpirit: { label: "School spirit", primary: "#233B69", accent: "#E6B93E", background: "#EEF3FA" },
  teamEnergy: { label: "Team energy", primary: "#183D54", accent: "#E3A93D", background: "#EAF2F6" },
  editorial: { label: "Clean editorial", primary: "#203B50", accent: "#B92D48", background: "#F0F4F7" },
  premium: { label: "Premium proposal", primary: "#252D40", accent: "#A47A40", background: "#F5F1E9" },
});
const isHex = value => /^#[0-9a-f]{6}$/i.test(value || "");
const rgb = value => [1,3,5].map(i => parseInt(value.slice(i,i+2),16));
const contrast = (a,b) => {
  const luminance = value => rgb(value).map(v => { const c=v/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4; }).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
};
export function marketingTheme(document = {}) {
  const key = Object.hasOwn(marketingDesigns, document.design) ? document.design :
    document.segment === "school" ? "schoolSpirit" : document.segment === "team" ? "teamEnergy" : "editorial";
  const base=marketingDesigns[key];
  const verified=(Array.isArray(document.confirmedColors)?document.confirmedColors:[]).filter(isHex);
  const requested=verified[0] || base.primary;
  const primary=contrast(requested,"#FFFFFF") >= 4.5 ? requested : base.primary;
  const accent=verified.find(color=>contrast(color,primary)>=2.5) || base.accent;
  return { ...base, key, primary, accent, verifiedColors:verified };
}
export const marketingAudiences = Object.freeze({
  general:"General client contact", pto:"PTA / PTO leadership", athletics:"Athletic director", coach:"Coach / team manager",
  club:"Club board or program director", student:"Student leadership", parent:"Parents and supporters"
});
