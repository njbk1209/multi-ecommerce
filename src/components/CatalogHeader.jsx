import React, { useState, useRef, useEffect } from 'react'
import { Search, ArrowUpDown, SlidersHorizontal, X, ChevronDown } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'price_asc', label: 'Precio: Menor a Mayor' },
  { value: 'price_desc', label: 'Precio: Mayor a Menor' },
  { value: 'name_asc', label: 'Nombre: A-Z' },
  { value: 'name_desc', label: 'Nombre: Z-A' },
]

const CatalogHeader = ({
  searchQuery,
  onSearch,
  sortBy,
  onSortChange,
  isFiltersOpen,
  onToggleFilters,
  activeFilterCount,
}) => {
  const [inputValue, setInputValue] = useState(searchQuery || '')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const sortRef = useRef(null)

  // Sync input when searchQuery is cleared externally
  useEffect(() => {
    if (searchQuery === '') setInputValue('')
  }, [searchQuery])

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmitSearch = (e) => {
    e?.preventDefault()
    onSearch(inputValue.trim())
  }

  const handleClearSearch = () => {
    setInputValue('')
    onSearch('')
  }

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Ordenar'

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Barra de búsqueda */}
        <form
          onSubmit={handleSubmitSearch}
          className="flex-1 flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-gray-400"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-xl transition-all duration-200 active:scale-95 shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </form>

        {/* Controles de ordenar y filtrar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dropdown Ordenar */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setIsSortOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all duration-200 ${isSortOpen
                ? 'border-primary-dark bg-primary-light text-primary'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden md:inline">{currentSortLabel}</span>
              <span className="md:hidden">Ordenar</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSortOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-40 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSortChange(option.value)
                      setIsSortOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${sortBy === option.value
                      ? 'bg-primary-light text-primary font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botón Filtrar */}
          <button
            onClick={onToggleFilters}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all duration-200 relative ${isFiltersOpen
              ? 'border-primary-dark bg-primary-light text-primary'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filtrar</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary-dark text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export { SORT_OPTIONS }
export default CatalogHeader
