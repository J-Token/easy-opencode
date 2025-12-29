import { z } from "zod"

export const easyOpencodeConfigSchema = z.object({
  limits: z
    .object({
      timeoutMs: z.number().int().positive().default(300_000),
      maxReferences: z.number().int().positive().default(200),
      maxSymbols: z.number().int().positive().default(200),
      maxDiagnostics: z.number().int().positive().default(200),
      maxOutputBytes: z.number().int().positive().default(1_048_576),
    })
    .default({
      timeoutMs: 300_000,
      maxReferences: 200,
      maxSymbols: 200,
      maxDiagnostics: 200,
      maxOutputBytes: 1_048_576,
    }),

  apply: z
    .object({
      allowCreate: z.boolean().default(true),
      allowRename: z.boolean().default(true),
      allowDelete: z.boolean().default(true),
      allowOutsideWorkspace: z.boolean().default(true),
    })
    .default({
      allowCreate: true,
      allowRename: true,
      allowDelete: true,
      allowOutsideWorkspace: true,
    }),

  lsp: z
    .object({
      servers: z
        .array(
          z.object({
            id: z.string().min(1),
            extensions: z.array(z.string().min(2)).default([]),
            command: z.string().min(1),
            args: z.array(z.string()).default([]),
            env: z.record(z.string(), z.string()).optional(),
          })
        )
        .default([]),
    })
    .default({ servers: [] }),

  astGrep: z
    .object({
      preferNapi: z.boolean().default(true),
      defaultDryRun: z.boolean().default(true),

      timeoutMs: z.number().int().positive().default(300_000),
      maxOutputBytes: z.number().int().positive().default(1 * 1024 * 1024),
      maxMatches: z.number().int().positive().default(500),
    })
    .default({
      preferNapi: true,
      defaultDryRun: true,
      timeoutMs: 300_000,
      maxOutputBytes: 1 * 1024 * 1024,
      maxMatches: 500,
    }),
})

export type EasyOpencodeConfig = z.infer<typeof easyOpencodeConfigSchema>
