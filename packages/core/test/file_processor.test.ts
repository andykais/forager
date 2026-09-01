import { test } from 'forager-test'
import { read_lines } from '~/lib/file_processor.ts'

function stream_of(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    }
  })
}

test('read_lines', async (ctx) => {
  await ctx.subtest('yields every line, including lines in the first chunk', async () => {
    const lines = await Array.fromAsync(read_lines(stream_of([
      'first\nsecond\n',
      'third\nfourth\n',
    ])))
    ctx.assert.equals(lines, ['first', 'second', 'third', 'fourth'])
  })

  await ctx.subtest('reads a single chunk stream', async () => {
    const lines = await Array.fromAsync(read_lines(stream_of(['only line\n'])))
    ctx.assert.equals(lines, ['only line'])
  })

  await ctx.subtest('joins lines split across chunk boundaries', async () => {
    const lines = await Array.fromAsync(read_lines(stream_of([
      'frame ',
      'one\nframe ',
      'two',
    ])))
    ctx.assert.equals(lines, ['frame one', 'frame two'])
  })

  await ctx.subtest('yields a trailing line without a newline', async () => {
    const lines = await Array.fromAsync(read_lines(stream_of(['first\nno trailing newline'])))
    ctx.assert.equals(lines, ['first', 'no trailing newline'])
  })

  await ctx.subtest('yields nothing for an empty stream', async () => {
    const lines = await Array.fromAsync(read_lines(stream_of([])))
    ctx.assert.equals(lines, [])
  })
})
