import assert from "node:assert/strict";
import test from "node:test";

test("API write security - reject unauthenticated write requests", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `write-auth-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  // Request write endpoint without authentication headers
  const response = await worker.fetch(
    new Request("http://localhost/api/studio/works", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Test Work" }),
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} }
  );

  assert.equal(response.status, 401);
  const data = await response.json();
  assert.equal(typeof data.error, "string");
});

test("API write security - reject unauthorized user email", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `write-unauth-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  // Request write endpoint with non-admin email
  const response = await worker.fetch(
    new Request("http://localhost/api/studio/works", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-email": "unauthorized_user@example.com",
      },
      body: JSON.stringify({ title: "Test Work" }),
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} }
  );

  assert.equal(response.status, 403);
  const data = await response.json();
  assert.equal(typeof data.error, "string");
});

test("API write security - reject cross-origin write requests", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `write-cors-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  // Request write endpoint with malicious origin header
  const response = await worker.fetch(
    new Request("http://localhost/api/studio/works", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-email": "admin@example.com",
        origin: "http://malicious-attacker.com",
      },
      body: JSON.stringify({ title: "Test Work" }),
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} }
  );

  assert.equal(response.status, 403);
  const data = await response.json();
  assert.equal(data.error, "Invalid request origin.");
});
