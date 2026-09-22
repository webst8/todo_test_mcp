# JSONPlaceholder Todo MCP Server

JSONPlaceholderに登録されているテスト用Todoを、Todo番号で読み取るMCPサーバーです。

- MCPサーバー名: `jsonplaceholder-todo-mcp`
- MCPエンドポイント: `http://localhost:3000/mcp`
- Transport: Streamable HTTP（ステートレス）
- ツール: 読み取り専用の`get_todo`のみ
- Todoの作成・更新・削除、認証、データベースはありません

成功時は、MCPの構造化JSONデータ（`structuredContent`）と、人が読める短い日本語説明の両方を返します。JSONPlaceholderのデータがテスト用ダミーデータであることも明記します。

## 1. 必要な環境

- Node.js 22系
- npm
- インターネット接続（npmパッケージとJSONPlaceholderへのアクセスに使用）

最新のMCP Inspector v2も使う場合は、Inspector側の要件に合わせて**Node.js 22.19.0以上**を使用してください。`.nvmrc`にはNetlifyのビルドと同じNode.js 22系を指定しています。

バージョンは次のコマンドで確認できます。

```bash
node --version
npm --version
```

## 2. パッケージのインストール

このREADMEがあるフォルダで次を実行します。

```bash
npm install
```

APIキーや`.env`ファイルは不要です。

## 3. MCPサーバーの起動

開発中は次のコマンドを使います。ソースコードを変更すると自動で再起動します。

```bash
npm run dev
```

次の表示が出れば起動成功です。

```text
JSONPlaceholder Todo MCP server: http://localhost:3000/mcp
```

ビルド済みのJavaScriptを起動する場合は、先にビルドしてから起動します。

```bash
npm run build
npm start
```

サーバーは安全のため`127.0.0.1`だけで待ち受けます。外部には公開されません。

## 4. MCP Inspectorの起動

サーバーを起動したターミナルはそのままにして、別のターミナルを開きます。

次のコマンドでブラウザ版MCP Inspectorを起動できます。

```bash
npx @modelcontextprotocol/inspector
```

初回はInspectorのダウンロード確認が表示されることがあります。画面が自動で開かない場合は、ターミナルに表示されたURLをブラウザで開いてください。

最初から接続先を渡す場合は、次のコマンドも使用できます。

```bash
npx @modelcontextprotocol/inspector --server-url http://localhost:3000/mcp --transport http
```

## 5. Inspectorから接続する

Inspectorの接続画面で次のように設定します。

1. Transportとして**Streamable HTTP**を選びます。古い`SSE`は選びません。
2. 接続先URLに`http://localhost:3000/mcp`を入力します。
3. `Connect`を押します。
4. `Tools`画面でツール一覧を読み込みます。

表示されるツールは`get_todo`の1つだけです。ツール情報には`readOnlyHint: true`が含まれます。

## 6. Todo番号1を取得する

Inspectorの`Tools`画面で`get_todo`を選び、入力欄に次の値を指定して実行します。

```json
{
  "id": 1
}
```

成功時は次のような構造化データが返ります。

```json
{
  "userId": 1,
  "id": 1,
  "title": "delectus aut autem",
  "completed": false,
  "sourceUrl": "https://jsonplaceholder.typicode.com/todos/1",
  "isTestData": true,
  "dataNotice": "JSONPlaceholderが提供するテスト用のダミーデータです。"
}
```

InspectorのCLIでも確認できます。

```bash
npx @modelcontextprotocol/inspector --cli \
  --server-url http://localhost:3000/mcp \
  --transport http \
  --method tools/list \
  --format json
```

```bash
npx @modelcontextprotocol/inspector --cli \
  --server-url http://localhost:3000/mcp \
  --transport http \
  --method tools/call \
  --tool-name get_todo \
  --tool-args-json '{"id":1}' \
  --format json
```

## 7. テストとビルド

自動テストを実行します。

```bash
npm test
```

テストには次の内容が含まれます。

- `id`が1以上の整数かどうかの検証
- 不正な`id`では外部APIを呼ばないこと
- Todo取得成功、404、上流エラー、通信失敗、不正な応答形式
- Streamable HTTPのMCP初期化とツール一覧取得
- `get_todo`の成功・入力エラー・データなしエラー
- ツール一覧が`get_todo`だけであること
- `readOnlyHint: true`がクライアントへ公開されること

TypeScriptをビルドします。

```bash
npm run build
```

## 8. サーバーとInspectorの終了

サーバーを実行しているターミナルで`Ctrl+C`を押します。

Inspectorを実行しているターミナルでも`Ctrl+C`を押します。ブラウザのInspector画面も閉じて構いません。

## 9. よくあるエラーと対処方法

### `ECONNREFUSED`または接続できない

- 先に`npm run dev`または`npm start`でサーバーを起動してください。
- URLが`http://localhost:3000/mcp`になっているか確認してください。
- Inspectorで`Streamable HTTP`を選んでください。

### `EADDRINUSE: address already in use 127.0.0.1:3000`

ポート3000を別のプログラムが使用しています。以前起動したサーバーが残っていないか確認し、そのターミナルで`Ctrl+C`を押してから再実行してください。

### Inspectorを起動できない

- `node --version`でNode.jsのバージョンを確認してください。
- 最新のInspector v2にはNode.js 22.19.0以上が必要です。
- npmへ接続できるネットワークか確認してください。

### `idは整数で指定してください`または`idは1以上で指定してください`

`id`には`1`のような1以上の整数を指定します。`0`、負数、小数、文字列の`"1"`は受け付けません。不正な入力はJSONPlaceholderへ送信されません。

### `[NOT_FOUND] Todo番号...は見つかりませんでした`

JSONPlaceholderにそのTodo番号がありません。別の正の整数を試してください。

### `[NETWORK_ERROR]`または`[UPSTREAM_ERROR]`

インターネット接続、プロキシ、ファイアウォールを確認してください。JSONPlaceholder側の一時的な障害でも発生します。このサーバーは、外部APIの失敗時に成功したようなダミー結果を作りません。

### `Forbidden: local Host header required.`

このローカル版はDNSリバインディング対策として、`localhost`、`127.0.0.1`、`::1`以外のHostを拒否します。`http://localhost:3000/mcp`を使用してください。

## 主なファイル

```text
src/
  server.ts   Node.jsのHTTPサーバーとStreamable HTTPエンドポイント
  mcp.ts      MCPサーバーとget_todoツールの登録
  todo.ts     入力検証とJSONPlaceholder取得処理
test/
  mcp.test.ts               MCPクライアントからの接続テスト
  netlify-function.test.ts  Netlify Functionハンドラーのテスト
  todo.test.ts              入力検証と取得処理の単体テスト
netlify/functions/
  mcp.ts      Netlifyで/mcpを公開するステートレスFunction
public/
  index.html  稼働確認用のトップページ
netlify.toml  Netlifyのビルド・Functions・ローカル開発設定
```

## Netlify Functions版をローカルで起動する

通常のローカル版は`npm run dev`で起動し、`http://localhost:3000/mcp`を使います。Netlifyで動かすFunctionと同じ経路を確認する場合は、次を実行します。

```bash
npm run dev:netlify
```

Netlify Devの既定URLは次のとおりです。

```text
http://localhost:8888/mcp
```

Netlify用のビルドだけを確認する場合は次を実行します。

```bash
npm run build:netlify
```

MCP InspectorでNetlify Devへ接続する場合は、Transportに`Streamable HTTP`、URLに`http://localhost:8888/mcp`を指定します。

## GitHubへ登録する

GitHubリポジトリのルートは、この`jsonplaceholder-todo-mcp`フォルダにします。`package.json`、`package-lock.json`、`netlify.toml`、`src`、`netlify`、`public`、`test`を登録してください。

次のファイル・フォルダは`.gitignore`によって登録対象外になります。

```text
node_modules/
dist/
.netlify/
.env
.env.*
```

`.env.example`は必要になった場合に登録できます。現在のJSONPlaceholder版にAPIキーはありません。

## GitHubからNetlifyへ自動デプロイする

1. このプロジェクトをGitHubリポジトリのルートへpushします。
2. Netlifyで`Add new project`または`Import from Git`を開きます。
3. GitHubと対象リポジトリを選びます。
4. `netlify.toml`が自動で読み込まれることを確認します。
5. 必要な場合はBuild commandを`npm run build`、Publish directoryを`public`にします。Functions directoryは`netlify/functions`です。
6. デプロイ後、トップページと`/mcp`を確認します。

以後は、接続したブランチへpushするたびにNetlifyが自動でビルドとデプロイを行います。

## 公開後のMCP接続確認

公開後のMCP URLは次の形です。

```text
https://<site-name>.netlify.app/mcp
```

MCP Inspectorでは`Streamable HTTP`を選び、上記URLへ接続します。CLIでツール一覧を確認する例は次のとおりです。

```bash
npx @modelcontextprotocol/inspector --cli \
  --server-url https://<site-name>.netlify.app/mcp \
  --transport http \
  --method tools/list \
  --format json
```

ChatGPTの開発者モードで個人用プラグインを作成できる場合は、MCPサーバーURLにも同じ`https://<site-name>.netlify.app/mcp`を入力します。開発者モードやMCP接続の表示は、ChatGPTのプランと段階的な提供状況によって異なります。

## 公開環境の注意点

Netlify FunctionはリクエストごとにMCPサーバーとWeb標準Transportを作るステートレス構成です。GETなどPOST以外のメソッドは`405 Method Not Allowed`で拒否します。

1分間に同一IPから100リクエストまでのNetlify Functionsレート制限を設定しています。このルールが利用するNetlifyプランで使えない、またはMCPクライアントの利用を妨げる場合は、`netlify/functions/mcp.ts`の`rateLimit`を調整します。

現在は認証を設けていません。公開ダミーデータの読み取りテストに限定し、非公開データや書き込み操作を追加する前に、適切な認証・認可を実装してください。

HTTPSと公開HostはNetlifyの配信層が管理します。このエンドポイントはサーバー間のMCP接続用のため、ブラウザー向けの不要なCORS全開放は行っていません。ブラウザークライアントを追加する場合は、利用するOriginを限定して設定してください。

今回はNetlify Functions対応とローカル検証までを対象としています。GitHubリポジトリの作成、Netlifyへのデプロイ、ChatGPTへの登録は行っていません。
