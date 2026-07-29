import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  noResultsText?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '選択してください',
  searchPlaceholder = 'キーワードで検索...',
  disabled = false,
  className = '',
  noResultsText = '一致する項目が見つかりません'
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUpward: boolean }>({
    top: 0,
    left: 0,
    width: 280,
    openUpward: false
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Update dropdown coordinates relative to viewport
  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 300; // max estimated height of dropdown
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      const calculatedWidth = Math.min(Math.max(rect.width, 240), window.innerWidth > 0 ? window.innerWidth - 16 : 240);
      const calculatedLeft = Math.max(8, Math.min(rect.left, window.innerWidth - calculatedWidth - 8));

      setCoords({
        top: openUpward ? rect.top - 4 : rect.bottom + 4,
        left: calculatedLeft,
        width: calculatedWidth,
        openUpward
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleScrollOrResize = () => {
        updateCoords();
      };
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchLabel = opt.label.toLowerCase().includes(q);
    const matchSub = opt.subLabel ? opt.subLabel.toLowerCase().includes(q) : false;
    const matchVal = opt.value.toLowerCase().includes(q);
    return matchLabel || matchSub || matchVal;
  });

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs border rounded-lg bg-white cursor-pointer select-none transition-all ${
          disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex-1 min-w-0 pr-2">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-800 truncate">{selectedOption.label}</span>
              {selectedOption.subLabel && (
                <span className="text-[10px] text-slate-400 font-mono truncate">
                  ({selectedOption.subLabel})
                </span>
              )}
              {selectedOption.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium shrink-0">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              title="選択を解除"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Floating Portal Dropdown Panel */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: coords.openUpward ? 'auto' : `${coords.top}px`,
              bottom: coords.openUpward ? `${window.innerHeight - coords.top}px` : 'auto',
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999
            }}
            className="bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Search Input Box */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-50 py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400">
                  {noResultsText}
                </div>
              ) : (
                filteredOptions.map(opt => {
                  const isSelected = opt.value === value;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{opt.label}</span>
                          {opt.badge && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.subLabel && (
                          <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                            {opt.subLabel}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
