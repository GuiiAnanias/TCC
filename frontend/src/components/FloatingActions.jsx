import React, { useLayoutEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ThemeToggle } from "../ThemeContext.jsx";

export function FloatingActions({ onRefresh, loading }) {
  const [position, setPosition] = useState({ x: 0, y: 16, docked: false, rail: false });
  const [moving, setMoving] = useState(false);
  const toolbar = useRef(null);
  const currentPosition = useRef(position);
  const pendingFlight = useRef(null);
  const flight = useRef({ id: 0, ghosts: [], animations: [] });
  currentPosition.current = position;

  function clearFlight() {
    flight.current.id++;
    flight.current.animations.forEach((animation) => animation.cancel());
    flight.current.ghosts.forEach((ghost) => ghost.remove());
    flight.current.animations = [];
    flight.current.ghosts = [];
  }

  useLayoutEffect(() => {
    const session = document.querySelector(".sidebar .session-panel");
    let initialized = false;
    const update = () => {
      const docked = window.scrollY > 8 && Boolean(session);
      const rect = session?.getBoundingClientRect();
      const rail = docked && rect.width < 100;
      const width = rail ? 52 : 196;
      const height = rail ? 104 : 64;
      const padding = rail ? 7 : 12;
      const inset = window.innerWidth <= 600 ? 6 : 16;
      const gap = session ? parseFloat(getComputedStyle(session).paddingTop) : 18;
      const next = {
        docked, rail,
        x: docked ? rect.left + (rect.width - width) / 2 : document.documentElement.clientWidth - width - inset,
        y: docked ? rect.top - gap - height + padding : inset
      };
      const previous = currentPosition.current;
      if (Object.keys(next).every((key) => next[key] === previous[key])) {
        initialized = true;
        return;
      }
      if (initialized && previous.docked !== docked) {
        pendingFlight.current = [...toolbar.current.querySelectorAll("button")].map((button, index) => {
          const source = flight.current.ghosts
            .filter((ghost) => Number(ghost.dataset.actionIndex) === index)
            .sort((a, b) => Number(getComputedStyle(b).opacity) - Number(getComputedStyle(a).opacity))[0] || button;
          const bounds = source.getBoundingClientRect();
          const style = getComputedStyle(source);
          const clone = source.cloneNode(true);
          [...clone.children].forEach((child, childIndex) => {
            child.style.display = getComputedStyle(source.children[childIndex]).display;
          });
          return {
            x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2,
            width: bounds.width, height: bounds.height,
            clone, opacity: Number(style.opacity),
            color: style.color, background: style.backgroundColor,
            border: style.border, radius: style.borderRadius, font: style.font
          };
        });
        clearFlight();
        setMoving(true);
      }
      initialized = true;
      currentPosition.current = next;
      setPosition(next);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    if (session) observer.observe(session);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
      clearFlight();
    };
  }, []);

  useLayoutEffect(() => {
    const starts = pendingFlight.current;
    if (!starts) return;
    pendingFlight.current = null;
    const id = flight.current.id;
    const buttons = [...toolbar.current.querySelectorAll("button")];
    const completions = starts.map((start, index) => {
      const target = buttons[index];
      const end = target.getBoundingClientRect();
      const endStyle = getComputedStyle(target);
      const endX = end.left + end.width / 2;
      const endY = end.top + end.height / 2;
      const ghost = start.clone;
      ghost.className = "action-transition";
      ghost.dataset.actionIndex = String(index);
      ghost.setAttribute("aria-hidden", "true");
      ghost.setAttribute("tabindex", "-1");
      ghost.inert = true;
      Object.assign(ghost.style, {
        color: start.color, background: start.background, border: start.border,
        borderRadius: start.radius, font: start.font,
        width: `${start.width}px`, height: `${start.height}px`
      });
      document.body.appendChild(ghost);
      flight.current.ghosts.push(ghost);

      const origin = `translate3d(${start.x}px, ${start.y}px, 0) translate(-50%, -50%)`;
      const fadeOut = ghost.animate([
        { transform: `${origin} scale(1)`, opacity: start.opacity },
        { transform: `${origin} scale(0.65)`, opacity: 0 }
      ], { duration: 110, easing: "ease-in", fill: "both" });
      flight.current.animations.push(fadeOut);
      fadeOut.finished.catch(() => {});

      const incoming = target.cloneNode(true);
      incoming.className = "action-transition";
      incoming.dataset.actionIndex = String(index);
      incoming.setAttribute("aria-hidden", "true");
      incoming.setAttribute("tabindex", "-1");
      incoming.inert = true;
      [...incoming.children].forEach((child, childIndex) => {
        child.style.display = getComputedStyle(target.children[childIndex]).display;
      });
      Object.assign(incoming.style, {
        color: endStyle.color, background: endStyle.backgroundColor, border: endStyle.border,
        borderRadius: endStyle.borderRadius, font: endStyle.font,
        width: `${end.width}px`, height: `${end.height}px`
      });
      document.body.appendChild(incoming);
      flight.current.ghosts.push(incoming);
      const destination = `translate3d(${endX}px, ${endY}px, 0) translate(-50%, -50%)`;
      const fadeIn = incoming.animate([
        { transform: `${destination} scale(0.65)`, opacity: 0 },
        { transform: `${destination} scale(1)`, opacity: 1 }
      ], { duration: 150, delay: 100 + index * 12, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" });
      flight.current.animations.push(fadeIn);
      return fadeIn.finished.catch(() => {});
    });
    Promise.all(completions).then(() => {
      if (flight.current.id !== id) return;
      clearFlight();
      setMoving(false);
    });
  }, [position]);

  return (
    <div ref={toolbar} className={`floating-actions${position.docked ? " is-docked" : ""}${position.rail ? " is-rail" : ""}${moving ? " is-moving" : ""}`}
      style={{ "--actions-x": `${position.x}px`, "--actions-y": `${position.y}px` }}
      role="group" aria-label="Ações da página">
      <button className="secondary-button floating-refresh" type="button" onClick={onRefresh}
        disabled={loading} title="Atualizar" aria-label="Atualizar">
        <RefreshCw size={18} aria-hidden="true" /><span>Atualizar</span>
      </button>
      <ThemeToggle />
    </div>
  );
}
