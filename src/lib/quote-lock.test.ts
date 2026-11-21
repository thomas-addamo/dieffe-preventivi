// Test del blocco dei preventivi (B1): `pnpm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canRequestUnlock, canUnlock, lockInfo, lockReason } from "./quote-lock";

const q = (status: string, extra: Record<string, unknown> = {}) => ({ status, isLocked: false, ...extra });

test("bozza e accettato con lavori in corso: modificabili", () => {
  assert.equal(lockReason(q("draft")), null);
  assert.equal(lockReason(q("accepted")), null);
  assert.equal(lockReason(q("archived")), null);
});

test("blocchi automatici per stato", () => {
  assert.equal(lockReason(q("sent")), "sent");
  assert.equal(lockReason(q("rejected")), "rejected");
  assert.equal(lockReason(q("accepted", { worksCompletedAt: "2026-11-21" })), "completed");
});

test("il blocco dell'admin vince su tutto, anche sullo sblocco automatico", () => {
  assert.equal(lockReason(q("draft", { isLocked: true })), "admin");
  assert.equal(lockReason(q("sent", { isLocked: true, lockOverrideAt: "2026-11-21" })), "admin");
});

test("lo sblocco manuale toglie il blocco automatico", () => {
  assert.equal(lockReason(q("sent", { lockOverrideAt: new Date() })), null);
  assert.equal(lockReason(q("rejected", { lockOverrideAt: new Date() })), null);
});

test("chi può sbloccare e chi deve chiedere", () => {
  assert.ok(canUnlock("sent", "editor"));
  assert.ok(!canUnlock("sent", "viewer"));
  for (const r of ["admin", "completed", "rejected"] as const) {
    assert.ok(canUnlock(r, "admin"), r);
    assert.ok(!canUnlock(r, "editor"), r);
    assert.ok(canRequestUnlock(r, "editor"), r);
    assert.ok(!canRequestUnlock(r, "admin"), r);
    assert.ok(!canRequestUnlock(r, "viewer"), r);
  }
  assert.ok(!canRequestUnlock("sent", "editor"));
  assert.ok(!canRequestUnlock(null, "editor"));
});

test("riblocca solo dopo uno sblocco manuale di un blocco automatico", () => {
  assert.ok(lockInfo(q("sent", { lockOverrideAt: new Date() }), "editor").canRelock);
  assert.ok(!lockInfo(q("draft", { lockOverrideAt: new Date() }), "editor").canRelock);
  assert.ok(!lockInfo(q("sent"), "editor").canRelock);
});
