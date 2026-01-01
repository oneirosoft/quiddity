import { useRef, useState } from "react"

type StateOnly<S> = {
  [K in keyof S as S[K] extends (...args: any[]) => any ? never : K]: S[K]
}

type SetState<S> = (
  update: Partial<StateOnly<S>> | ((state: StateOnly<S>) => Partial<StateOnly<S>>)
) => void

const pickState = <S extends Record<string, unknown>>(store: S) =>
  Object.entries(store)
    .filter(([, value]) => typeof value !== "function")
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as StateOnly<S>)

type StoreBuilder<S extends Record<string, unknown>> = (set: SetState<S>) => S

export function create<S extends Record<string, unknown>>(
  builder: StoreBuilder<S>
): () => S & StateOnly<S>
export function create<S extends Record<string, unknown>, A extends Record<string, unknown>>(
  initialState: S,
  builder: (set: SetState<S>) => A
): () => S & A & StateOnly<S>
export function create<S extends Record<string, unknown>, A extends Record<string, unknown>>(
  arg1: StoreBuilder<S> | S,
  arg2?: (set: SetState<S>) => A
) {
  return () => {
    const setRef = useRef<((update: Parameters<SetState<S>>[0]) => void) | null>(null)
    const storeRef = useRef<(S & A) | null>(null)

    const [state, setState] = useState<StateOnly<S>>(() => {
      const set: SetState<S> = (update) => {
        if (!setRef.current) {
          return
        }
        setRef.current(update)
      }

      if (typeof arg1 === "function") {
        const store = arg1(set)
        storeRef.current = store as S & A
        return pickState(store)
      }

      if (!arg2) {
        throw new Error("create(initialState, builder) requires a builder")
      }

      const actions = arg2(set)
      const store = { ...arg1, ...actions } as S & A
      storeRef.current = store
      return pickState(arg1)
    })

    setRef.current = (update) => {
      setState((prev) => {
        const partial = typeof update === "function" ? update(prev) : update
        return { ...prev, ...partial }
      })
    }

    return {
      ...storeRef.current,
      ...state,
    } as S & A & StateOnly<S>
  }
}
