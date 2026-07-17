// context/CurrencyContext.jsx

import { createContext, useContext, useState, useEffect } from 'react';
import React from 'react';
import { supabase } from '../utils/supabase';

const CurrencyContext = createContext();
const STORE_API_KEY = import.meta.env.VITE_STORE_API_KEY;

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency]       = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(null);
  const [store, setStore]             = useState(null);

  const isBS = currency === 'BS';

  useEffect(() => {
    const fetchStoreAndRate = async () => {
      try {
        // 1. Obtener datos de la tienda
        if (STORE_API_KEY) {
          const { data: storeData, error: storeError } = await supabase
            .from('store')
            .select('*')
            .eq('api_key', STORE_API_KEY)
            .eq('is_active', true)
            .maybeSingle();

          if (storeError) throw storeError;
          setStore(storeData);
        }

        // 2. Obtener tasa de cambio
        const { data: rateData, error: rateError } = await supabase
          .from('exchange')
          .select('rate')
          .order('date', { ascending: false })
          .limit(1);

        if (rateError) throw rateError;
        
        if (rateData && rateData.length > 0) {
          setExchangeRate(rateData[0].rate);
        }
      } catch (err) {
        console.error('Error al inicializar tienda y tasa de cambio:', err);
      }
    };
    fetchStoreAndRate();
  }, []);

  useEffect(() => {
    if (store) {
      const primary = store.color_primario || '#e11d48';
      const secondary = store.color_secundario || '#fdf2f8';
      const accent = store.color_acento || '#fb7185';
      const fontFamily = store.font_family || 'Inter';

      // Función auxiliar para aclarar/oscurecer colores hexadecimales
      const adjustColorBrightness = (hex, percent) => {
        let cleaned = hex.replace('#', '');
        if (cleaned.length === 3) {
          cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
        }
        let R = parseInt(cleaned.substring(0, 2), 16);
        let G = parseInt(cleaned.substring(2, 4), 16);
        let B = parseInt(cleaned.substring(4, 6), 16);

        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);

        R = Math.min(255, Math.max(0, R));
        G = Math.min(255, Math.max(0, G));
        B = Math.min(255, Math.max(0, B));

        const rHex = R.toString(16).padStart(2, '0');
        const gHex = G.toString(16).padStart(2, '0');
        const bHex = B.toString(16).padStart(2, '0');

        return `#${rHex}${gHex}${bHex}`;
      };

      // Asignar variables semánticas de marca
      document.documentElement.style.setProperty('--color-primary', primary);
      document.documentElement.style.setProperty('--color-secondary', secondary);
      document.documentElement.style.setProperty('--color-accent', accent);
      document.documentElement.style.setProperty('--font-family', fontFamily);

      // Generar escala cromática de compatibilidad rose (50 - 950) usando los colores de marca configurados
      const scale = {
        50: secondary, // Fondo ultra claro
        100: adjustColorBrightness(secondary, -6), // Fondo claro secundario
        200: adjustColorBrightness(accent, 40), // Borde suave
        300: adjustColorBrightness(accent, 20),
        400: accent, // Acento (hover / estados)
        500: primary, // Color principal
        600: adjustColorBrightness(primary, -10),
        700: adjustColorBrightness(primary, -20),
        800: adjustColorBrightness(primary, -35),
        900: adjustColorBrightness(primary, -50),
        950: adjustColorBrightness(primary, -65)
      };

      Object.entries(scale).forEach(([key, val]) => {
        document.documentElement.style.setProperty(`--theme-rose-${key}`, val);
      });

      // Actualizar dinámicamente las propiedades de la página del navegador
      const pageTitle = store.comercial_name 
        ? `${store.comercial_name} - ${store.descripcion || 'Deleita tus sentidos'}` 
        : 'Postrecito - Deleita tus sentidos';
      document.title = pageTitle;

      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && store.descripcion) {
        metaDesc.setAttribute('content', store.descripcion);
      }

      // Etiquetas Open Graph (Redes Sociales)
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', store.comercial_name || 'Postrecito');

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc && store.descripcion) ogDesc.setAttribute('content', store.descripcion);

      if (store.logo_url) {
        const ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg) ogImg.setAttribute('content', store.logo_url);

        const favLink = document.querySelector('link[rel="icon"]');
        if (favLink) {
          favLink.setAttribute('href', store.logo_url);
          favLink.setAttribute('type', 'image/png');
        }
      }

      // Carga dinámica de la tipografía elegida
      const fontLink = document.getElementById('dynamic-google-font') || document.createElement('link');
      fontLink.id = 'dynamic-google-font';
      fontLink.rel = 'stylesheet';
      fontLink.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;800;900&display=swap`;
      document.head.appendChild(fontLink);
      document.body.style.fontFamily = `'${fontFamily}', sans-serif`;
    }
  }, [store]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, isBS, exchangeRate, store }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);