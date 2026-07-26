// ProductList.jsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import ProductCard from "../components/ProductCard";
import { Transition } from "@headlessui/react";
import { supabase } from "../utils/supabase";
import { useCurrency } from "../context/CurrencyContext";
import { buildCategoryTree } from "../components/CategoriesManager";

const ProductList = () => {
  const { store, exchangeRate } = useCurrency();
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const catalogTopRef = useRef(null);
  const [rawCategories, setRawCategories] = useState([]);

  useEffect(() => {
    if (!loading && catalogTopRef.current) {
      const y =
        catalogTopRef.current.getBoundingClientRect().top +
        window.pageYOffset -
        40;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, [currentPage]);

  // 1. Obtener las categorías relacionales de la tienda activa
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

  // Árbol ordenado de categorías
  const categoryTree = useMemo(() => {
    return buildCategoryTree(rawCategories, null, 0);
  }, [rawCategories]);

  // Helper para resolver recursivamente el nombre de la categoría activa y de todas sus subcategorías
  const getCategoryAndSubcategoryNames = (activeCatName) => {
    if (activeCatName === "Todos") return [];
    const active = rawCategories.find((c) => c.name === activeCatName);
    if (!active) return [activeCatName];

    const names = [active.name];

    const collectChildren = (parentId) => {
      const children = rawCategories.filter((c) => c.parent === parentId);
      children.forEach((child) => {
        names.push(child.name);
        collectChildren(child.id);
      });
    };

    collectChildren(active.id);
    return names;
  };

  // 2. Obtener productos filtrados por tienda y categoría activa (incluyendo subcategorías) con paginación
  useEffect(() => {
    const fetchProducts = async () => {
      if (!store) return;
      setLoading(true);
      setError(null);
      try {
        const from = (currentPage - 1) * 15;
        const to = from + 15 - 1;

        let query;
        if (activeCategory !== "Todos") {
          const targetCategoryNames =
            getCategoryAndSubcategoryNames(activeCategory);
          query = supabase
            .from("producto")
            .select(
              "*, category:category!producto_category_fkey!inner(name), ProductImagen(*), producto_grupo_relacion(orden, producto_opciones_grupo(id,nombre,es_obligatorio,es_multiple,producto_opciones_valor(id,nombre,modificador_precio,modificador_precio_comparacion)))",
              { count: "exact" },
            )
            .eq("store", store.id)
            .eq("is_active", true)
            .in("category.name", targetCategoryNames);
        } else {
          query = supabase
            .from("producto")
            .select(
              "*, category:category!producto_category_fkey(name), ProductImagen(*), producto_grupo_relacion(orden, producto_opciones_grupo(id,nombre,es_obligatorio,es_multiple,producto_opciones_valor(id,nombre,modificador_precio,modificador_precio_comparacion)))",
              { count: "exact" },
            )
            .eq("store", store.id)
            .eq("is_active", true);
        }

        const {
          data,
          error: prodError,
          count,
        } = await query
          .order("created_at", { ascending: false })
          .range(from, to);

        if (prodError) throw prodError;

        // Mapear los productos al formato requerido por la UI
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
        setTotalPages(Math.ceil((count || 0) / 15));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [currentPage, activeCategory, store, exchangeRate, rawCategories]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory]);

  if (!store) {
    return (
      <div className="py-20 text-center text-rose-400 animate-pulse font-serif">
        Cargando tienda...
      </div>
    );
  }

  if (error)
    return (
      <div className="py-20 text-center text-rose-400 font-serif">{error}</div>
    );

  return (
    <div
      ref={catalogTopRef}
      id="catalogo"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-12"
    >
      <div className="flex flex-col lg:flex-row gap-8">
        {/* SIDEBAR DE CATEGORÍAS JERÁRQUICAS */}
        <aside className="hidden lg:block w-64 shrink-0">
          <h3 className="text-sm uppercase tracking-[0.2em] text-gray-400 font-bold mb-6">
            Categorías
          </h3>
          <ul className="space-y-3">
            <li>
              <button
                onClick={() => setActiveCategory("Todos")}
                className={`text-sm transition-all duration-300 ${
                  activeCategory === "Todos"
                    ? "text-rose-500 font-bold translate-x-2"
                    : "text-gray-500 hover:text-rose-400 font-medium"
                }`}
              >
                Todos los Productos
              </button>
            </li>
            {categoryTree.map((cat) => (
              <li
                key={cat.id}
                style={{ paddingLeft: `${cat.depth * 14}px` }}
              >
                <button
                  onClick={() => setActiveCategory(cat.name)}
                  className={`text-sm transition-all duration-300 flex items-center gap-1.5 ${
                    activeCategory === cat.name
                      ? "text-rose-500 font-bold translate-x-2"
                      : "text-gray-600 hover:text-rose-400 font-medium"
                  }`}
                >
                  {cat.depth > 0 && (
                    <span className="text-gray-300 font-mono text-xs">↳</span>
                  )}
                  {cat.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex-1">
          {/* CATEGORÍAS MOBILE */}
          <div className="lg:hidden mb-8 -mx-4 px-4 overflow-x-auto flex flex-nowrap gap-2 no-scrollbar">
            <button
              onClick={() => setActiveCategory("Todos")}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 border ${
                activeCategory === "Todos"
                  ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                  : "bg-white text-rose-400 border-rose-100 hover:border-rose-300"
              }`}
            >
              Todos
            </button>
            {categoryTree.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.name)}
                className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 border ${
                  activeCategory === cat.name
                    ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                    : "bg-white text-rose-400 border-rose-100 hover:border-rose-300"
                }`}
              >
                {cat.depth > 0 ? `↳ ${cat.name}` : cat.name}
              </button>
            ))}
          </div>

          <div className="mb-6 lg:mb-10">
            <h2 className="text-3xl font-semibold text-rose-800 font-serif">
              {activeCategory === "Todos" ? "Nuestro Catálogo" : activeCategory}
            </h2>
            <div className="h-1 w-12 bg-rose-300 mt-2"></div>
          </div>

          <div className="relative min-h-[400px]">
            {/* Loader con animación suave */}
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
                  <div className="absolute inset-0 rounded-full border-4 border-rose-100/80 animate-pulse"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-rose-400 border-t-transparent animate-spin"></div>
                </div>
                <p className="text-sm font-medium text-rose-700 font-serif animate-pulse tracking-widest uppercase">
                  Cargando catálogo...
                </p>
              </div>
            </Transition>

            {/* Contenedor de la lista de productos */}
            <Transition
              show={!loading}
              appear={true}
              enter="transition-all duration-500 delay-150 ease-out"
              enterFrom="opacity-0 translate-y-6"
              enterTo="opacity-100 translate-y-0"
              leave="transition-all duration-300 ease-in"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 -translate-y-6"
            >
              {products.length === 0 ? (
                <div className="py-20 text-center text-rose-400 font-light italic font-serif">
                  No encontramos productos en esta categoría...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                  {products.map((product) => (
                    <ProductCard key={product.id} {...product} />
                  ))}
                </div>
              )}
            </Transition>
          </div>

          {totalPages > 1 && (
            <div className="mt-12 flex justify-center items-center gap-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className="px-4 py-2 text-sm bg-white border border-rose-200 text-rose-500 rounded-lg disabled:opacity-30 transition-colors hover:bg-rose-50"
              >
                Anterior
              </button>

              <div className="flex gap-2">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                      currentPage === i + 1
                        ? "bg-rose-400 text-white shadow-md"
                        : "text-rose-400 hover:bg-rose-50"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className="px-4 py-2 text-sm bg-white border border-rose-200 text-rose-500 rounded-lg disabled:opacity-30 transition-colors hover:bg-rose-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductList;
