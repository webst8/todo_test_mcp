import assert from "node:assert/strict";
import { test } from "node:test";

import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

import {
  config,
  createNetlifyMcpHandler,
} from "../netlify/functions/mcp.js";
import type { FetchLike } from "../src/todo.js";

const mockFetch: FetchLike = async (input) => {
  const id = Number(new URL(input.toString()).pathname.split("/").at(-1));
  if (id === 999) return new Response("{}", { status: 404 });
  return Response.json({
    userId: 1,
    id,
    title: "delectus aut autem",
    completed: false,
  });
};

const handler = createNetlifyMcpHandler(mockFetch);

async function sendRpc(body: unknown): Promise<{ response: Response; json: any }> {
  const response = await handler(
    new Request("https://example.netlify.app/mcp", {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
  return { response, json: await response.json() };
}

test("Netlify Functionは/mcpに公開される", () => {
  assert.equal(config.path, "/mcp");
  assert.equal(config.rateLimit?.windowLimit, 100);
});

test("GETを405で拒否する", async () => {
  const response = await handler(new Request("https://example.netlify.app/mcp"));

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.match(await response.text(), /Method not allowed/);
});

test("MCP初期化に成功する", async () => {
  const { response, json } = await sendRpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "netlify-function-test", version: "1.0.0" },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(json.result.serverInfo.name, "jsonplaceholder-todo-mcp");
});

test("ツール一覧は読み取り専用のget_todoだけ", async () => {
  const { response, json } = await sendRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    json.result.tools.map((tool: { name: string }) => tool.name),
    ["get_todo"],
  );
  assert.equal(json.result.tools[0].annotations.readOnlyHint, true);
  assert.equal(json.result.tools[0].annotations.destructiveHint, false);
});

test("get_todoが構造化データを返す", async () => {
  const { response, json } = await sendRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "get_todo", arguments: { id: 1 } },
  });

  assert.equal(response.status, 200);
  assert.equal(json.result.isError, undefined);
  assert.deepEqual(json.result.structuredContent, {
    userId: 1,
    id: 1,
    title: "delectus aut autem",
    completed: false,
    sourceUrl: "https://jsonplaceholder.typicode.com/todos/1",
    isTestData: true,
    dataNotice: "JSONPlaceholderが提供するテスト用のダミーデータです。",
  });
});

test("不正なidと存在しないTodoを成功扱いしない", async () => {
  const invalid = await sendRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "get_todo", arguments: { id: 0 } },
  });
  assert.equal(invalid.json.result.isError, true);
  assert.match(JSON.stringify(invalid.json.result.content), /idは1以上/);

  const missing = await sendRpc({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "get_todo", arguments: { id: 999 } },
  });
  assert.equal(missing.json.result.isError, true);
  assert.match(JSON.stringify(missing.json.result.content), /NOT_FOUND/);
});
