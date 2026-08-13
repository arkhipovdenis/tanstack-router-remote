import * as ts from 'typescript'

import {
  DEFAULT_ADAPTER_PACKAGE,
  DEFAULT_HELPER_EXPORT,
  TRANSFORM_MARKER,
} from './constants.js'

export type RemoteRouteTransformOptions = {
  /** Package that exports the remote-route factory and in-place decorator. */
  adapterPackage?: string
  /** Named export. `createRemoteRoute` is the adapter default. */
  helperExport?: string
}

type RouteDeclaration = {
  end: number
  hasSemicolon: boolean
}

/**
 * Adds an in-place remote-route decoration without changing the generated
 * route declaration. The TanStack generator therefore still observes the
 * exact `export const Route = createFileRoute(...)({...})` form it expects.
 */
export function transformRemoteRouteModule(
  source: string,
  resourcePath: string,
  options: RemoteRouteTransformOptions = {},
) {
  if (source.includes(TRANSFORM_MARKER)) {
    return source
  }

  const sourceFile = ts.createSourceFile(
    resourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(resourcePath),
  )
  const routeDeclaration = findRouteDeclaration(sourceFile)

  if (!routeDeclaration) {
    throw new Error(
      `${resourcePath}: a *.remote.tsx file must export ` +
        '`const Route = createFileRoute(...)(...)` before it can be decorated.',
    )
  }

  const localHelper = uniqueHelperName(source)
  const importAt = findImportInsertionPoint(sourceFile)
  const adapterPackage = options.adapterPackage ?? DEFAULT_ADAPTER_PACKAGE
  const helperExport = options.helperExport ?? DEFAULT_HELPER_EXPORT
  const importStatement =
    `\n${TRANSFORM_MARKER}\n` +
    `import { ${helperExport} as ${localHelper} } from ${JSON.stringify(adapterPackage)}\n`
  const decoration =
    `${routeDeclaration.hasSemicolon ? '\n' : '\n;\n'}` +
    `${localHelper}(Route)\n`

  return (
    source.slice(0, importAt) +
    importStatement +
    source.slice(importAt, routeDeclaration.end) +
    decoration +
    source.slice(routeDeclaration.end)
  )
}

function scriptKindFor(resourcePath: string) {
  if (/\.tsx$/i.test(resourcePath)) {
    return ts.ScriptKind.TSX
  }

  if (/\.jsx$/i.test(resourcePath)) {
    return ts.ScriptKind.JSX
  }

  if (/\.js$/i.test(resourcePath) || /\.mjs$/i.test(resourcePath)) {
    return ts.ScriptKind.JS
  }

  return ts.ScriptKind.TS
}

function findRouteDeclaration(sourceFile: ts.SourceFile): RouteDeclaration | null {
  const matches = sourceFile.statements.flatMap((statement) => {
    if (!isExportedVariableStatement(statement)) {
      return []
    }

    return statement.declarationList.declarations.flatMap((declaration) => {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== 'Route' ||
        !declaration.initializer ||
        !isDirectCreateFileRouteCall(declaration.initializer)
      ) {
        return []
      }

      const declarationText = sourceFile.text.slice(
        statement.getStart(sourceFile),
        statement.getEnd(),
      )

      return [
        {
          end: statement.getEnd(),
          hasSemicolon: /;\s*$/.test(declarationText),
        },
      ]
    })
  })

  if (matches.length > 1) {
    throw new Error(
      `${sourceFile.fileName}: expected exactly one exported file Route declaration.`,
    )
  }

  return matches[0] ?? null
}

function isExportedVariableStatement(statement: ts.Statement): statement is ts.VariableStatement {
  return (
    ts.isVariableStatement(statement) &&
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) === true
  )
}

function isDirectCreateFileRouteCall(expression: ts.Expression) {
  const outerCall = unwrapParentheses(expression)

  if (!ts.isCallExpression(outerCall)) {
    return false
  }

  const factoryCall = unwrapParentheses(outerCall.expression)

  return (
    ts.isCallExpression(factoryCall) &&
    ts.isIdentifier(factoryCall.expression) &&
    factoryCall.expression.text === 'createFileRoute'
  )
}

function unwrapParentheses(expression: ts.Expression): ts.Expression {
  let current = expression

  while (ts.isParenthesizedExpression(current)) {
    current = current.expression
  }

  return current
}

function findImportInsertionPoint(sourceFile: ts.SourceFile) {
  let insertionPoint = 0

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || isDirective(statement)) {
      insertionPoint = statement.getEnd()
      continue
    }

    break
  }

  return insertionPoint
}

function isDirective(statement: ts.Statement) {
  return (
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression)
  )
}

function uniqueHelperName(source: string) {
  const baseName = '__tanstackRouterRemoteCreateRemoteRoute'
  let suffix = 0
  let candidate = baseName

  while (new RegExp(`\\b${candidate}\\b`).test(source)) {
    suffix += 1
    candidate = `${baseName}${suffix}`
  }

  return candidate
}
