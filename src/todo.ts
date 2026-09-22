import { z } from "zod";

const JSONPLACEHOLDER_TODOS_URL = "https://jsonplaceholder.typicode.com/todos";

export const todoIdSchema = z
  .number({
    invalid_type_error: "idは数値で指定してください。",
    required_error: "idは必須です。",
  })
  .int("idは整数で指定してください。")
  .min(1, "idは1以上で指定してください。");

export const getTodoInputSchema = z.object({
  id: todoIdSchema.describe("取得するTodo番号（1以上の整数）"),
});

const upstreamTodoSchema = z.object({
  userId: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string().min(1),
  completed: z.boolean(),
});

export const getTodoOutputSchema = z.object({
  userId: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string(),
  completed: z.boolean(),
  sourceUrl: z.string().url(),
  isTestData: z.literal(true),
  dataNotice: z.string(),
});

export type GetTodoOutput = z.infer<typeof getTodoOutputSchema>;

export type TodoErrorCode =
  | "INVALID_ID"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export class TodoFetchError extends Error {
  constructor(
    public readonly code: TodoErrorCode,
    message: string,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TodoFetchError";
  }
}

export type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export async function fetchTodo(
  id: number,
  fetchImpl: FetchLike = fetch,
): Promise<GetTodoOutput> {
  const validation = todoIdSchema.safeParse(id);
  if (!validation.success) {
    throw new TodoFetchError(
      "INVALID_ID",
      validation.error.issues[0]?.message ?? "idは1以上の整数で指定してください。",
    );
  }

  const sourceUrl = `${JSONPLACEHOLDER_TODOS_URL}/${validation.data}`;
  let response: Response;

  try {
    response = await fetchImpl(sourceUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new TodoFetchError(
      "NETWORK_ERROR",
      `JSONPlaceholderとの通信に失敗しました: ${detail}`,
      undefined,
      { cause: error },
    );
  }

  if (response.status === 404) {
    throw new TodoFetchError(
      "NOT_FOUND",
      `Todo番号${validation.data}は見つかりませんでした。`,
      response.status,
    );
  }

  if (!response.ok) {
    throw new TodoFetchError(
      "UPSTREAM_ERROR",
      `JSONPlaceholderがHTTP ${response.status}を返しました。`,
      response.status,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new TodoFetchError(
      "INVALID_RESPONSE",
      "JSONPlaceholderの応答をJSONとして読み取れませんでした。",
      response.status,
      { cause: error },
    );
  }

  const parsed = upstreamTodoSchema.safeParse(body);
  if (!parsed.success || parsed.data.id !== validation.data) {
    throw new TodoFetchError(
      "INVALID_RESPONSE",
      "JSONPlaceholderの応答が想定したTodo形式ではありません。",
      response.status,
    );
  }

  return {
    ...parsed.data,
    sourceUrl,
    isTestData: true,
    dataNotice: "JSONPlaceholderが提供するテスト用のダミーデータです。",
  };
}
