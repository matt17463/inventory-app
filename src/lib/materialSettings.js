export const MACHINE_TYPES = [
  { id: 'roland_bn2', label: 'Roland BN2-30 eco-solvent printer/cutter', modes: ['print_only','print_cut'], note: 'Confirm actual CMYK/CMYKW ink set and exact VersaWorks profile. Record print/dryer setpoints in °C, feed and crop alignment, media roll specifications, cut-test results, and press/lamination instructions.' },
  { id: 'mopa_fiber', label: 'MOPA fiber laser', modes: ['color_engrave','etch','score','cut','engrave'], note: 'Record exact laser wattage, lens, frequency (kHz), pulse duration (ns), speed, power, hatch and passes.' },
  { id: 'xtool_s1', label: 'xTool S1', modes: ['engrave','score','cut'], note: 'Record installed diode/IR module and wattage, lens, air assist, speed, power and passes.' },
  { id: 'xtool_p2', label: 'xTool P2', modes: ['engrave','score','cut'], note: 'Record CO2 model, material thickness, focus, power, speed and air assist.' },
  { id: 'xtool_omni', label: 'xTool Omni Dual UV', modes: ['uv_flat','uv_texture','uv_relief','uv_varnish'], note: 'Record substrate, primer, ink mode, texture height, smoothness and cure/adhesion results. xTool Studio executes the print.' },
  { id: 'sawgrass_sg500', label: 'Sawgrass SG500 sublimation printer', modes: ['sublimation'], note: 'Record ink system, print manager, color profile, paper, mirror setting and print quality. Heat transfer occurs on a compatible press and blank-specific recipe.' },
  { id: 'heat_press', label: 'Heat press', modes: ['heat_transfer'], note: 'Record press model, platen, temperature, dwell time, pressure, carrier, peel and garment type.' },
  { id: 'sublimation_press', label: 'Sublimation heat press', modes: ['sublimation'], note: 'Record press model, temperature, dwell, pressure, substrate coating, protective paper and peel.' },
];
export const OPERATION_LABELS = {
  print_only: 'Eco-solvent print only', print_cut: 'Eco-solvent print and contour cut',
  color_engrave: 'Color marking', etch: 'Etching', score: 'Scoring', cut: 'Cutting', engrave: 'Engraving',
  uv_flat: 'UV flat print', uv_texture: 'Raised texture', uv_relief: 'Relief', uv_varnish: 'Spot varnish',
  heat_transfer: 'Heat transfer', sublimation: 'Sublimation',
};
export const SAFETY_BLOCKED = /(?:^|\W)(?:pvc|polyvinyl chloride|vinyl|vinyl chloride|chlorinated plastic|unknown plastic|unidentified plastic)(?:$|\W)/i;
export function machineFor(id) { return MACHINE_TYPES.find(x=>x.id===id) || MACHINE_TYPES[0]; }
export function materialSafety(machine, material) {
  const text = String(material || '').trim();
  if (!text) return {blocked:true,reason:'Identify the specific material and its coating before obtaining a recipe.'};
  if (['xtool_s1','xtool_p2','mopa_fiber'].includes(machine) && SAFETY_BLOCKED.test(text)) {
    return {blocked:true,reason:'Do not laser-process PVC, vinyl chloride or unknown plastics. Hazardous corrosive fumes may result. Verify the material SDS.'};
  }
  if (machine === 'xtool_omni' && /(?:^|\W)(htv|heat.transfer vinyl)(?:$|\W)/i.test(text)) {
    return {blocked:false,warning:'Ordinary HTV is not automatically compatible with raised UV printing. Require exact film specification, adhesion and transfer testing.'};
  }
  return {blocked:false,warning:'Supplier material guidance, equipment configuration, ventilation and a small test coupon are required before production.'};
}
export function normalizeSettingsJson(text) {
  const o=JSON.parse(String(text||'{}'));
  if (!o || typeof o!=='object' || Array.isArray(o)) throw new Error('Settings must be one JSON object.');
  if(JSON.stringify(o).length>9000)throw new Error('Settings are too large.');
  return o;
}
export function formatRecipeCSV(rows) {
  const cols=['machine_type','machine_model','operation','material_name','material_brand','material_sku','material_finish','thickness_mm','status','settings','source_type','source_url','safety_notes'];
  const q=x=>'"'+String(x??'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replace(/"/g,'""')+'"';
  return [cols.map(q).join(','),...rows.map(r=>cols.map(k=>q(k==='settings'?JSON.stringify(r[k]||{}):r[k])).join(','))].join('\r\n');
}


export const SETTING_FIELDS = {
  roland_bn2:[
    ['profile_selection','ICC media profile (model + ink set)'],['printing_mode','VersaWorks quality mode'],
    ['print_heater_c','Print heater setpoint (°C; 30–35)'],['dryer_c','Dryer setpoint (°C; 30–38)'],
    ['feed_calibration','Media feed calibration result'],['cut_force_gf','Cut force from physical test (gf)'],
    ['cut_speed_mm_s','Cut speed from physical test (mm/s)'],['cut_offset_mm','Blade offset (mm)'],
    ['post_print_handling','Ink dry/outgas and finishing instructions'],
    ['heat_press_temperature_f','Heat transfer temperature (°F)'],['heat_press_time_s','Heat transfer dwell (seconds)'],
    ['heat_press_pressure','Heat transfer pressure'],['heat_press_peel','Transfer mask peeling']
  ],
  mopa_fiber:[
    ['power_percent','Power (%)'],['speed_mm_s','Speed (mm/s)'],
    ['frequency_khz','Pulse frequency (kHz)'],['pulse_width_ns','Pulse width (ns)'],
    ['hatch_mm','Hatch spacing (mm)'],['passes','Pass count'],['lens_focal_mm','Lens focal length (mm)'],
    ['focus_offset_mm','Focus offset (mm)'],['line_angle_degrees','Hatch angle (degrees)']
  ],
  xtool_s1:[
    ['laser_module','Installed laser module'],['power_percent','Power (%)'],
    ['speed_mm_s','Speed (mm/s)'],['passes','Pass count'],
    ['lines_per_cm','Lines per cm'],['focus_offset_mm','Focus offset (mm)'],
    ['air_assist','Air assist setting'],['mode','Fill / line mode']
  ],
  xtool_p2:[
    ['power_percent','Power (%)'],['speed_mm_s','Speed (mm/s)'],
    ['passes','Pass count'],['focus_offset_mm','Focus offset (mm)'],
    ['lines_per_cm','Lines per cm'],['air_assist','Air assist setting'],
    ['bed_or_riser','Bed/riser configuration']
  ],
  xtool_omni:[
    ['studio_mode','xTool Studio machine / process mode'],['material_preset','Studio material selection'],
    ['rotary_modeling_shape','Rotary geometry / modeling mode'],['print_effect','Print effect: Flat / Texture / Relief'],
    ['ink_mode','Studio ink mode and order'],['white_ink_type','Rigid vs flexible white'],
    ['white_layers','White ink passes / layers'],['color_layers','Color ink passes / layers'],
    ['varnish_layers','Varnish passes'],['target_relief_mm','Target texture / relief height (mm)'],
    ['ink_white_mode','Legacy white mode'],['varnish','Varnish setting'],
    ['texture_smoothness','Texture smoothness'],['primer','Surface primer'],
    ['printed_height_mm','Measured printed height (mm)'],['cure_or_dry','Cure / dry notes']
  ],
  sawgrass_sg500:[
    ['ink_set','Installed Sawgrass ink set'],['print_manager','Sawgrass Print Utility version'],
    ['color_profile','Exact substrate/profile selection'],['print_quality','Print quality selection'],
    ['paper_brand','Sublimation paper brand/type'],['mirror_print','Image mirroring'],
    ['artwork_color_space','Artwork color space'],['design_notes','Press recipe ID and fabric/blank notes']
  ],
  heat_press:[
    ['temperature_f','Temperature (°F)'],['dwell_seconds','Press time (seconds)'],
    ['pressure','Pressure setting'],['peel','Hot / warm / cold peel'],
    ['prepress_seconds','Prepress time (seconds)'],['platen','Platen type'],
    ['cover_sheet','Cover sheet / carrier'],['postpress_seconds','Post-press seconds']
  ],
  sublimation_press:[
    ['temperature_f','Temperature (°F)'],['dwell_seconds','Press time (seconds)'],
    ['pressure','Pressure setting'],['substrate_coating','Substrate coating'],
    ['wrap_or_tape','Wrap / tape details'],['protective_paper','Protective paper'],
    ['platen','Press platen'],['peel_or_cool','Cool / release procedure']
  ],
};
