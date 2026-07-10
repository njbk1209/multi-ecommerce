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

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, isBS, exchangeRate, store }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);