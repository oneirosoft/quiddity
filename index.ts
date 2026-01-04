import { useRef, useState } from "react"

type StateOnly<S> = {
  [K in keyof S as S[K] extends (...args: any[]) => any ? never : K]: S[K]
}

type SetState<S> = (
  update: Partial<StateOnly<S>> | ((state: StateOnly<S>) => Partial<StateOnly<S>>)
) => void

type Derive<S extends Record<string, unknown>, D extends Record<string, unknown>> = (
  state: StateOnly<S>
) => D

const pickState = <S extends Record<string, unknown>>(store: S) =>
  Object.entries(store)
    .filter(([, value]) => typeof value !== "function")
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as StateOnly<S>)

/**
 * Build a store builder by combining plain state with action creators.
 *
 * @example
 * const useCounter = create(
 *   combine({ count: 0 }, (set) => ({
 *     inc: () => set((s) => ({ count: s.count + 1 })),
 *   }))
 * )
 */
export const combine = <
  S extends Record<string, unknown>,
  A extends Record<string, unknown>
>(
  state: S,
  actions: (set: SetState<S>) => A
) => {
  return (set: SetState<S>) => ({ ...state, ...actions(set) })
}

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
 *
 * const useWithDerived = create(
 *   (set) => ({
 *     count: 0,
 *     inc: () => set((s) => ({ count: s.count + 1 })),
 *   }),
 *   (state) => ({ doubleCount: state.count * 2 })
 * )
 */
export function create<S extends Record<string, unknown>>(
  builder: (set: SetState<S>) => S
): () => S
export function create<
  S extends Record<string, unknown>,
  D extends Record<string, unknown>
>(
  builder: (set: SetState<S>) => S,
  derive: Derive<S, D>
): () => S & D
export function create<
  S extends Record<string, unknown>,
  D extends Record<string, unknown>
>(
  arg1: (set: SetState<S>) => S,
  arg2?: Derive<S, D>
): () => S & D {
  return () => {
    const setRef = useRef<((update: Parameters<SetState<S>>[0]) => void) | null>(null)
    const storeRef = useRef<S | null>(null)

    const [state, setState] = useState<StateOnly<S>>(() => {
      const set: SetState<S> = (update) => {
        if (!setRef.current) {
          return
        }
        setRef.current(update)
      }

      const store = arg1(set)
      storeRef.current = store
      return pickState(store)
    })

    setRef.current = (update) => {
      setState((prev) => {
        const partial = typeof update === "function" ? update(prev) : update
        return { ...prev, ...partial }
      })
    }

    const derived = arg2?.(state)

    return {
      ...storeRef.current,
      ...state,
      ...(derived ?? {}),
    } as S & D
  }
}
