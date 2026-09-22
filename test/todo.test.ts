import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fetchTodo,
  getTodoInputSchema,
  TodoFetchError,
  type FetchLike,
} from "../src/todo.js";

test("idは1以上の整数だけを受け付ける", () => {
  assert.equal(getTodoInputSchema.safeParse({ id: 1 }).success, true);
  assert.equal(getTodoInputSchema.safeParse({ id: 1.5 }).success, false);
  assert.equal(getTodoInputSchema.safeParse({ id: 0 }).success, false);
  assert.equal(getTodoInputSchema.safeParse({ id: "1" }).success, false);
});

test("不正なidでは外部APIを呼ばない", async () => {
  let called = false;
  const mockFetch: FetchLike = async () => {
    called = true;
    return new Response();
  };

  await assert.rejects(
    () => fetchTodo(0, mockFetch),
    (error: unknown) => error instanceof TodoFetchError && error.code === "INVALID_ID",
  );
  assert.equal(called, false);
});

test("Todoを取得し、出典とダミーデータ表示を付ける", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  const mockFetch: FetchLike = async (input, init) => {
    requestedUrl = input.toString();
    requestedMethod = init?.method ?? "";
    return Response.json({
      userId: 1,
      id: 1,
      title: "delectus aut autem",
      completed: false,
    });
  };

  const result = await fetchTodo(1, mockFetch);

  assert.equal(requestedUrl, "https://jsonplaceholder.typicode.com/todos/1");
  assert.equal(requestedMethod, "GET");
  assert.deepEqual(result, {
    userId: 1,
    id: 1,
    title: "delectus aut autem",
    completed: false,
    sourceUrl: "https://jsonplaceholder.typicode.com/todos/1",
    isTestData: true,
    dataNotice: "JSONPlaceholderが提供するテスト用のダミーデータです。",
  });
});

test("404を対象データなしとして扱う", async () => {
  const mockFetch: FetchLike = async () => new Response("{}", { status: 404 });

  await assert.rejects(
    () => fetchTodo(999, mockFetch),
    (error: unknown) => error instanceof TodoFetchError && error.code === "NOT_FOUND",
  );
});

test("上流APIのエラーを成功扱いにしない", async () => {
  const mockFetch: FetchLike = async () =>
    new Response("server error", { status: 503 });

  await assert.rejects(
    () => fetchTodo(1, mockFetch),
    (error: unknown) =>
      error instanceof TodoFetchError &&
      error.code === "UPSTREAM_ERROR" &&
      error.status === 503,
  );
});

test("通信失敗をNETWORK_ERRORとして扱う", async () => {
  const mockFetch: FetchLike = async () => {
    throw new TypeError("network down");
  };

  await assert.rejects(
    () => fetchTodo(1, mockFetch),
    (error: unknown) => error instanceof TodoFetchError && error.code === "NETWORK_ERROR",
  );
});

test("想定外のレスポンス形式を拒否する", async () => {
  const mockFetch: FetchLike = async () => Response.json({ id: 1 });

  await assert.rejects(
    () => fetchTodo(1, mockFetch),
    (error: unknown) =>
      error instanceof TodoFetchError && error.code === "INVALID_RESPONSE",
  );
});

test("要求した番号と異なるTodoを拒否する", async () => {
  const mockFetch: FetchLike = async () =>
    Response.json({
      userId: 1,
      id: 2,
      title: "wrong todo",
      completed: false,
    });

  await assert.rejects(
    () => fetchTodo(1, mockFetch),
    (error: unknown) =>
      error instanceof TodoFetchError && error.code === "INVALID_RESPONSE",
  );
});
