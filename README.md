# @oneirosoft/quiddity

Local-first React state helpers that keep the API small and the updates clear.

## 📦 Install

```bash
bun add @oneirosoft/quiddity
```

## 🧠 Core Idea

`create` builds a local store hook. Each component that calls the hook gets its
own isolated state and actions. Updates are always partial merges of state and
are driven through a `set` function you define inside your actions.

## 🚀 Quick Start

```ts
import { create } from "@oneirosoft/quiddity"

const useCounter = create((set) => ({
  count: 0,
  label: "Clicks",
  inc: (by = 1) => set((state) => ({ count: state.count + by })),
  setLabel: (label: string) => set({ label }),
}))

export function Counter() {
  const store = useCounter()

  return (
    <button onClick={() => store.inc()}>
      {store.label}: {store.count}
    </button>
  )
}
```

## 🧩 Object-Only Store (state + actions together)

```ts
import { create } from "@oneirosoft/quiddity"

const useToggle = create((set) => ({
  on: false,
  toggle: () => set((state) => ({ on: !state.on })),
}))

export function Toggle() {
  const store = useToggle()
  return <button onClick={store.toggle}>{store.on ? "On" : "Off"}</button>
}
```

## 🧰 API Shape

```ts
create(builder)
create(builder, derive?)

// builder signature
type Builder<S> = (set: (update: Partial<S> | ((s: S) => Partial<S>)) => void) => S

// optional derive signature
type Derive<S, D> = (state: S) => D
```

`create` returns a hook:

```ts
const useStore = create(...)
const store = useStore()
```

`store` is the merged object of:
- your actions
- current state values

## 🧪 How Updates Work

- `set` accepts a partial object or an updater function.
- Updates are merged into current state (shallow merge).
- Only non-function keys are considered state. Functions are treated as actions.

## 🧮 Derived Values

```ts
const useCounter = create(
  (set) => ({
    count: 0,
    inc: () => set((s) => ({ count: s.count + 1 })),
  }),
  (state) => ({ doubleCount: state.count * 2 })
)

const store = useCounter()
// store.doubleCount is a derived value
```

Derived values are computed from state on render and are read-only. They update
whenever the underlying state changes, but they do not participate in `set`
updates directly.

## 🎯 Rendering Behavior (important)

- The store is **local** to each component instance.
- Any state update triggers a re-render of the component using the hook.
- Destructuring fewer fields does **not** avoid re-renders.
- To isolate re-renders, split state into multiple hooks or components.

## ✅ Usage Notes

- Keep state serializable (it is read via object entries).
- Actions can call `set` multiple times; updates are merged in order.
- This library is intentionally minimal and does not provide global stores.
