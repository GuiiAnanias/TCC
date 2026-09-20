import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

export function SearchableSelect({ name, options, value, onChange, placeholder = "Selecione..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(opt) {
    onChange({ target: { name, value: opt.value } });
    setIsOpen(false);
    setSearchTerm("");
  }

  return (
    <div className="searchable-select" ref={dropdownRef}>
      <div className="select-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className={selectedOption ? "" : "placeholder"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} />
      </div>

      {isOpen && (
        <div className="select-dropdown">
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <ul className="options-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <li
                  key={opt.value}
                  className={`option-item ${String(value) === String(opt.value) ? "selected" : ""}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.label}
                </li>
              ))
            ) : (
              <li className="no-options">Nenhum resultado</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
