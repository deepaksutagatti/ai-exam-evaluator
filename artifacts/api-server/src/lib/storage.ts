import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MAX_UPLOAD_BYTES = 30_000_000;
const DEFAULT_BUCKET = "exam-files";

function getStorageClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function objectIdFromPath(objectPath: string): string {
  const prefix = "/objects/";
  if (!objectPath.startsWith(prefix)) {
    throw new Error("Invalid object path.");
  }
  const objectId = objectPath.slice(prefix.length);
  if (!objectId || objectId.includes("/") || objectId.includes("\\")) {
    throw new Error("Invalid object path.");
  }
  return objectId;
}

function bucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
}

function storageObjectName(objectId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(objectId)) {
    throw new Error("Invalid object identifier.");
  }
  return `documents/${objectId}`;
}

let bucketReady: Promise<void> | null = null;

async function ensureBucket(client: SupabaseClient) {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const bucket = bucketName();
    const existing = await client.storage.getBucket(bucket);
    if (existing.data) return;
    const created = await client.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: MAX_UPLOAD_BYTES,
      allowedMimeTypes: ["application/pdf"],
    });
    if (created.error && !/already exists|duplicate/i.test(created.error.message)) {
      throw new Error(`Could not create Supabase Storage bucket: ${created.error.message}`);
    }
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

export async function requestObjectUpload(): Promise<{
  uploadURL: string;
  objectPath: string;
  uploadId: string;
}> {
  const uploadId = randomUUID();
  return {
    uploadURL: `/api/storage/uploads/${uploadId}`,
    objectPath: `/objects/${uploadId}`,
    uploadId,
  };
}

export async function saveUploadedObject(
  uploadId: string,
  bytes: Uint8Array,
  contentType = "application/pdf",
): Promise<void> {
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Uploaded file is empty or exceeds the 30 MB limit.");
  }
  const client = getStorageClient();
  await ensureBucket(client);
  const { error } = await client.storage
    .from(bucketName())
    .upload(storageObjectName(uploadId), bytes, {
      contentType,
      upsert: false,
    });
  if (error) {
    throw new Error(`Could not save the uploaded file to Supabase Storage: ${error.message}`);
  }
}

export async function uploadObjectBytes(
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const uploadId = randomUUID();
  await saveUploadedObject(uploadId, bytes, contentType);
  return `/objects/${uploadId}`;
}

export async function readObject(objectPath: string): Promise<Buffer> {
  const client = getStorageClient();
  await ensureBucket(client);
  const { data, error } = await client.storage
    .from(bucketName())
    .download(storageObjectName(objectIdFromPath(objectPath)));
  if (error) {
    if (/not found|does not exist/i.test(error.message)) {
      const notFound = new Error("Object not found.");
      notFound.name = "ObjectNotFoundError";
      throw notFound;
    }
    throw new Error(`Could not read the file from Supabase Storage: ${error.message}`);
  }
  return Buffer.from(await data.arrayBuffer());
}