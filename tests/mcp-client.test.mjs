import assert from 'node:assert/strict'
import { test } from 'node:test'

const mcp = await import('../lib/mcp-client.js')

test('parses successful OpenPencil MCP text JSON', () => {
  const result = mcp.parseOpenPencilMcpResponse('get_selection', {
    jsonrpc: '2.0', id: 1,
    result: {
      content: [{ type: 'text', text: '{"selectedIds":["n1"],"activePageId":"p1","nodes":[]}' }],
    },
  })
  assert.deepEqual(result.value, { selectedIds: ['n1'], activePageId: 'p1', nodes: [] })
})

test('surfaces JSON-RPC, MCP isError, and transactional applied=false failures', () => {
  assert.throws(() => mcp.parseOpenPencilMcpResponse('x', {
    jsonrpc: '2.0', id: 1, error: { message: 'denied' },
  }), /denied/)
  assert.throws(() => mcp.parseOpenPencilMcpResponse('x', {
    jsonrpc: '2.0', id: 1, result: { isError: true, content: [{ type: 'text', text: 'bad patch' }] },
  }), /bad patch/)
  assert.throws(() => mcp.parseOpenPencilMcpResponse('batch_design', {
    jsonrpc: '2.0', id: 1,
    result: { content: [{ type: 'text', text: '{"applied":false,"errors":["line 2 failed"]}' }] },
  }), /line 2 failed/)
})

test('version probes time out even when the daemon never responds', async () => {
  const fetcher = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
  })
  await assert.rejects(mcp.getOpenPencilMcpVersion({
    baseUrl: 'http://127.0.0.1:43123',
    token: 'test-token',
    fetcher,
    timeoutMs: 10,
  }), error => error?.name === 'TimeoutError')
})
