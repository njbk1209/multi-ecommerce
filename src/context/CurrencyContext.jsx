// context/CurrencyContext.jsx

import { createContext, useContext, useState, useEffect } from "react";
import React from "react";
import { supabase } from "../utils/supabase";

const CurrencyContext = createContext();
const STORE_API_KEY = import.meta.env.VITE_STORE_API_KEY;

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(null);
  const [store, setStore] = useState(null);
  const [promotions, setPromotions] = useState([]);

  const isBS = currency === "BS";

  const fetchPromotions = async (storeId) => {
    if (!storeId) return;
    try {
      const { data, error } = await supabase
        .from("promocion")
        .select("*, promocion_regla(*)")
        .eq("store_id", storeId)
        .eq("is_active", true);

      if (!error && data) {
        setPromotions(data);
      }
    } catch (err) {
      console.error("Error al obtener promociones de Supabase:", err);
    }
  };

  useEffect(() => {
    const fetchStoreAndRate = async () => {
      try {
        // 1. Obtener datos de la tienda
        if (STORE_API_KEY) {
          const { data: storeData, error: storeError } = await supabase
            .from("store")
            .select("*")
            .eq("api_key", STORE_API_KEY)
            .eq("is_active", true)
            .maybeSingle();

          if (storeError) throw storeError;
          setStore(storeData);

          if (storeData) {
            await fetchPromotions(storeData.id);
          }
        }

        // 2. Obtener tasa de cambio
        const { data: rateData, error: rateError } = await supabase
          .from("exchange")
          .select("rate")
          .order("date", { ascending: false })
          .limit(1);

        if (rateError) throw rateError;

        if (rateData && rateData.length > 0) {
          setExchangeRate(rateData[0].rate);
        }
      } catch (err) {
        console.error("Error al inicializar tienda y tasa de cambio:", err);
      }
    };
    fetchStoreAndRate();
  }, []);

  // Actualizar metadatos de la página
  useEffect(() => {
    if (store) {
      const pageTitle = store.comercial_name
        ? `${store.comercial_name} - ${store.descripcion || "Tienda Online"}`
        : "Tienda Online";
      document.title = pageTitle;

      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && store.descripcion) {
        metaDesc.setAttribute("content", store.descripcion);
      }

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && store.comercial_name) {
        ogTitle.setAttribute("content", store.comercial_name);
      }

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc && store.descripcion) {
        ogDesc.setAttribute("content", store.descripcion);
      }

      if (store.logo_url) {
        const ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg) ogImg.setAttribute("content", store.logo_url);

        const favLink = document.querySelector('link[rel="icon"]');
        if (favLink) {
          favLink.setAttribute("href", store.logo_url);
          favLink.setAttribute("type", "image/png");
        }
      }
    }
  }, [store]);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        isBS,
        exchangeRate,
        store,
        promotions,
        refetchPromotions: () => fetchPromotions(store?.id)
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);

