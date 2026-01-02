import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

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
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  TextDocumentSyncKind,
  type TextDocumentSyncOptions,
  type TextDocumentContentChangeEvent,
  type Position,
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

import { toFileUri, toLspPosition, toLspRange, detectLanguageId } from "./utils"

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
 * textDocumentSync capability를 내부 정책으로 정규화한 결과
 */
type NormalizedTextDocumentSync = {
  openClose: boolean
  change: TextDocumentSyncKind
}

/**
 * URI 단위 문서 상태 캐시
 */
type DocState = {
  uri: string
  filePath: string
  languageId: string
  version: number
  lastText: string
  lastUsedAt: number
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

  private syncPolicy: NormalizedTextDocumentSync = {
    openClose: false,
    change: TextDocumentSyncKind.None,
  }

  private readonly docs = new Map<string, DocState>()
  private readonly docSyncQueues = new Map<string, Promise<void>>()

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
    await this.ensureDocumentSynced(filePath)

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
    await this.ensureDocumentSynced(filePath)

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
    await this.ensureDocumentSynced(filePath)

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
    await this.ensureDocumentSynced(filePath)

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
    await this.ensureDocumentSynced(filePath)

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
    await this.ensureDocumentSynced(filePath)

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
    await this.ensureDocumentSynced(filePath)

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
    await this.ensureDocumentSynced(args.filePath)

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
      // 서버가 재시작/종료되면, 서버는 열린 문서를 모두 잊는다.
      // 따라서 클라이언트 쪽 문서 캐시/락/정책도 초기 상태로 되돌린다.
      this.resetDocumentSyncState()

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
    this.syncPolicy = this.normalizeTextDocumentSync(result)

    // 서버가 open/close를 지원하지 않으면, 문서 캐시를 유지할 이유가 없다.
    if (!this.syncPolicy.openClose) {
      this.docs.clear()
      this.docSyncQueues.clear()
    }

    await this.conn!.sendNotification(InitializedNotification.method, {})
    this.initialized = true
  }

  /**
   * 특정 파일이 서버에 최신 상태로 동기화되어 있음을 보장한다.
   * - 동일 URI에 대해 didOpen은 1회만 보낸다.
   * - 변경이 있으면 서버 capability에 맞춰 didChange로 동기화한다.
   * - 동일 URI에 대한 "read/compare/send"는 직렬화한다.
   */
  private async ensureDocumentSynced(filePath: string): Promise<void> {
    const absPath = resolve(filePath)
    const uri = toFileUri(absPath)

    await this.runWithDocumentQueue(uri, async () => {
      // 정책 2.B: 요청 직전에 항상 파일을 읽어 최신 내용을 확보한다.
      let textNow: string
      try {
        textNow = await readFile(absPath, "utf-8")
      } catch (err) {
        // 파일이 사라졌거나 읽을 수 없으면, 필요 시 didClose 후 캐시를 제거한다.
        await this.handleReadFileFailure(uri, err)
        throw err
      }

      const languageId = detectLanguageId(absPath)

      // strict capability: openClose를 지원하지 않으면, 문서 알림을 일절 보내지 않는다.
      if (!this.syncPolicy.openClose) {
        return
      }

      const existing = this.docs.get(uri)
      if (!existing) {
        await this.sendDidOpen({ uri, filePath: absPath, languageId, text: textNow })
        return
      }

      existing.lastUsedAt = Date.now()

      if (existing.languageId !== languageId) {
        // languageId가 바뀌면 서버 입장에서는 다른 문서로 취급될 수 있으므로 close+open으로 재동기화한다.
        await this.sendDidClose(uri)
        this.docs.delete(uri)
        await this.sendDidOpen({ uri, filePath: absPath, languageId, text: textNow })
        return
      }

      // change capability가 None이면 didChange를 보내지 않는다.
      if (this.syncPolicy.change === TextDocumentSyncKind.None) {
        return
      }

      if (textNow === existing.lastText) {
        return
      }

      await this.sendDidChange({ uri, doc: existing, textNow })
    })
  }

  /**
   * InitializeResult.capabilities.textDocumentSync를 엄격 규칙으로 정규화한다.
   */
  private normalizeTextDocumentSync(result: InitializeResult): NormalizedTextDocumentSync {
    const raw = result.capabilities.textDocumentSync

    if (typeof raw === "number") {
      // 호환 규칙: TextDocumentSyncKind(number)로 온 경우 openClose=true로 간주한다.
      return {
        openClose: true,
        change: raw as TextDocumentSyncKind,
      }
    }

    if (!raw) {
      return {
        openClose: false,
        change: TextDocumentSyncKind.None,
      }
    }

    const opts = raw as TextDocumentSyncOptions

    return {
      openClose: opts.openClose ?? false,
      change: (opts.change ?? TextDocumentSyncKind.None) as TextDocumentSyncKind,
    }
  }

  /**
   * per-URI로 문서 동기화 작업을 직렬화한다.
   */
  private runWithDocumentQueue<T>(uri: string, work: () => Promise<T>): Promise<T> {
    const prev = this.docSyncQueues.get(uri) ?? Promise.resolve()

    const run = prev
      .catch(() => {
        // 이전 작업 실패가 다음 작업을 막지 않도록 한다.
      })
      .then(work)

    // 큐 자체는 항상 resolve되도록 저장해서, 다음 작업이 체인에 안전하게 붙게 한다.
    this.docSyncQueues.set(
      uri,
      run.then(
        () => undefined,
        () => undefined
      )
    )

    return run
  }

  /**
   * didOpen을 전송하고 내부 캐시를 생성한다.
   */
  private async sendDidOpen(args: { uri: string; filePath: string; languageId: string; text: string }): Promise<void> {
    const item: TextDocumentItem = {
      uri: args.uri,
      languageId: args.languageId,
      version: 1,
      text: args.text,
    }

    await this.conn!.sendNotification(DidOpenTextDocumentNotification.method, {
      textDocument: item,
    })

    this.docs.set(args.uri, {
      uri: args.uri,
      filePath: args.filePath,
      languageId: args.languageId,
      version: 1,
      lastText: args.text,
      lastUsedAt: Date.now(),
    })
  }

  /**
   * didClose를 전송한다.
   */
  private async sendDidClose(uri: string): Promise<void> {
    await this.conn!.sendNotification(DidCloseTextDocumentNotification.method, {
      textDocument: { uri },
    })
  }

  /**
   * didChange를 capability에 맞춰 전송하고 캐시를 갱신한다.
   */
  private async sendDidChange(args: { uri: string; doc: DocState; textNow: string }): Promise<void> {
    const nextVersion = args.doc.version + 1

    const contentChanges: TextDocumentContentChangeEvent[] =
      this.syncPolicy.change === TextDocumentSyncKind.Full
        ? [{ text: args.textNow }]
        : [this.computeSingleIncrementalChange(args.doc.lastText, args.textNow)]

    await this.conn!.sendNotification(DidChangeTextDocumentNotification.method, {
      textDocument: { uri: args.uri, version: nextVersion },
      contentChanges,
    })

    args.doc.version = nextVersion
    args.doc.lastText = args.textNow
    args.doc.lastUsedAt = Date.now()
  }

  /**
   * Incremental 모드에서 단일 contentChange 이벤트(range+text)를 만든다.
   * - 공통 prefix/suffix를 찾아 oldText의 한 구간을 newText의 한 구간으로 치환한다.
   * - range는 oldText 기준, character는 UTF-16 code unit 기준이다.
   */
  private computeSingleIncrementalChange(oldText: string, newText: string): TextDocumentContentChangeEvent {
    if (oldText === newText) {
      return { text: newText }
    }

    let prefix = 0
    const minLen = Math.min(oldText.length, newText.length)
    while (prefix < minLen && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) {
      prefix++
    }

    let oldSuffix = oldText.length
    let newSuffix = newText.length
    while (
      oldSuffix > prefix &&
      newSuffix > prefix &&
      oldText.charCodeAt(oldSuffix - 1) === newText.charCodeAt(newSuffix - 1)
    ) {
      oldSuffix--
      newSuffix--
    }

    const replacedOldStart = prefix
    const replacedOldEnd = oldSuffix
    const insertedText = newText.slice(prefix, newSuffix)

    const lineStarts = this.computeLineStartOffsets(oldText)
    const start = this.offsetToPosition(lineStarts, replacedOldStart)
    const end = this.offsetToPosition(lineStarts, replacedOldEnd)

    return {
      range: { start, end },
      rangeLength: replacedOldEnd - replacedOldStart,
      text: insertedText,
    }
  }

  /**
   * 텍스트의 각 라인 시작 offset을 계산한다.
   * - 라인 구분은 \n 기준
   * - 반환 offset은 UTF-16 code unit 인덱스(= JS string index)
   */
  private computeLineStartOffsets(text: string): number[] {
    const starts = [0]
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10 /* \n */) {
        starts.push(i + 1)
      }
    }
    return starts
  }

  /**
   * UTF-16 code unit offset을 LSP Position(line, character)으로 변환한다.
   */
  private offsetToPosition(lineStarts: number[], offset: number): Position {
    let lo = 0
    let hi = lineStarts.length - 1

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (lineStarts[mid] <= offset) lo = mid + 1
      else hi = mid - 1
    }

    const line = Math.max(0, hi)
    return { line, character: offset - lineStarts[line] }
  }

  /**
   * readFile 실패 시, 캐시/서버 상태를 스펙에 맞게 정리한다.
   */
  private async handleReadFileFailure(uri: string, err: unknown): Promise<void> {
    const existing = this.docs.get(uri)
    if (!existing) {
      return
    }

    if (!this.syncPolicy.openClose) {
      this.docs.delete(uri)
      return
    }

    const error = err as NodeJS.ErrnoException
    if (error?.code === "ENOENT") {
      // 파일이 사라졌으면 서버에도 close를 보내고 캐시를 제거한다.
      await this.sendDidClose(uri)
      this.docs.delete(uri)
      return
    }

    // 그 외 오류는 캐시만 제거하여 다음 요청에서 재-open 경로로 유도한다.
    this.docs.delete(uri)
  }

  /**
   * 서버 재시작/종료 시 문서 캐시/락/정책을 초기화한다.
   */
  private resetDocumentSyncState(): void {
    this.docs.clear()
    this.docSyncQueues.clear()
    this.syncPolicy = {
      openClose: false,
      change: TextDocumentSyncKind.None,
    }
  }
}
