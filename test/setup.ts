import { Window } from "happy-dom"

const window = new Window()

globalThis.window = window
globalThis.document = window.document
globalThis.navigator = window.navigator

