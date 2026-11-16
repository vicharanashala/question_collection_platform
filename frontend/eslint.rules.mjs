/**
 * Custom ESLint rule: no-top-level-return
 *
 * Catches "return" statements that appear directly inside a source file
 * (i.e. not inside a function body). This catches the bug where a function
 * declaration is missing its opening brace, leaving its first statement
 * (typically a return) at file/top level:
 *
 *   function Foo()     // ← missing {
 *     return (          // ← reported here as top-level return
 *       <div />
 *     )
 *
 * To use, add to your eslint.config.js:
 *   import noTopLevelReturn from './eslint.rules.mjs'
 *   { rules: { 'no-top-level-return': 'error' } }
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow return statements at the top level of a module',
      url: 'https://eslint.org/docs/rules/no-top-level-return',
    },
    messages: {
      unexpected: 'Unexpected "return" at top level. Make sure the enclosing function has an opening brace `{`.',
    },
  },
  create(context) {
    return {
      ReturnStatement(node) {
        // Walk up the tree to find the containing function / arrow / method
        let ancestor = node.parent
        while (ancestor) {
          const type = ancestor.type
          // These node types represent a function body scope
          if (
            type === 'FunctionDeclaration' ||
            type === 'FunctionExpression' ||
            type === 'ArrowFunctionExpression' ||
            type === 'MethodDefinition' ||
            type === 'ClassMethod' ||          // babel
            type === 'FunctionDeclaration'     // ts-eslint
          ) {
            return // Found a function container — this return is fine
          }
          if (type === 'Program') {
            break // Reached source file root with no function container
          }
          ancestor = ancestor.parent
        }

        // If we broke out at Program without finding a function, report it
        if (!ancestor) {
          context.report({
            node,
            messageId: 'unexpected',
          })
        }
      },
    }
  },
}