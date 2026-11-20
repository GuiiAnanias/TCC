/**
 * [COMPONENTE] Seleção múltipla com busca (ex.: filtro de projetos do dashboard).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

/**
 * Seleção de vários itens com busca, no mesmo visual do SelecaoComBusca.
 * `value` é uma lista de valores (texto) e `onChange` recebe { target: { name, value } }.
 */
export function SelecaoMultipla({
  id,
  name,
  options = [],
  value = [],
  onChange,
  placeholder = "Todos",
  plural = "itens",
  disabled = false,
  labelledBy,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const selected = useMemo(() => new Set(value.map(String)), [value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      String(option.label).toLocaleLowerCase("pt-BR").includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  function emit(next) {
    // Mantém a ordem da lista de opções, não a ordem dos cliques.
    const ordered = options.map((option) => String(option.value)).filter((item) => next.has(item));
    onChange?.({ target: { name, value: ordered } });
  }

  function toggle(option) {
    const next = new Set(selected);
    const key = String(option.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    emit(next);
  }

  const chosen = options.filter((option) => selected.has(String(option.value)));
  const summary =
    chosen.length === 0
      ? placeholder
      : chosen.length === 1
        ? chosen[0].label
        : `${chosen.length} ${plural}`;

  return (
    <div
      className={`searchable-select multi-select${open ? " is-open" : ""}`}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <button
        id={id || name}
        className="searchable-select__control"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelledBy ? `${labelledBy} ${id || name}` : undefined}
        disabled={disabled}
        title={chosen.length > 1 ? chosen.map((option) => option.label).join(", ") : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={chosen.length ? "searchable-select__value" : "searchable-select__placeholder"}
        >
          {summary}
        </span>
        <ChevronDown className="searchable-select__chevron" size={18} aria-hidden="true" />
      </button>

      {open ? (
        <div className="searchable-select__dropdown">
          <div className="searchable-select__search">
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Digite para buscar..."
              aria-label={`Buscar ${plural}`}
              autoComplete="off"
            />
          </div>

          <div
            className="searchable-select__options"
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={id || name}
          >
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = selected.has(String(option.value));
                return (
                  <button
                    key={option.value}
                    className={`searchable-select__option${isSelected ? " is-selected" : ""}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(option)}
                  >
                    <span className="multi-select__box" aria-hidden="true">
                      {isSelected ? <Check size={14} /> : null}
                    </span>
                    <span>{option.label}</span>
                  </button>
                );
              })
            ) : (
              <div className="searchable-select__empty">Nenhum resultado encontrado.</div>
            )}
          </div>

          <div className="multi-select__footer">
            <span>
              {chosen.length ? `${chosen.length} de ${options.length} ${plural}` : "Nenhum marcado"}
            </span>
            <button
              type="button"
              className="multi-select__clear"
              disabled={!chosen.length}
              onClick={() => emit(new Set())}
            >
              Limpar seleção
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
