/**
 * Phase 1A acceptance tests for bounded login retry.
 *
 * Runs under plain Node (node:test, no external deps) with a virtual
 * clock, so no real waiting occurs. The recorded virtual sleeps plus the
 * production 10 s per-attempt timeout define the recovery budget.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AuthRetryExhaustedError,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_RETRY_DELAYS_MS,
  isRetryableAuthError,
  runWithAuthRetry,
} from './authRetry.ts'

function virtualClock(): {
  sleeps: number[]
  now: () => number
  sleep: (ms: number) => Promise<void>
} {
  let time = 0
  const sleeps: number[] = []
  return {
    sleeps,
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      time += ms
    },
  }
}

describe('retry schedule', () => {
  it('declares the approved bounded budget', () => {
    assert.equal(LOGIN_MAX_ATTEMPTS, 4)
    assert.deepEqual([...LOGIN_RETRY_DELAYS_MS], [8000, 15000, 25000])
  })
})

describe('isRetryableAuthError', () => {
  it('retries cold-start aborts and timeout markers', () => {
    assert.equal(isRetryableAuthError(new Error('__COLD_START__')), true)
    assert.equal(
      isRetryableAuthError(
        new Error('The server is still starting up — please wait'),
      ),
      true,
    )
    assert.equal(
      isRetryableAuthError(
        new Error('Database unavailable, please try again later'),
      ),
      true,
    )
    assert.equal(isRetryableAuthError(new Error('Request failed (503)')), true)
    assert.equal(isRetryableAuthError(new Error('Failed to fetch')), true)
  })

  it('never retries definitive credential and validation outcomes', () => {
    const terminal = [
      'Invalid credentials',
      'Username, email, and password are required',
      'Username already taken',
      'Password must contain a number',
      'Signup failed',
      'Login failed',
    ]
    for (const message of terminal) {
      assert.equal(isRetryableAuthError(new Error(message)), false, message)
    }
  })
})

describe('runWithAuthRetry', () => {
  it('warm backend: succeeds immediately with no waits', async () => {
    const clock = virtualClock()
    let calls = 0
    const outcome = await runWithAuthRetry(
      async () => {
        calls += 1
        return 'ok'
      },
      { sleep: clock.sleep, now: clock.now },
    )
    assert.equal(calls, 1)
    assert.deepEqual(clock.sleeps, [])
    assert.equal(outcome.attempts, 1)
    assert.equal(outcome.elapsedMs, 0)
    assert.equal(outcome.value, 'ok')
  })

  it('cold backend: recovers when the service wakes on the third attempt', async () => {
    const clock = virtualClock()
    const retries: Array<{ attempt: number; maxAttempts: number }> = []
    let calls = 0
    const outcome = await runWithAuthRetry(
      async () => {
        calls += 1
        if (calls < 3) throw new Error('__COLD_START__')
        return 'ok'
      },
      {
        sleep: clock.sleep,
        now: clock.now,
        onRetry: (info) => {
          retries.push(info)
        },
      },
    )
    assert.equal(calls, 3)
    assert.deepEqual(clock.sleeps, [8000, 15000])
    assert.deepEqual(retries, [
      { attempt: 1, maxAttempts: LOGIN_MAX_ATTEMPTS },
      { attempt: 2, maxAttempts: LOGIN_MAX_ATTEMPTS },
    ])
    assert.equal(outcome.attempts, 3)
    assert.equal(outcome.elapsedMs, 23000)
  })

  it('dead backend: stops after the bounded budget with an exhausted error', async () => {
    const clock = virtualClock()
    let calls = 0
    await assert.rejects(
      runWithAuthRetry(
        async (): Promise<string> => {
          calls += 1
          throw new Error('Database unavailable, please try again later')
        },
        { sleep: clock.sleep, now: clock.now },
      ),
      (err: unknown) =>
        err instanceof AuthRetryExhaustedError && err.attempts === 4,
    )
    assert.equal(calls, 4)
    assert.deepEqual(clock.sleeps, [8000, 15000, 25000])
  })

  it('wrong credentials: fails immediately with the original generic error', async () => {
    const clock = virtualClock()
    let calls = 0
    await assert.rejects(
      runWithAuthRetry(
        async (): Promise<string> => {
          calls += 1
          throw new Error('Invalid credentials')
        },
        { sleep: clock.sleep, now: clock.now },
      ),
      (err: unknown) =>
        err instanceof Error &&
        !(err instanceof AuthRetryExhaustedError) &&
        err.message === 'Invalid credentials',
    )
    assert.equal(calls, 1)
    assert.deepEqual(clock.sleeps, [])
  })
})
