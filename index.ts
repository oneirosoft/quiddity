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

/**
 * Create a local store hook from a builder that returns state + actions.
 *
 * The builder receives a `set` helper for updating state. Only non-function
 * keys are treated as state; functions are treated as actions. Each hook call
 * creates isolated state for the component instance (no shared/global store).
 *
 * @example
 * const useCounter = create((set) => ({
 *   count: 0,
 *   inc: () => set((s) => ({ count: s.count + 1 })),
 * }))
 */
export function create<S extends Record<string, unknown>>(
  builder: StoreBuilder<S>
): () => S & StateOnly<S>
/**
 * Create a local store hook from initial state and an actions builder.
 *
 * The `initialState` is used to seed component-local state. The builder
 * returns action functions that call `set` to produce partial state updates.
 * Each hook call creates isolated state for the component instance.
 *
 * @example
 * const useCounter = create({ count: 0 }, (set) => ({
 *   inc: () => set((s) => ({ count: s.count + 1 })),
 * }))
 */
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
