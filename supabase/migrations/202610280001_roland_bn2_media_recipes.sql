-- Additive: extend the existing equipment recipe library to the Roland BN2-30.
-- Existing records, RLS policies, trial workflow and approval RPC are unchanged.
alter table public.sc_material_recipes
  drop constraint if exists sc_material_recipes_machine_type_check;
alter table public.sc_material_recipes
  add constraint sc_material_recipes_machine_type_check check
  (machine_type in ('mopa_fiber','xtool_s1','xtool_p2','xtool_omni','heat_press','sublimation_press','roland_bn2'));
alter table public.sc_material_recipes
  drop constraint if exists sc_material_recipes_operation_check;
alter table public.sc_material_recipes
  add constraint sc_material_recipes_operation_check check
  (operation in ('color_engrave','etch','score','cut','engrave','uv_flat','uv_texture','uv_relief','uv_varnish','heat_transfer','sublimation','print_only','print_cut'));
-- No seeding approved records: the eight sourced guides are always visible in the
-- client app, and new machine recipes are explicitly operator-created drafts.
