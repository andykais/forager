import * as errors from '~/lib/errors.ts'
import { TEXT_SEARCH_FIELDS } from '~/inputs/media_reference_inputs.ts'

export interface TextSearchFilter {
  query: string
  fields: readonly (typeof TEXT_SEARCH_FIELDS)[number][]
}

// unicode61, the tokenizer behind media_reference_fts, only emits tokens made of letters and
// numbers. A term with none of those compiles to an empty fts5 phrase that matches nothing, so such
// terms are dropped rather than silently voiding the rest of the search.
const TOKENIZABLE = /[\p{L}\p{N}]/u

/**
 * Compiles a user supplied text search into an fts5 MATCH expression.
 *
 * Whitespace separated terms are ANDed together and each one is quoted as an fts5 string, which
 * means user input can never be reinterpreted as fts5 query syntax. A trailing `*` is preserved as
 * a prefix search. When the search covers fewer than all indexed fields, the expression is wrapped
 * in an fts5 column filter.
 */
export function build_fts_match_expression(text_search: TextSearchFilter): string {
  const phrases: string[] = []

  for (const term of text_search.query.split(/\s+/)) {
    const is_prefix_search = term.endsWith('*')
    const phrase = is_prefix_search ? term.slice(0, -1) : term
    if (!TOKENIZABLE.test(phrase)) continue
    phrases.push(`"${phrase.replaceAll('"', '""')}"${is_prefix_search ? '*' : ''}`)
  }

  if (phrases.length === 0) {
    throw new errors.BadInputError(`text search ${JSON.stringify(text_search.query)} contains no searchable words`)
  }

  const expression = phrases.join(' AND ')

  if (text_search.fields.length === TEXT_SEARCH_FIELDS.length) {
    return expression
  }
  return `{${text_search.fields.join(' ')}} : (${expression})`
}
