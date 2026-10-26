export const LABEL_DESIGN_FIELDS=[
 ['student','Student / Player'],['teacher','Teacher'],['coach','Coach'],
 ['team','Team / Classroom'],['grade','Grade'],['playerNumber','Player #'],
 ['appliedName','Name Applied'],['school','School / Organization'],
];
export const LABEL_PRESETS={
 general:{name:'General Packing',visible:['student','team','appliedName'],fontSize:10,logoSize:52,showLogo:true},
 school:{name:'School Distribution',visible:['student','teacher','grade','school','team'],fontSize:10,logoSize:52,showLogo:true},
 sports:{name:'Sports / Team',visible:['student','coach','team','playerNumber','appliedName'],fontSize:10,logoSize:52,showLogo:true},
 individual:{name:'Individual Customer',visible:['student','appliedName'],fontSize:11,logoSize:54,showLogo:true},
 bulk:{name:'Bulk Distribution',visible:['teacher','team','grade','school'],fontSize:10,logoSize:48,showLogo:true},
};
const keys=LABEL_DESIGN_FIELDS.map(([key])=>key);
export function normalizeLabelDesign(input={}){
 const order=[...(Array.isArray(input.order)?input.order:keys)].filter((key,index,array)=>keys.includes(key)&&array.indexOf(key)===index);
 for(const key of keys)if(!order.includes(key))order.push(key);
 const visible=Array.isArray(input.visible)?input.visible.filter(key=>keys.includes(key)):keys;
 const labels={};
 for(const [key,defaultLabel] of LABEL_DESIGN_FIELDS)labels[key]=String(input.labels?.[key]||defaultLabel).slice(0,28);
 const fontSize=Math.max(8,Math.min(13,Number(input.fontSize)||10));
 const logoSize=Math.max(24,Math.min(60,Number(input.logoSize)||52));
 return {order,visible,labels,fontSize,logoSize,showLogo:input.showLogo!==false};
}
export function presetLabelDesign(name){
 const preset=LABEL_PRESETS[name]||LABEL_PRESETS.general;
 return normalizeLabelDesign({...preset});
}
export function moveLabelField(design,key,direction){
 const next=normalizeLabelDesign(design);const i=next.order.indexOf(key),target=i+direction;
 if(i<0||target<0||target>=next.order.length)return next;
 [next.order[i],next.order[target]]=[next.order[target],next.order[i]];
 return next;
}
