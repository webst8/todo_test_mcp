import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { createMcpHttpServer } from "../src/server.js";
import type { FetchLike } from "../src/todo.js";

const mockFetch: FetchLike = async (input) => {
  const id = Number(new URL(input.toString()).pathname.split("/").at(-1));
  if (id === 404) return new Response("{}", { status: 404 });
  return Response.json({
    userId: 1,
    id,
    title: "delectus aut autem",
    completed: false,
  });
};

const httpServer = createMcpHttpServer(mockFetch);
const client = new Client({ name: "automated-test-client", version: "1.0.0" });
let transport: StreamableHTTPClientTransport;

before(async () => {
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });
  const address = httpServer.address() as AddressInfo;
  transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${address.port}/mcp`),
  );
  await client.connect(transport);
});

after(async () => {
  await transport.close();
  await client.close();
  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
  });
});

test("ツール一覧には読み取り専用のget_todoだけがある", async () => {
  const result = await client.listTools();

  assert.deepEqual(
    result.tools.map((tool) => tool.name),
    ["get_todo"],
  );
  assert.equal(result.tools[0]?.annotations?.readOnlyHint, true);
  assert.equal(result.tools[0]?.annotations?.destructiveHint, false);
  assert.ok(result.tools[0]?.outputSchema);
});

test("get_todoは構造化JSONと説明文を返す", async () => {
  const result = await client.callTool({ name: "get_todo", arguments: { id: 1 } });

  assert.notEqual(result.isError, true);
  assert.deepEqual(result.structuredContent, {
    userId: 1,
    id: 1,
    title: "delectus aut autem",
    completed: false,
    sourceUrl: "https://jsonplaceholder.typicode.com/todos/1",
    isTestData: true,
    dataNotice: "JSONPlaceholderが提供するテスト用のダミーデータです。",
  });
  assert.match(JSON.stringify(result.content), /テスト用ダミーデータ/);
});

test("不正なidはMCPツールエラーになる", async () => {
  const result = await client.callTool({ name: "get_todo", arguments: { id: 0 } });

  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /idは1以上/);
});

test("存在しないTodoは成功結果を捏造しない", async () => {
  const result = await client.callTool({ name: "get_todo", arguments: { id: 404 } });

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.match(JSON.stringify(result.content), /NOT_FOUND/);
});
