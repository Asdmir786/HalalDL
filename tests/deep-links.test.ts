import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_DEEP_LINK_LENGTH,
  parseHalalDlDeepLink,
} from "../src/lib/deep-links.ts";

test("parses a safe download link and queues by default", () => {
  const parsed = parseHalalDlDeepLink(
    "halaldl://download?url=https%3A%2F%2Fexample.com%2Fwatch%3Fv%3D123&preset=audio",
  );

  assert.deepEqual(parsed, {
    action: "download",
    targetUrl: "https://example.com/watch?v=123",
    preset: "audio",
    advanced: false,
    startImmediately: false,
  });
});

test("requires an explicit flag before starting a download", () => {
  const parsed = parseHalalDlDeepLink(
    "halaldl://download?url=https%3A%2F%2Fexample.com%2Fvideo&start=start",
  );

  assert.equal(parsed?.action, "download");
  if (parsed?.action === "download") assert.equal(parsed.startImmediately, true);
});

test("accepts known app screens", () => {
  assert.deepEqual(parseHalalDlDeepLink("halaldl://open?screen=settings"), {
    action: "open",
    screen: "settings",
  });
});

test("rejects unsafe schemes, credentialed targets, and unknown actions", () => {
  const rejected = [
    "https://download?url=https%3A%2F%2Fexample.com",
    "halaldl://download?url=javascript%3Aalert(1)",
    "halaldl://download?url=file%3A%2F%2FC%3A%2FWindows%2Fwin.ini",
    "halaldl://download?url=https%3A%2F%2Fuser%3Apass%40example.com%2Fvideo",
    "halaldl://unknown?url=https%3A%2F%2Fexample.com",
  ];

  for (const value of rejected) assert.equal(parseHalalDlDeepLink(value), null);
});

test("rejects oversized deep links", () => {
  assert.equal(parseHalalDlDeepLink(`halaldl://open?value=${"a".repeat(MAX_DEEP_LINK_LENGTH)}`), null);
});
