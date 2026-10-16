import crypto from "node:crypto";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { authorizeEmployee, jsonResponse } from "./_shared/security.js";
import {
  cleanObjectName,
  presignedR2Put,
  r2BucketName,
  r2Client,
  signedStoredAssetUrl,
} from "./_shared/mockupStorage.js";
const allowed = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return jsonResponse(204, {}, event);
  if (event.httpMethod !== "POST")
    return jsonResponse(405, { message: "Method not allowed." }, event);
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { message: "Invalid request." }, event);
  }
  const auth = await authorizeEmployee(event, {
    functionName: "marketing-assets",
    allowedRoles:
      body.action === "download"
        ? ["admin", "manager", "operator", "viewer", "marketing"]
        : ["admin", "manager", "operator", "marketing"],
  });
  if (!auth.ok)
    return jsonResponse(auth.statusCode, { message: auth.message }, event);
  try {
    const result = await auth.supabase
      .from("sc_growth_materials")
      .select("*")
      .eq("id", body.id)
      .single();
    if (result.error) throw result.error;
    const row = result.data;
    if (row.archived_at)
      throw Error("Restore this material before accessing its file.");
    if (body.action === "download") {
      if (
        !row.upload_complete ||
        !row.storage_path?.startsWith("marketing/" + row.id + "/")
      )
        throw Error("No verified file is available.");
      return jsonResponse(
        200,
        {
          url: await signedStoredAssetUrl(
            auth.supabase,
            {
              storage_provider: "r2",
              storage_bucket: r2BucketName(),
              storage_path: row.storage_path,
            },
            300,
          ),
        },
        event,
      );
    }
    if (row.status !== "draft")
      throw Error("Create a new revision before changing an approved file.");
    if (body.action === "create_upload") {
      const size = Number(body.file_size),
        type = String(body.content_type || "");
      if (
        !Number.isSafeInteger(size) ||
        size < 1 ||
        size > 26214400 ||
        !allowed.has(type)
      )
        throw Error(
          "Use a PDF, PNG, JPEG, WebP, text, Word or PowerPoint file up to 25 MB.",
        );
      const path =
        "marketing/" +
        row.id +
        "/" +
        crypto.randomUUID() +
        "-" +
        cleanObjectName(body.filename, "material");
      const uploadUrl = await presignedR2Put({ key: path, contentType: type });
      const saved = await auth.supabase
        .from("sc_growth_materials")
        .update({
          storage_path: path,
          file_name: String(body.filename || "material").slice(0, 200),
          mime_type: type,
          file_size: size,
          upload_complete: false,
        })
        .eq("id", row.id)
        .eq("updated_at", row.updated_at)
        .select("id")
        .single();
      if (saved.error)
        throw Error("The material changed. Refresh before uploading.");
      return jsonResponse(
        200,
        {
          upload_url: uploadUrl,
          content_type: type,
        },
        event,
      );
    }
    if (body.action === "complete_upload") {
      if (!row.storage_path?.startsWith("marketing/" + row.id + "/"))
        throw Error("Start a file upload first.");
      const head = await r2Client().send(
        new HeadObjectCommand({
          Bucket: r2BucketName(),
          Key: row.storage_path,
        }),
      );
      if (
        Number(head.ContentLength) !== Number(row.file_size) ||
        head.ContentType !== row.mime_type
      )
        throw Error(
          "The uploaded file did not match its declared size or type.",
        );
      const saved = await auth.supabase
        .from("sc_growth_materials")
        .update({ upload_complete: true })
        .eq("id", row.id)
        .eq("storage_path", row.storage_path)
        .eq("updated_at", row.updated_at)
        .select("id")
        .single();
      if (saved.error)
        throw Error("The material changed. Refresh before verifying.");
      return jsonResponse(200, { success: true }, event);
    }
    return jsonResponse(400, { message: "Unknown material action." }, event);
  } catch (error) {
    return jsonResponse(
      400,
      { message: error.message || "Material file request failed." },
      event,
    );
  }
}
