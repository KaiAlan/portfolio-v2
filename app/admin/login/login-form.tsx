'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'

const initial: LoginState = {}

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
        <h1 className="type-body font-medium tracking-tight text-ink">Studio</h1>
        <input
          type="password"
          name="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          className="rounded-lg border border-card-edge bg-canvas px-3 py-2 text-ink"
        />
        <button
          type="submit"
          disabled={pending}
          className="type-button rounded-pill bg-surface-warm px-3 py-2 text-ink disabled:opacity-50"
        >
          {pending ? 'Checking…' : 'Enter'}
        </button>
        {state.error && <p className="type-meta text-muted">{state.error}</p>}
      </form>
    </main>
  )
}
