import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { combine, create as createStore } from "./index"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const ignoredWarnings = new Set([
  "The current testing environment is not configured to support act(...)",
])

const shouldIgnoreWarning = (message: unknown) => {
  if (typeof message !== "string") {
    return false
  }
  return Array.from(ignoredWarnings).some((warning) => message.startsWith(warning))
}

beforeAll(() => {
  const originalError = console.error
  const originalWarn = console.warn

  console.error = (...args: unknown[]) => {
    if (shouldIgnoreWarning(args[0])) {
      return
    }
    originalError(...args)
  }

  console.warn = (...args: unknown[]) => {
    if (shouldIgnoreWarning(args[0])) {
      return
    }
    originalWarn(...args)
  }

  ;(globalThis as { __quiddityConsoleRestore?: () => void }).__quiddityConsoleRestore =
    () => {
      console.error = originalError
      console.warn = originalWarn
    }
})

afterAll(() => {
  ;(globalThis as { __quiddityConsoleRestore?: () => void }).__quiddityConsoleRestore?.()
})

const renderHook = <T,>(useHook: () => T) => {
  let latest: T

  const Test = () => {
    latest = useHook()
    return null
  }

  const container = document.createElement("div")
  const root = createRoot(container)

  act(() => {
    root.render(<Test />)
  })

  return {
    get current() {
      return latest
    },
    unmount() {
      act(() => {
        root.unmount()
      })
    },
  }
}

describe("quiddity create", () => {
  it("hydrates initial state and exposes actions", () => {
    const useStore = createStore<{
      count: number
      inc: () => void
    }>((set) => ({
      count: 0,
      inc: () => set((state) => ({ count: state.count + 1 })),
    }))

    const hook = renderHook(useStore)

    expect(hook.current.count).toBe(0)
    expect(typeof hook.current.inc).toBe("function")

    hook.unmount()
  })

  it("applies sync updates from actions", () => {
    const useStore = createStore<{
      count: number
      inc: () => void
      setCount: (count: number) => void
    }>((set) => ({
      count: 0,
      inc: () => set((state) => ({ count: state.count + 1 })),
      setCount: (count: number) => set({ count }),
    }))

    const hook = renderHook(useStore)

    act(() => {
      hook.current.inc()
    })

    expect(hook.current.count).toBe(1)

    act(() => {
      hook.current.setCount(5)
    })

    expect(hook.current.count).toBe(5)

    hook.unmount()
  })

  it("handles async updates without stale reads", async () => {
    const useStore = createStore<{
      count: number
      delayedInc: (delayMs: number) => Promise<void>
    }>((set) => ({
      count: 0,
      delayedInc: async (delayMs: number) => {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        set((state) => ({ count: state.count + 1 }))
      },
    }))

    const hook = renderHook(useStore)

    await act(async () => {
      await Promise.all([
        hook.current.delayedInc(5),
        hook.current.delayedInc(1),
      ])
    })

    expect(hook.current.count).toBe(2)

    hook.unmount()
  })

  it("merges object updates without dropping other state", () => {
    const useStore = createStore<{
      count: number
      label: string
      setCount: (count: number) => void
    }>((set) => ({
      count: 0,
      label: "a",
      setCount: (count: number) => set({ count }),
    }))

    const hook = renderHook(useStore)

    act(() => {
      hook.current.setCount(3)
    })

    expect(hook.current.count).toBe(3)
    expect(hook.current.label).toBe("a")

    hook.unmount()
  })

  it("applies multiple updates from a single action", () => {
    const useStore = createStore<{
      count: number
      doubleInc: () => void
    }>((set) => ({
      count: 0,
      doubleInc: () => {
        set((state) => ({ count: state.count + 1 }))
        set((state) => ({ count: state.count + 1 }))
      },
    }))

    const hook = renderHook(useStore)

    act(() => {
      hook.current.doubleInc()
    })

    expect(hook.current.count).toBe(2)

    hook.unmount()
  })

  it("updates derived state when backing state changes", () => {
    const useStore = createStore<
      {
        count: number
        inc: () => void
      },
      { doubleCount: number }
    >(
      (set) => ({
        count: 1,
        inc: () => set((state) => ({ count: state.count + 1 })),
      }),
      (state) => ({ doubleCount: state.count * 2 })
    )

    const hook = renderHook(useStore)

    expect(hook.current.doubleCount).toBe(2)

    act(() => {
      hook.current.inc()
    })

    expect(hook.current.count).toBe(2)
    expect(hook.current.doubleCount).toBe(4)

    hook.unmount()
  })

  it("exposes derived functions that read latest state", () => {
    const useStore = createStore<
      {
        count: number
        inc: () => void
      },
      { multBy: (n: number) => number }
    >(
      (set) => ({
        count: 2,
        inc: () => set((state) => ({ count: state.count + 1 })),
      }),
      (state) => ({
        multBy: (n: number) => state.count * n,
      })
    )

    const hook = renderHook(useStore)

    expect(hook.current.multBy(3)).toBe(6)

    act(() => {
      hook.current.inc()
    })

    expect(hook.current.multBy(3)).toBe(9)

    hook.unmount()
  })

  it("infers state and actions with combine", () => {
    const useStore = createStore(
      combine({ count: 0 }, (set) => ({
        inc: () => set((state) => ({ count: state.count + 1 })),
        setCount: (count: number) => set({ count }),
      }))
    )

    const hook = renderHook(useStore)

    expect(hook.current.count).toBe(0)

    act(() => {
      hook.current.inc()
    })

    expect(hook.current.count).toBe(1)

    act(() => {
      hook.current.setCount(5)
    })

    expect(hook.current.count).toBe(5)

    hook.unmount()
  })

  it("infers derived values with combine", () => {
    const useStore = createStore(
      combine({ count: 2 }, (set) => ({
        inc: () => set((state) => ({ count: state.count + 1 })),
      })),
      (state) => ({ doubleCount: state.count * 2 })
    )

    const hook = renderHook(useStore)

    expect(hook.current.doubleCount).toBe(4)

    act(() => {
      hook.current.inc()
    })

    expect(hook.current.doubleCount).toBe(6)

    hook.unmount()
  })

  it("merges combine state and actions", () => {
    const useStore = createStore(
      combine({ count: 0, label: "ok" }, (set) => ({
        setLabel: (label: string) => set({ label }),
      }))
    )

    const hook = renderHook(useStore)

    expect(hook.current.count).toBe(0)
    expect(hook.current.label).toBe("ok")

    act(() => {
      hook.current.setLabel("next")
    })

    expect(hook.current.label).toBe("next")

    hook.unmount()
  })

  it("supports object updates with combine", () => {
    const useStore = createStore(
      combine({ count: 0 }, (set) => ({
        setCount: (count: number) => set({ count }),
      }))
    )

    const hook = renderHook(useStore)

    act(() => {
      hook.current.setCount(12)
    })

    expect(hook.current.count).toBe(12)

    hook.unmount()
  })

  it("throws when combine actions overlap state keys", () => {
    // @ts-expect-error overlap should be rejected by types, but test runtime too
    const useStore = createStore(
      combine({ count: 0 }, (set) => ({
        count: () => set({ count: 1 }),
      }))
    )

    expect(() => renderHook(useStore)).toThrow(
      "combine keys overlap: count"
    )
  })

  it("throws when derived keys overlap state or actions", () => {
    // @ts-expect-error overlap should be rejected by types, but test runtime too
    const useStore = createStore(
      (set) => ({
        count: 0,
        inc: () => set((state) => ({ count: state.count + 1 })),
      }),
      (state) => ({
        count: state.count + 1,
      })
    )

    expect(() => renderHook(useStore)).toThrow(
      "derive keys overlap: count"
    )
  })
})
