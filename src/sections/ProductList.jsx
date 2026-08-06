// ProductList.jsx

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ProductCard from "../components/ProductCard";
import CatalogHeader from "../components/CatalogHeader";
import CatalogFilters from "../components/CatalogFilters";
import CatalogEmpty from "../components/CatalogEmpty";
import { Transition } from "@headlessui/react";
import { X } from "lucide-react";
import { supabase } from "../utils/supabase";
import { useCurrency } from "../context/CurrencyContext";
import { buildCategoryTree } from "../components/CategoriesManager";
import { parseYearTermsFromQuery, getProductIdsMatchingYears } from "../utils/yearSearch";
import { evaluarPromocionProducto } from "../utils/promotionEngine";

const ITEMS_PER_PAGE = 16;

const DEFAULT_FILTERS = {
  categories: [],
  hasDiscount: false,
  selectedPromoId: '',
  priceMin: '',
  priceMax: '',
  inStockOnly: false,
  vehicle: { marcaId: '', modeloId: '', generacionId: '' },
};

const ProductList = () => {
  const { store, exchangeRate, promotions } = useCurrency();

  // Data states
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const catalogTopRef = useRef(null);

  // Categories
  const [rawCategories, setRawCategories] = useState([]);

  // Search, Sort, Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Scroll to top on page change
  useEffect(() => {
    if (!loading && catalogTopRef.current && currentPage > 1) {
      const y =
        catalogTopRef.current.getBoundingClientRect().top +
        window.pageYOffset -
        40;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, [currentPage, loading]);

  // 1. Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      if (!store) return;
      try {
        const { data, error } = await supabase
          .from("category")
          .select("id, name, parent, slug")
          .eq("store", store.id)
          .order("name", { ascending: true });

        if (error) throw error;
        setRawCategories(data || []);
      } catch (err) {
        console.error("Error al cargar categorías:", err);
      }
    };
    fetchCategories();
  }, [store]);

  const categoryTree = useMemo(() => {
    return buildCategoryTree(rawCategories, null, 0);
  }, [rawCategories]);

  // Helper to resolve category + subcategories
  const getCategoryAndSubcategoryNames = useCallback((categoryNames) => {
    if (!categoryNames || categoryNames.length === 0) return [];

    const allNames = [];
    categoryNames.forEach(catName => {
      const active = rawCategories.find((c) => c.name === catName);
      if (!active) {
        allNames.push(catName);
        return;
      }
      allNames.push(active.name);
      const collectChildren = (parentId) => {
        const children = rawCategories.filter((c) => c.parent === parentId);
        children.forEach((child) => {
          allNames.push(child.name);
          collectChildren(child.id);
        });
      };
      collectChildren(active.id);
    });

    return [...new Set(allNames)];
  }, [rawCategories]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.hasDiscount) count++;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.inStockOnly) count++;
    if (filters.vehicle?.marcaId || filters.vehicle?.modeloId || filters.vehicle?.generacionId) count++;
    return count;
  }, [filters]);

  // 2. Fetch products with search, sort, filters, pagination
  useEffect(() => {
    const fetchProducts = async () => {
      if (!store) return;
      setLoading(true);
      setError(null);
      try {
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        // Decide if we need inner join on category
        const hasCategoryFilter = filters.categories.length > 0;
        const targetCategoryNames = hasCategoryFilter
          ? getCategoryAndSubcategoryNames(filters.categories)
          : [];

        const selectFields = hasCategoryFilter
          ? "*, category:category!producto_category_fkey!inner(name), ProductImagen(*), producto_grupo_relacion(orden, producto_opciones_grupo(id,nombre,es_obligatorio,es_multiple,producto_opciones_valor(id,nombre,modificador_precio,modificador_precio_comparacion)))"
          : "*, category:category!producto_category_fkey(name), ProductImagen(*), producto_grupo_relacion(orden, producto_opciones_grupo(id,nombre,es_obligatorio,es_multiple,producto_opciones_valor(id,nombre,modificador_precio,modificador_precio_comparacion)))";

        let query = supabase
          .from("producto")
          .select(selectFields, { count: "exact" })
          .eq("store", store.id)
          .eq("is_active", true);

        // Vehicle fitment filter
        const vehFilter = filters.vehicle;
        if (vehFilter && (vehFilter.generacionId || vehFilter.modeloId || vehFilter.marcaId)) {
          let compQuery = supabase.from("producto_compatibilidad").select("producto_id");

          if (vehFilter.generacionId) {
            compQuery = compQuery.eq("generacion_id", parseInt(vehFilter.generacionId));
          } else if (vehFilter.modeloId) {
            compQuery = compQuery.eq("modelo_id", parseInt(vehFilter.modeloId));
          } else if (vehFilter.marcaId) {
            const { data: marcaModelos } = await supabase
              .from("vehiculo_modelo")
              .select("id")
              .eq("marca_id", parseInt(vehFilter.marcaId));

            const modIds = (marcaModelos || []).map(m => m.id);
            if (modIds.length > 0) {
              compQuery = compQuery.in("modelo_id", modIds);
            } else {
              compQuery = null;
            }
          }

          if (compQuery) {
            const { data: compData } = await compQuery;
            const compatibleProductIds = [...new Set((compData || []).map(c => c.producto_id))];

            if (compatibleProductIds.length === 0) {
              setProducts([]);
              setTotalPages(1);
              setLoading(false);
              return;
            }

            query = query.in("id", compatibleProductIds);
          } else {
            setProducts([]);
            setTotalPages(1);
            setLoading(false);
            return;
          }
        }

        // Category filter
        if (hasCategoryFilter) {
          query = query.in("category.name", targetCategoryNames);
        }

        // Search filter (Multi-term inteligente con rangos de años para repuestos y productos)
        if (searchQuery && searchQuery.trim()) {
          const { textTerms, yearNumbers } = parseYearTermsFromQuery(searchQuery);

          // 1. Si hay términos de año (ej: 2003), obtener IDs de productos que coincidan por rango o por vehiculo_generacion
          let yearMatchedProductIds = null;
          if (yearNumbers.length > 0) {
            yearMatchedProductIds = await getProductIdsMatchingYears(supabase, store.id, yearNumbers);
            if (yearMatchedProductIds.length === 0) {
              setProducts([]);
              setTotalPages(1);
              setLoading(false);
              return;
            }
          }

          // 2. Términos significativos para la búsqueda de texto
          const termsToUse = textTerms.length > 0 ? textTerms : (yearNumbers.length > 0 ? [] : [searchQuery.trim()]);

          // Obtener referencias cruzadas por término si existen
          const crossRefMapByTerm = {};
          if (termsToUse.length > 0) {
            try {
              const { data: refData } = await supabase
                .from("producto_referencia_cruzada")
                .select("producto_id, codigo_referencia");

              if (refData && refData.length > 0) {
                termsToUse.forEach(term => {
                  const cleanT = term.toLowerCase().trim();
                  if (!cleanT) return;
                  const matchingIds = refData
                    .filter(r => r.codigo_referencia && r.codigo_referencia.toLowerCase().includes(cleanT))
                    .map(r => r.producto_id);
                  if (matchingIds.length > 0) {
                    crossRefMapByTerm[term] = [...new Set(matchingIds)];
                  }
                });
              }
            } catch (e) {
              console.error("Error al buscar referencias cruzadas:", e);
            }
          }

          // Aplicar cada término a la consulta. Cada término debe coincidir en alguno de los campos de texto O en referencia cruzada
          if (termsToUse.length > 0) {
            termsToUse.forEach(term => {
              const cleanTerm = term.trim();
              if (cleanTerm) {
                let termCondition = `name.ilike.%${cleanTerm}%,description.ilike.%${cleanTerm}%,sku.ilike.%${cleanTerm}%,oem_number.ilike.%${cleanTerm}%,part_number_fabricante.ilike.%${cleanTerm}%`;
                
                const crossRefIds = crossRefMapByTerm[term];
                if (crossRefIds && crossRefIds.length > 0) {
                  termCondition += `,id.in.(${crossRefIds.join(",")})`;
                }

                query = query.or(termCondition);
              }
            });
          }

          // 3. Aplicar filtro por IDs coincidentes de año
          if (yearMatchedProductIds && yearMatchedProductIds.length > 0) {
            query = query.in("id", yearMatchedProductIds);
          }
        }

        // Price range filters
        if (filters.priceMin) {
          query = query.gte("price", parseFloat(filters.priceMin));
        }
        if (filters.priceMax) {
          query = query.lte("price", parseFloat(filters.priceMax));
        }

        // Stock filter
        if (filters.inStockOnly) {
          query = query.gt("stock", 0);
        }

        // Discount filter (products where compare_price exists and is greater than price)
        if (filters.hasDiscount) {
          query = query.not("compare_price", "is", null).gt("compare_price", 0);
        }

        // Sorting
        switch (sortBy) {
          case 'oldest':
            query = query.order("created_at", { ascending: true });
            break;
          case 'price_asc':
            query = query.order("price", { ascending: true });
            break;
          case 'price_desc':
            query = query.order("price", { ascending: false });
            break;
          case 'name_asc':
            query = query.order("name", { ascending: true });
            break;
          case 'name_desc':
            query = query.order("name", { ascending: false });
            break;
          case 'newest':
          default:
            query = query.order("created_at", { ascending: false });
            break;
        }

        const { data, error: prodError, count } = await query.range(from, to);

        if (prodError) throw prodError;

        // Map products to UI format
        const mapped = (data || []).map((product) => {
          const sortedRel = [...(product.producto_grupo_relacion || [])].sort(
            (a, b) => (a.orden ?? 1) - (b.orden ?? 1),
          );

          const optionGroups = sortedRel
            .map((rel) => rel.producto_opciones_grupo)
            .filter(Boolean);

          let priceNum = parseFloat(product.price) || 0;
          let comparePriceNum = product.compare_price
            ? parseFloat(product.compare_price)
            : null;

          if (product.precio_por_tamano && optionGroups.length > 0) {
            const sizeGroup =
              optionGroups.find((g) => g.es_obligatorio && !g.es_multiple) ||
              optionGroups[0];
            if (sizeGroup && sizeGroup.producto_opciones_valor?.length > 0) {
              const prices = sizeGroup.producto_opciones_valor.map(
                (v) => parseFloat(v.modificador_precio) || 0,
              );
              const minPrice = Math.min(...prices);
              priceNum = minPrice;

              const minPriceIndex = prices.indexOf(minPrice);
              const matchingComparePrice =
                sizeGroup.producto_opciones_valor[minPriceIndex]
                  ?.modificador_precio_comparacion;
              comparePriceNum = matchingComparePrice
                ? parseFloat(matchingComparePrice)
                : null;
            }
          }

          const exchange = exchangeRate || 1;
          const price_bs = priceNum * exchange;
          const compare_price_bs = comparePriceNum
            ? comparePriceNum * exchange
            : null;

          let discount_percent = 0;
          if (comparePriceNum && comparePriceNum > priceNum) {
            discount_percent = Math.round(
              ((comparePriceNum - priceNum) / comparePriceNum) * 100,
            );
          }

          const images =
            product.ProductImagen?.map((img) => ({
              id: img.id,
              image: img.url,
              is_main: img.is_primary,
            })) || [];

          const hasModifiers = optionGroups.length > 0;

          return {
            ...product,
            name: product.name || product.sku || "Producto sin nombre",
            category: product.category?.name || "Varios",
            price: priceNum,
            compare_price: comparePriceNum,
            price_bs,
            compare_price_bs,
            discount_percent,
            images,
            precio_por_tamano: product.precio_por_tamano,
            hasModifiers,
            optionGroups,
          };
        });

        setProducts(mapped);
        setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [currentPage, searchQuery, sortBy, filters, store, exchangeRate, rawCategories, getCategoryAndSubcategoryNames]);

  // Reset page when search/sort/filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filters]);

  // Handlers
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
  };

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    // Filters are already applied via state change; optionally close panel
  };

  const handleClearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  const handleRetry = () => {
    setError(null);
    setCurrentPage(1);
  };

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const activePromoObj = useMemo(() => {
    if (!filters.selectedPromoId || !Array.isArray(promotions)) return null;
    return promotions.find((p) => String(p.id) === String(filters.selectedPromoId)) || null;
  }, [filters.selectedPromoId, promotions]);

  const filteredProducts = useMemo(() => {
    let result = products;

    // 1. Filtrar por promoción específica seleccionada
    if (activePromoObj) {
      const rules = activePromoObj.promocion_regla || activePromoObj.reglas || [];
      const targetSkus = new Set(
        rules.map((r) => String(r.sku || "").trim().toLowerCase()).filter(Boolean)
      );
      const targetCatIds = new Set(
        rules.map((r) => String(r.category_id || "")).filter(Boolean)
      );

      result = result.filter((p) => {
        const skuVal = String(p.sku || p.codigo_barra || p.barcode || "").trim().toLowerCase();
        const catVal = String(p.category_id || p.category || "");
        return targetSkus.has(skuVal) || targetCatIds.has(catVal);
      });
    }

    // 2. Filtrar por ofertas/descuentos generales
    if (filters.hasDiscount) {
      result = result.filter((p) => {
        const hasStaticDiscount = p.compare_price && parseFloat(p.compare_price) > parseFloat(p.price);
        const promoEval = evaluarPromocionProducto(p, 1, promotions);
        return hasStaticDiscount || promoEval.tienePromocion;
      });
    }

    return result;
  }, [products, activePromoObj, filters.hasDiscount, promotions]);

  if (!store) {
    return (
      <div className="py-20 text-center text-primary-dark animate-pulse font-serif">
        Cargando tienda...
      </div>
    );
  }

  return (
    <div
      ref={catalogTopRef}
      id="catalogo"
      className="max-w-6xl mx-auto px-4 py-6"
    >
      {/* Título del catálogo */}
      <div className="mb-6">
        <h2 className="text-3xl font-semibold text-primary-dark font-serif">
          Nuestro Catálogo
        </h2>
        <div className="h-1 w-16 bg-primary-light mt-2"></div>
      </div>

      {/* Header: Búsqueda + Ordenar + Filtrar */}
      <div className="mb-6">
        <CatalogHeader
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          isFiltersOpen={isFiltersOpen}
          onToggleFilters={() => setIsFiltersOpen(prev => !prev)}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Drawer de Filtros */}
      <CatalogFilters
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        categoryTree={categoryTree}
        promotions={promotions}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {/* Chips de Filtros Activos */}
      {(searchQuery || activeFilterCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">
            Filtros activos:
          </span>

          {/* Búsqueda */}
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-light text-primary-dark border border-primary-light shadow-2xs">
              Búsqueda: "{searchQuery}"
              <button
                onClick={() => setSearchQuery('')}
                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors cursor-pointer"
                title="Eliminar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {/* Promoción específica seleccionada */}
          {activePromoObj && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
              🏷️ Promo: {activePromoObj.nombre}
              <button
                onClick={() => setFilters((prev) => ({ ...prev, selectedPromoId: "" }))}
                className="p-0.5 hover:bg-amber-200 rounded-full transition-colors cursor-pointer"
                title="Quitar filtro de promoción"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {/* Categorías */}
          {filters.categories.map((catName) => (
            <span
              key={catName}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-light text-primary-dark border border-primary-light shadow-2xs"
            >
              Categoría: {catName}
              <button
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    categories: prev.categories.filter((c) => c !== catName),
                  }))
                }
                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors cursor-pointer"
                title="Eliminar categoría"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}

          {/* Descuentos */}
          {filters.hasDiscount && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-light text-primary-dark border border-primary-light shadow-2xs">
              Con oferta / promoción
              <button
                onClick={() => setFilters((prev) => ({ ...prev, hasDiscount: false }))}
                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors cursor-pointer"
                title="Eliminar filtro"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {/* Precio Mín */}
          {filters.priceMin && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-light text-primary-dark border border-primary-light shadow-2xs">
              Precio Mín: ${filters.priceMin}
              <button
                onClick={() => setFilters((prev) => ({ ...prev, priceMin: '' }))}
                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors cursor-pointer"
                title="Eliminar filtro"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {/* Precio Máx */}
          {filters.priceMax && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-light text-primary-dark border border-primary-light shadow-2xs">
              Precio Máx: ${filters.priceMax}
              <button
                onClick={() => setFilters((prev) => ({ ...prev, priceMax: '' }))}
                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors cursor-pointer"
                title="Eliminar filtro"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {/* Disponibilidad */}
          {filters.inStockOnly && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-light text-primary-dark border border-primary-light shadow-2xs">
              En stock
              <button
                onClick={() => setFilters((prev) => ({ ...prev, inStockOnly: false }))}
                className="p-0.5 hover:bg-primary/20 rounded-full transition-colors cursor-pointer"
                title="Eliminar filtro"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {/* Botón limpiar todos */}
          <button
            onClick={() => {
              setSearchQuery('');
              setFilters({ ...DEFAULT_FILTERS });
            }}
            className="text-xs font-semibold text-gray-500 hover:text-red-600 transition-colors underline ml-1 cursor-pointer"
          >
            Limpiar todos
          </button>
        </div>
      )}

      {/* Contenido principal */}
      <div className="relative min-h-[400px]">
        {/* Loader */}
        <Transition
          show={loading}
          appear={true}
          enter="transition-all duration-300 ease-out"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="transition-all duration-300 ease-in"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
          className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] z-20 py-20 rounded-2xl"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-primary-light animate-pulse"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-primary-dark font-serif animate-pulse tracking-widest uppercase">
              Cargando catálogo...
            </p>
          </div>
        </Transition>

        {/* Error state */}
        {!loading && error && (
          <CatalogEmpty
            variant="error"
            subtitle={error}
            actionLabel="Reintentar"
            onAction={handleRetry}
          />
        )}

        {/* Empty / No results state */}
        {!loading && !error && filteredProducts.length === 0 && (
          <CatalogEmpty
            variant={searchQuery || activeFilterCount > 0 ? 'noResults' : 'empty'}
            actionLabel={searchQuery || activeFilterCount > 0 ? 'Limpiar filtros' : undefined}
            onAction={searchQuery || activeFilterCount > 0 ? () => {
              handleClearFilters();
              setSearchQuery('');
            } : undefined}
          />
        )}

        {/* Product grid */}
        <Transition
          show={!loading && !error && filteredProducts.length > 0}
          appear={true}
          enter="transition-all duration-500 delay-150 ease-out"
          enterFrom="opacity-0 translate-y-6"
          enterTo="opacity-100 translate-y-0"
          leave="transition-all duration-300 ease-in"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 -translate-y-6"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        </Transition>
      </div>

      {/* Paginación */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-12 flex justify-center items-center gap-2 sm:gap-3">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="px-3 sm:px-4 py-2 text-sm bg-white border border-primary-light text-primary rounded-lg disabled:opacity-30 transition-colors hover:bg-primary-light/50"
          >
            Anterior
          </button>

          <div className="flex gap-1 sm:gap-1.5">
            {getPageNumbers().map((page, i) =>
              page === '...' ? (
                <span
                  key={`ellipsis-${i}`}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm"
                >
                  …
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${currentPage === page
                    ? "bg-primary text-white shadow-md"
                    : "text-primary hover:bg-primary-light/50"
                    }`}
                >
                  {page}
                </button>
              )
            )}
          </div>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className="px-3 sm:px-4 py-2 text-sm bg-white border border-primary-light text-primary rounded-lg disabled:opacity-30 transition-colors hover:bg-primary-light/50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductList;
