import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { readFile } from "node:fs/promises"

import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-jsonrpc/node"

import {
  InitializeRequest,
  type InitializeParams,
  type InitializeResult,
  InitializedNotification,
  TextDocumentItem,
  DidOpenTextDocumentNotification,
  HoverRequest,
  type Hover,
  DefinitionRequest,
  type Definition,
  ReferencesRequest,
  type Location,
  DocumentSymbolRequest,
  type DocumentSymbol,
  type SymbolInformation,
  WorkspaceSymbolRequest,
  type WorkspaceSymbolParams,
  type SymbolInformation as WorkspaceSymbolInfo,
  DocumentDiagnosticRequest,
  type DocumentDiagnosticParams,
  type DocumentDiagnosticReport,
  PrepareRenameRequest,
  type PrepareRenameParams,
  RenameRequest,
  type RenameParams,
  CodeActionRequest,
  type CodeActionParams,
  type CodeAction,
  type Command,
  CodeActionResolveRequest,
} from "vscode-languageserver-protocol"

import {
  toFileUri,
  toLspPosition,
  toLspRange,
  detectLanguageId,
} from "./utils"

/**
 * LSP 클라이언트 옵션
 */
type LspClientOptions = {
  serverId: string
  command: string
  args: string[]
  env?: Record<string, string>
  projectDir: string
}

/**
 * LSP 클라이언트
 * - stdio JSON-RPC 기반
 * - 최소 기능만 구현하여 안정적으로 동작하게 한다
 */
export class LspClient {
  private readonly serverId: string
  private readonly command: string
  private readonly args: string[]
  private readonly env?: Record<string, string>
  private readonly projectDir: string

  private proc: ChildProcessWithoutNullStreams | null = null
  private conn: MessageConnection | null = null
  private initialized = false

  public constructor(opts: LspClientOptions) {
    this.serverId = opts.serverId
    this.command = opts.command
    this.args = opts.args
    this.env = opts.env
    this.projectDir = opts.projectDir
  }

  /**
   * 서버가 시작되어 있고 initialize가 끝났는지 보장한다.
   */
  public async ensureStarted(): Promise<void> {
    if (this.initialized && this.conn && this.proc) {
      return
    }

    await this.start()
    await this.initialize()
  }

  /**
   * hover 요청을 실행한다.
   */
  public async hover(filePath: string, line1: number, character0: number): Promise<Hover | null> {
    await this.ensureStarted()
    await this.ensureDidOpen(filePath)

    const params = {
      textDocument: { uri: toFileUri(filePath) },
      position: toLspPosition(line1, character0),
    }

    return await this.conn!.sendRequest(HoverRequest.method, params)
  }

  /**
   * definition 요청을 실행한다.
   */
  public async definition(filePath: string, line1: number, character0: number): Promise<Definition | null> {
    await this.ensureStarted()
    await this.ensureDidOpen(filePath)

    const params = {
      textDocument: { uri: toFileUri(filePath) },
      position: toLspPosition(line1, character0),
    }

    return await this.conn!.sendRequest(DefinitionRequest.method, params)
  }

  /**
   * references 요청을 실행한다.
   */
  public async references(
    filePath: string,
    line1: number,
    character0: number,
    includeDeclaration: boolean
  ): Promise<Location[] | null> {
    await this.ensureStarted()
    await this.ensureDidOpen(filePath)

    const params = {
      textDocument: { uri: toFileUri(filePath) },
      position: toLspPosition(line1, character0),
      context: { includeDeclaration },
    }

    return await this.conn!.sendRequest(ReferencesRequest.method, params)
  }

  /**
   * document symbols 요청을 실행한다.
   */
  public async documentSymbols(filePath: string): Promise<Array<DocumentSymbol | SymbolInformation> | null> {
    await this.ensureStarted()
    await this.ensureDidOpen(filePath)

    const params = {
      textDocument: { uri: toFileUri(filePath) },
    }

    return await this.conn!.sendRequest(DocumentSymbolRequest.method, params)
  }

  /**
   * workspace symbols 요청을 실행한다.
   */
  public async workspaceSymbols(query: string): Promise<WorkspaceSymbolInfo[] | null> {
    await this.ensureStarted()

    const params: WorkspaceSymbolParams = { query }
    return await this.conn!.sendRequest(WorkspaceSymbolRequest.method, params)
  }

  /**
   * diagnostics 요청을 실행한다.
   * - 서버가 미지원이면 null 반환
   */
  public async diagnostics(filePath: string): Promise<DocumentDiagnosticReport | null> {
    await this.ensureStarted()
    await this.ensureDidOpen(filePath)

    const params: DocumentDiagnosticParams = {
      textDocument: { uri: toFileUri(filePath) },
      previousResultId: undefined,
    }

    try {
      return await this.conn!.sendRequest(DocumentDiagnosticRequest.method, params)
    } catch {
      return null
    }
  }

  /**
   * prepareRename 요청을 실행한다.
   */
  public async prepareRename(filePath: string, line1: number, character0: number): Promise<string | null> {
    await this.ensureStarted()
    await this.ensureDidOpen(filePath)

    const params: PrepareRenameParams = {
      textDocument: { uri: toFileUri(filePath) },
      position: toLspPosition(line1, character0),
    }

    try {
      const res = await this.conn!.sendRequest(PrepareRenameRequest.method, params)
      if (!res) return null
      return "Rename supported"
    } catch {
      return null
    }
  }

  /**
   * rename 요청을 실행한다.
   */
  public async rename(filePath: string, line1: number, character0: number, newName: string): Promise<any | null> {
    await this.ensureStarted()
    await this.ensureDidOpen(filePath)

    const params: RenameParams = {
      textDocument: { uri: toFileUri(filePath) },
      position: toLspPosition(line1, character0),
      newName,
    }

    return await this.conn!.sendRequest(RenameRequest.method, params)
  }

  /**
   * code actions 요청을 실행한다.
   */
  public async codeActions(args: {
    filePath: string
    startLine: number
    startCharacter: number
    endLine: number
    endCharacter: number
    only?: string[]
  }): Promise<Array<CodeAction | Command> | null> {
    await this.ensureStarted()
    await this.ensureDidOpen(args.filePath)

    const params: CodeActionParams = {
      textDocument: { uri: toFileUri(args.filePath) },
      range: toLspRange(args.startLine, args.startCharacter, args.endLine, args.endCharacter),
      context: { diagnostics: [], only: args.only },
    }

    return await this.conn!.sendRequest(CodeActionRequest.method, params)
  }

  /**
   * codeAction resolve 요청을 실행한다.
   */
  public async resolveCodeAction(action: CodeAction): Promise<CodeAction | null> {
    await this.ensureStarted()

    try {
      return await this.conn!.sendRequest(CodeActionResolveRequest.method, action)
    } catch {
      return action
    }
  }

  /**
   * 서버 프로세스를 시작하고 JSON-RPC 연결을 만든다.
   */
  private async start(): Promise<void> {
    const env = { ...process.env, ...(this.env ?? {}) }

    this.proc = spawn(this.command, this.args, {
      cwd: this.projectDir,
      env,
      stdio: "pipe",
    })

    const reader = new StreamMessageReader(this.proc.stdout)
    const writer = new StreamMessageWriter(this.proc.stdin)

    this.conn = createMessageConnection(reader, writer)
    this.conn.listen()

    this.proc.on("exit", () => {
      this.initialized = false
      this.conn?.dispose()
      this.conn = null
      this.proc = null
    })
  }

  /**
   * initialize/initialized 핸드셰이크를 수행한다.
   */
  private async initialize(): Promise<void> {
    const params: InitializeParams = {
      processId: process.pid,
      rootUri: toFileUri(this.projectDir),
      capabilities: {
        textDocument: {},
        workspace: {},
      },
      workspaceFolders: null,
    }

    const result: InitializeResult = await this.conn!.sendRequest(InitializeRequest.method, params)
    void result

    await this.conn!.sendNotification(InitializedNotification.method, {})
    this.initialized = true
  }

  /**
   * 파일을 didOpen 해 둔다.
   * - 일부 서버는 didOpen 없이 동작하지 않는다.
   */
  private async ensureDidOpen(filePath: string): Promise<void> {
    const uri = toFileUri(filePath)

    const text = await readFile(filePath, "utf-8")
    const languageId = detectLanguageId(filePath)

    const item: TextDocumentItem = {
      uri,
      languageId,
      version: 1,
      text,
    }

    await this.conn!.sendNotification(DidOpenTextDocumentNotification.method, {
      textDocument: item,
    })
  }
}
