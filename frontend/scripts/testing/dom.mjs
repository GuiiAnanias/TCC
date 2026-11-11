import { JSDOM } from "jsdom";
import React, { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../src/ThemeContext.jsx";

export function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const originals = new Map();
  const values = {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: (callback) => {
      callback();
      return 1;
    },
    cancelAnimationFrame: () => {},
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [key, value] of Object.entries(values)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  return () => {
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
}

export async function mount(element, { initialEntries } = {}) {
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (child) =>
    act(async () =>
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries },
          React.createElement(ThemeProvider, null, child),
        ),
      ),
    );
  await render(element);
  return {
    container,
    render,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

export async function click(element) {
  if (!element) throw new Error("Controle não encontrado no teste.");
  await act(async () => element.click());
}

export async function change(element, value) {
  await act(async () => {
    const prototype = Object.getPrototypeOf(element);
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(
      new window.Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }),
    );
  });
}
