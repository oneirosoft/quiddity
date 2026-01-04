import { Window } from "happy-dom"

const window = new Window()
const globalScope = globalThis as unknown as {
  window: Window
  document: Document
  navigator: Navigator
}

globalScope.window = window
globalScope.document = window.document as unknown as Document
globalScope.navigator = window.navigator as unknown as Navigator
