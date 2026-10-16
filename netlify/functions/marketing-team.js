import {
  authorizeEmployee,
  jsonResponse,
  auditFunctionSecurity,
} from "./_shared/security.js";
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return jsonResponse(204, {}, event);
  if (!["GET", "POST"].includes(event.httpMethod))
    return jsonResponse(405, { message: "Method not allowed." }, event);
  const auth = await authorizeEmployee(event, {
    functionName: "marketing-team",
    allowedRoles: ["admin"],
  });
  if (!auth.ok)
    return jsonResponse(auth.statusCode, { message: auth.message }, event);
  try {
    if (event.httpMethod === "GET") {
      const page = Math.max(
        1,
        Math.min(1000, Number(event.queryStringParameters?.page) || 1),
      );
      const users = await auth.supabase.auth.admin.listUsers({
        page,
        perPage: 50,
      });
      if (users.error) throw users.error;
      const ids = users.data.users.map((u) => u.id);
      const roles = ids.length
        ? await auth.supabase
            .from("sc_app_user_roles")
            .select("user_id,role,is_active,updated_at")
            .in("user_id", ids)
        : { data: [] };
      if (roles.error) throw roles.error;
      return jsonResponse(
        200,
        {
          users: users.data.users.map((u) => ({
            id: u.id,
            email: u.email,
            role: roles.data.find((r) => r.user_id === u.id) || null,
          })),
          page,
          has_more: users.data.users.length === 50,
        },
        event,
      );
    }
    const body = JSON.parse(event.body || "{}");
    if (
      !["assign_marketing", "deactivate_marketing"].includes(body.action) ||
      !body.user_id
    )
      throw Error("Choose a registered employee and an access action.");
    if (body.user_id === auth.user.id)
      throw Error("Use a different administrator to change your own access.");
    const user = await auth.supabase.auth.admin.getUserById(body.user_id);
    if (user.error || !user.data.user)
      throw Error("This registered employee no longer exists.");
    const current = await auth.supabase
      .from("sc_app_user_roles")
      .select("role,is_active,updated_at")
      .eq("user_id", body.user_id)
      .maybeSingle();
    if (current.error) throw current.error;
    if (["admin", "manager"].includes(current.data?.role))
      throw Error(
        "Administrator and manager roles must be managed through the main employee access process.",
      );
    if (
      (current.data?.updated_at || null) !== (body.expected_updated_at || null)
    )
      throw Error("Employee access changed. Refresh before updating it.");
    if (
      body.action === "deactivate_marketing" &&
      current.data?.role !== "marketing"
    )
      throw Error("Only Marketing access can be deactivated here.");
    const patch = {
      role: "marketing",
      is_active: body.action === "assign_marketing",
      updated_at: new Date().toISOString(),
    };
    let save = auth.supabase.from("sc_app_user_roles");
    save = current.data
      ? save
          .update(patch)
          .eq("user_id", body.user_id)
          .eq("updated_at", current.data.updated_at)
      : save.insert({ user_id: body.user_id, ...patch });
    const result = await save.select("user_id").single();
    if (result.error)
      throw Error("Employee access could not be updated. Refresh and retry.");
    await auditFunctionSecurity({
      functionName: "marketing-team",
      action: body.action,
      outcome: "completed",
      userId: auth.user.id,
      role: auth.role,
      event,
      metadata: { target_user_id: body.user_id },
    });
    return jsonResponse(200, { success: true }, event);
  } catch (error) {
    return jsonResponse(
      400,
      { message: error.message || "Employee access request failed." },
      event,
    );
  }
}
