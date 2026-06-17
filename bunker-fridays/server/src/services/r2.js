// Cloudflare R2 presigned uploads (§2). Full-resolution photos; the prototype's
// 320px compression was a storage workaround and is intentionally NOT carried forward.
// AWS SigV4 query presign, no SDK dependency. R2 region is always "auto".
import { createHash, createHmac } from "crypto";
import { config } from "../config.js";
import { uid } from "../db.js";

const sha256hex = (s) => createHash("sha256").update(s).digest("hex");
const hmac = (key, s) => createHmac("sha256", key).update(s).digest();

export const r2Enabled = () => !!(config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey);

/** Presigned PUT for a photo. Returns { uploadUrl, publicUrl, key }. */
export function presignPhotoUpload(artistId, contentType = "image/jpeg") {
  const { accountId, accessKeyId, secretAccessKey, bucket, publicBase } = config.r2;
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[contentType] || "jpg";
  const key = `artists/${artistId}/${uid()}.${ext}`;

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto", service = "s3";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "600",
    "X-Amz-SignedHeaders": "host",
  });
  // Canonical query string must be sorted
  const canonicalQuery = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = ["PUT", canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256hex(canonicalRequest)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac("AWS4" + secretAccessKey, dateStamp), region), service), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const uploadUrl = `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  const publicUrl = publicBase ? `${publicBase}/${key}` : uploadUrl.split("?")[0];
  return { uploadUrl, publicUrl, key };
}
