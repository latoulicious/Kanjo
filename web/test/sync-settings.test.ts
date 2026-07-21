// autoSyncDue is pure: URL presence alone decides whether launch sync fires.
import { test } from "node:test"
import assert from "node:assert/strict"
import { autoSyncDue } from "../src/lib/sync-settings.ts"

test("autoSyncDue is false when url is empty", () => {
  assert.equal(autoSyncDue({ url: "", token: "", last: null }), false)
})

test("autoSyncDue is true when url is set", () => {
  assert.equal(autoSyncDue({ url: "https://kanjo.example.com", token: "", last: null }), true)
})
