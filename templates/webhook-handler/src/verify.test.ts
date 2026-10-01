import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyWaveSignature } from './verify';

const secret = 'test-secret-not-a-real-one';
const body = JSON.stringify({ event: 'incident.started', data: { id: 'x' }, delivered_at: '2026-01-01T00:00:00.000Z' });
const sign = (payload: string) => `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

test('accepts the signature WAVE sends', () => {
  assert.equal(verifyWaveSignature(body, sign(body), secret), true);
});

test('rejects a changed body', () => {
  assert.equal(verifyWaveSignature(`${body} `, sign(body), secret), false);
});

test('rejects a missing, bare, short or non-hex signature without throwing', () => {
  const hex = sign(body).slice('sha256='.length);
  for (const header of [undefined, '', hex, 'sha256=', 'sha256=abc', `sha256=${'z'.repeat(64)}`, `sha256=${hex}00`]) {
    assert.equal(verifyWaveSignature(body, header, secret), false, String(header));
  }
});

test('rejects a signature made with another secret', () => {
  const other = `sha256=${createHmac('sha256', 'another-secret').update(body).digest('hex')}`;
  assert.equal(verifyWaveSignature(body, other, secret), false);
});
