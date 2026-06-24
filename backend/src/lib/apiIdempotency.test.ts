import assert from 'node:assert/strict'
import { readIdempotencyKey } from './apiIdempotency'

function mockReq(headers: Record<string, string | undefined>) {
  return { headers } as Parameters<typeof readIdempotencyKey>[0]
}

assert.equal(readIdempotencyKey(mockReq({})), null)
assert.equal(readIdempotencyKey(mockReq({ 'x-idempotency-key': 'short' })), null)
assert.equal(
  readIdempotencyKey(mockReq({ 'x-idempotency-key': '  abcdefgh-1234  ' })),
  'abcdefgh-1234',
)

console.log('apiIdempotency.test.ts OK')
