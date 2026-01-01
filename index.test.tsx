import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { act } from "react"
import { create } from "react-test-renderer"
import { create as createStore } from "./index"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const ignoredWarnings = new Set([
  "react-test-renderer is deprecated.",
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

  let renderer: ReturnType<typeof create> | null = null

  act(() => {
    renderer = create(<Test />)
  })

  return {
    get current() {
      return latest
    },
    unmount() {
      renderer?.unmount()
    },
  }
}

describe("quiddity create", () => {
  it("hydrates initial state and exposes actions", () => {
    const useStore = createStore({ count: 0 }, (set) => ({
      inc: () => set((state) => ({ count: state.count + 1 })),
    }))

    const hook = renderHook(useStore)

    expect(hook.current.count).toBe(0)
    expect(typeof hook.current.inc).toBe("function")

    hook.unmount()
  })

  it("applies sync updates from actions", () => {
    const useStore = createStore({ count: 0 }, (set) => ({
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
    const useStore = createStore({ count: 0 }, (set) => ({
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
    const useStore = createStore({ count: 0, label: "a" }, (set) => ({
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
    const useStore = createStore({ count: 0 }, (set) => ({
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
})
