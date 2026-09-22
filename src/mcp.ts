import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  fetchTodo,
  getTodoInputSchema,
  getTodoOutputSchema,
  TodoFetchError,
  type FetchLike,
} from "./todo.js";

export const MCP_SERVER_NAME = "jsonplaceholder-todo-mcp";

export function createMcpServer(fetchImpl: FetchLike = fetch): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: "1.0.0",
  });

  server.registerTool(
    "get_todo",
    {
      title: "JSONPlaceholderのTodoを取得",
      description:
        "指定されたTodo番号を使って、JSONPlaceholderからテスト用Todoデータを取得する読み取り専用ツール。データの作成・更新・削除は行いません。",
      inputSchema: getTodoInputSchema,
      outputSchema: getTodoOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id }) => {
      try {
        const todo = await fetchTodo(id, fetchImpl);
        return {
          structuredContent: todo,
          content: [
            {
              type: "text",
              text: `Todo番号${todo.id}: ${todo.title}（${
                todo.completed ? "完了" : "未完了"
              }）。これはJSONPlaceholderのテスト用ダミーデータです。`,
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof TodoFetchError
            ? `[${error.code}] ${error.message}`
            : "Todoの取得中に予期しないエラーが発生しました。";

        return {
          isError: true,
          content: [{ type: "text", text: message }],
        };
      }
    },
  );

  return server;
}
