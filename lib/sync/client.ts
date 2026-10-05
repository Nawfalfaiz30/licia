"use client";

import { createClient } from "@/lib/supabase/client";
import { enqueueMutation, getDeviceId, type SyncEntityType, type SyncOperation } from "@/lib/pwa/offlineQueue";

type SyncOptions = {
  entityType: SyncEntityType;
  operation: SyncOperation;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  baseVersion?: number | null;
  clientUpdatedAt?: string | null;
  conflictStrategy?: "server" | "latest" | "manual" | "smart";
  offlineOk?: boolean;
};

export type SyncMutationResult = {
  ok: boolean;
  queued?: boolean;
  replayed?: boolean;
  conflict?: boolean;
  conflictId?: string | null;
  error?: string;
  response?: { entityId?: string | null; record?: Record<string, unknown> | null; deleted?: boolean; [key: string]: unknown } | null;
};

const DEFAULT_STRATEGY: SyncMutationResult["response"] = null;

export async function mutateEntity(options: SyncOptions): Promise<SyncMutationResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Belum masuk." };

  const payload = options.payload || {};
  const deviceId = getDeviceId();
  const generatedEntityId = options.operation === "create" && !options.entityId ? crypto.randomUUID() : undefined;
  const entityId = options.entityId || generatedEntityId;
  const body = {
    mutationId: crypto.randomUUID(),
    deviceId,
    entityType: options.entityType,
    operation: options.operation,
    entityId: entityId || undefined,
    baseVersion: options.baseVersion ?? null,
    clientUpdatedAt: options.clientUpdatedAt || new Date().toISOString(),
    payload,
    conflictStrategy: options.conflictStrategy || readConflictStrategy(),
  };

  if (!navigator.onLine && options.offlineOk !== false) {
    const queued = await enqueueMutation({
      userId: user.id,
      deviceId,
      entityType: options.entityType,
      operation: options.operation,
      entityId: entityId || undefined,
      baseVersion: options.baseVersion ?? null,
      clientUpdatedAt: body.clientUpdatedAt,
      conflictStrategy: body.conflictStrategy,
      payload,
    });
    if (!queued) return { ok: false, error: "Antrean offline penuh." };
    return { ok: true, queued: true, response: { entityId, record: { id: entityId, ...payload } } };
  }

  try {
    const response = await fetch("/api/sync/mutation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok || data?.replayed) {
      window.dispatchEvent(new CustomEvent("licia:sync-request"));
      return data as SyncMutationResult;
    }
    if (response.status === 409 && data?.conflict) {
      window.dispatchEvent(new CustomEvent("licia:sync-conflict", { detail: data }));
      return data as SyncMutationResult;
    }
    return { ok: false, error: String(data?.error || "Perubahan gagal disimpan.") };
  } catch (error) {
    if (options.offlineOk !== false) {
      const queued = await enqueueMutation({
        userId: user.id,
        deviceId,
        entityType: options.entityType,
        operation: options.operation,
        entityId: entityId || undefined,
        baseVersion: options.baseVersion ?? null,
        clientUpdatedAt: body.clientUpdatedAt,
        conflictStrategy: body.conflictStrategy,
        payload,
      });
      if (queued) return { ok: true, queued: true, response: { entityId, record: { id: entityId, ...payload } } };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Jaringan tidak tersedia." };
  }
}

function readConflictStrategy(): "server" | "latest" | "manual" | "smart" {
  try {
    const value = localStorage.getItem("licia-conflict-strategy");
    return value === "latest" || value === "manual" || value === "smart" ? value : "server";
  } catch {
    return "server";
  }
}
