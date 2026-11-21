/**
 * [COMPONENTE] Seleção com busca (colaborador, projeto, cliente): lista filtrada pelo texto
 * digitado, limitada aos 20 primeiros resultados para evitar travamentos, navegável pelo teclado.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export const LIMITE_OPCOES_BUSCA = 20;

export function SelecaoComBusca({
  id,
  name,
  options = [],
  value = "",
  onChange,
  placeholder = "Selecione...",
  required = false,
  disabled = false,
  error = "",
  maxResults = LIMITE_OPCOES_BUSCA,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const selectedOption = useMemo(
    () =>
      options.find(
        (option) => String(option.value) === String(value) && String(option.value) !== "",
      ) || options.find((option) => String(option.value) === String(value)),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      String(option.label).toLocaleLowerCase("pt-BR").includes(normalizedQuery),
    );
  }, [options, query]);

  const visibleOptions = useMemo(
    () => filteredOptions.slice(0, maxResults),
    [filteredOptions, maxResults],
  );

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
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  function selectOption(option) {
    onChange?.({
      target: {
        name,
        value: String(option.value),
      },
    });

    setOpen(false);
    setQuery("");
    rootRef.current?.querySelector(".searchable-select__control")?.focus();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div
      className={`searchable-select${open ? " is-open" : ""}`}
      ref={rootRef}
      onKeyDown={handleKeyDown}
    >
      <button
        id={id || name}
        className="searchable-select__control"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id || name}-error` : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={selectedOption ? "searchable-select__value" : "searchable-select__placeholder"}
        >
          {selectedOption?.label || placeholder}
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
              aria-label={`Buscar opções de ${name || "seleção"}`}
              autoComplete="off"
            />
          </div>

          <div className="searchable-select__options" role="listbox" aria-labelledby={id || name}>
            {visibleOptions.length ? (
              <>
                {visibleOptions.map((option) => {
                  const selected = String(option.value) === String(value);

                  return (
                    <button
                      key={option.value}
                      className={`searchable-select__option${selected ? " is-selected" : ""}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectOption(option)}
                    >
                      <span>{option.label}</span>
                      {selected ? <Check size={17} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
                {filteredOptions.length > visibleOptions.length ? (
                  <div className="searchable-select__empty">
                    Mostrando {visibleOptions.length} de {filteredOptions.length} resultados. Digite
                    para refinar a busca.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="searchable-select__empty">Nenhum resultado encontrado.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
