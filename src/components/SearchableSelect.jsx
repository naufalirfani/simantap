import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

const SearchableSelect = ({ value, onChange, options, placeholder, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Calculate dropdown position
  useEffect(() => {
    if (isOpen && dropdownRef.current && inputRef.current) {
      const updatePosition = () => {
        const anchor = inputRef.current;
        if (anchor) {
          const rect = anchor.getBoundingClientRect();
          // For fixed positioning, use viewport coordinates (rect) so
          // the dropdown follows the input when inner containers scroll.
          setDropdownPosition({
            top: rect.bottom,
            left: rect.left,
            width: rect.width,
          });
        }
      };

      updatePosition();

      const handleScroll = () => updatePosition();

      // Attach listeners to window and all scrollable ancestor elements so
      // the dropdown follows the input even when an inner container scrolls.
      const ancestors = [];
      let el = dropdownRef.current.parentElement;
      while (el && el !== document.body) {
        try {
          const style = window.getComputedStyle(el);
          const overflowY = style.overflowY;
          if (overflowY === 'auto' || overflowY === 'scroll' || el.scrollHeight > el.clientHeight) {
            ancestors.push(el);
          }
        } catch (e) {
          // ignore cross-origin
        }
        el = el.parentElement;
      }

      ancestors.forEach((a) => a.addEventListener('scroll', handleScroll, { passive: true }));
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll);

      return () => {
        ancestors.forEach((a) => a.removeEventListener('scroll', handleScroll, { passive: true }));
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isOpen]);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get selected option label
  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : '';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'Enter' || e.key === 'ArrowDown')) {
      setIsOpen(true);
      e.preventDefault();
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        break;
      default:
        break;
    }
  };

  const handleSelect = (selectedValue) => {
    onChange(selectedValue);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Input trigger */}
      <div
        className="relative cursor-pointer"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 pr-20 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:text-white cursor-pointer"
          readOnly={!isOpen}
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {value && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded transition-colors cursor-pointer  "
              type="button"
            >
              <svg
                className="w-4 h-4 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div 
          className="fixed z-[9999] mt-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg shadow-lg max-h-60 overflow-auto"
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              Tidak ada data
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  index === highlightedIndex
                    ? 'bg-blue-100 dark:bg-blue-900'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${
                  option.value === value
                    ? 'bg-blue-50 dark:bg-blue-950 font-medium'
                    : ''
                } text-gray-900 dark:text-gray-100`}
              >
                {option.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

SearchableSelect.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  placeholder: PropTypes.string,
  label: PropTypes.string,
};

export default SearchableSelect;
