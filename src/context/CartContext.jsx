import { createContext, useContext, useState, useEffect } from 'react';
import React from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../utils/supabase';
import { useCurrency } from './CurrencyContext';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { exchangeRate } = useCurrency();

  // Inicializar estado del carrito de forma perezosa desde localStorage
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('postrecito_cart');
    if (saved) {
      try {
        return JSON.parse(saved) || [];
      } catch (_) {
        return [];
      }
    }
    return [];
  });

  // 1. Guardar el carrito en localStorage cada vez que cambie
  useEffect(() => {
    localStorage.setItem('postrecito_cart', JSON.stringify(cart));
  }, [cart]);

  // 2. Sincronizar precios en Bolívares (Bs) cuando la tasa de cambio se cargue o cambie
  useEffect(() => {
    if (!exchangeRate) return;
    setCart(prev => 
      prev.map(item => ({
        ...item,
        price_bs: item.price * exchangeRate,
        compare_price_bs: item.compare_price ? item.compare_price * exchangeRate : null
      }))
    );
  }, [exchangeRate]);

  // 3. Sincronizar con la base de datos al montar para validar stock y precios actualizados
  useEffect(() => {
    if (cart.length === 0) return;

    const syncCart = async () => {
      try {
        const ids = cart.map(item => item.id);
        const { data: dbProducts, error } = await supabase
          .from('producto')
          .select('*, ProductImagen(*)')
          .in('id', ids)
          .eq('is_active', true);

        if (error) throw error;

        const dbProductsMap = new Map(dbProducts?.map(p => [p.id, p]) || []);

        setCart(prev => {
          const updated = prev
            .map(item => {
              const fresh = dbProductsMap.get(item.id);
              // Eliminar del carrito si el producto ya no existe o no tiene stock
              if (!fresh || fresh.stock <= 0) return null; 

              const basePriceNum = fresh.precio_por_tamano ? 0 : (parseFloat(fresh.price) || 0);
              const baseComparePriceNum = fresh.precio_por_tamano ? 0 : (fresh.compare_price ? parseFloat(fresh.compare_price) : null);
              
              // Sumar modificadores si tiene
              const modifiersTotal = item.selectedOptions?.reduce((sum, opt) => sum + (parseFloat(opt.price_modifier) || 0), 0) || 0;
              const freshPrice = basePriceNum + modifiersTotal;
              const freshComparePrice = baseComparePriceNum ? baseComparePriceNum + modifiersTotal : null;

              const images = fresh.ProductImagen || [];
              const mainImage = images.find(img => img.is_primary)?.url ?? images[0]?.url ?? null;

              // Ajustar la cantidad si el stock actual es menor a lo que tenía seleccionado
              const qty = Math.min(item.qty, fresh.stock);

              return {
                ...item,
                name: fresh.name || fresh.sku || 'Producto sin nombre',
                price: freshPrice,
                compare_price: freshComparePrice,
                stock: fresh.stock,
                image: mainImage,
                qty
              };
            })
            .filter(Boolean); // Filtra los elementos null

          return updated;
        });
      } catch (err) {
        console.error("Error al sincronizar el carrito con Supabase al iniciar:", err);
      }
    };

    syncCart();
  }, []);

  const validateCartBeforeCheckout = async () => {
    if (cart.length === 0) return { valid: false, messages: ['El carrito está vacío.'] };

    try {
      const ids = cart.map(item => item.id);
      const { data: dbProducts, error } = await supabase
        .from('producto')
        .select('*, ProductImagen(*)')
        .in('id', ids)
        .eq('is_active', true);

      if (error) throw error;

      const dbProductsMap = new Map(dbProducts?.map(p => [p.id, p]) || []);
      let changesDetected = false;
      const messages = [];

      const updated = cart
        .map(item => {
          const fresh = dbProductsMap.get(item.id);
          // 1. Validar existencia y stock
          if (!fresh || fresh.stock <= 0) {
            changesDetected = true;
            messages.push(`❌ ¡${item.name} se ha agotado y fue removido!`);
            return null;
          }

          const basePriceNum = fresh.precio_por_tamano ? 0 : (parseFloat(fresh.price) || 0);
          const baseComparePriceNum = fresh.precio_por_tamano ? 0 : (fresh.compare_price ? parseFloat(fresh.compare_price) : null);
          
          // Calcular el precio fresco con modificadores
          const modifiersTotal = item.selectedOptions?.reduce((sum, opt) => sum + (parseFloat(opt.price_modifier) || 0), 0) || 0;
          const freshPrice = basePriceNum + modifiersTotal;
          const freshComparePrice = baseComparePriceNum ? baseComparePriceNum + modifiersTotal : null;

          // 2. Validar cambios de precio
          if (freshPrice !== item.price) {
            changesDetected = true;
            messages.push(`💰 El precio de "${item.name}" cambió de $${item.price} a $${freshPrice}.`);
          }

          // 3. Validar cambios en cantidades por stock
          let qty = item.qty;
          if (item.qty > fresh.stock) {
            changesDetected = true;
            qty = fresh.stock;
            messages.push(`📦 El stock de "${item.name}" disminuyó. Ajustamos tu cantidad a ${qty}.`);
          }

          const rate = exchangeRate || 1;
          const price_bs = freshPrice * rate;
          const compare_price_bs = freshComparePrice ? freshComparePrice * rate : null;

          const images = fresh.ProductImagen || [];
          const mainImage = images.find(img => img.is_primary)?.url ?? images[0]?.url ?? null;

          return {
            ...item,
            name: fresh.name || fresh.sku || 'Producto sin nombre',
            price: freshPrice,
            compare_price: freshComparePrice,
            price_bs,
            compare_price_bs,
            stock: fresh.stock,
            image: mainImage,
            qty
          };
        })
        .filter(Boolean);

      if (changesDetected) {
        setCart(updated);
        return { valid: false, messages };
      }

      return { valid: true };
    } catch (err) {
      console.error("Error al validar el carrito antes del checkout:", err);
      // Si falla la red, permitimos el pedido como fallback para no obstruir al usuario
      return { valid: true };
    }
  };

  const addToCart = (product, selectedOptions = [], comment = '') => {
    const basePrice = product.precio_por_tamano ? 0 : product.price;
    const baseComparePrice = product.precio_por_tamano ? 0 : product.compare_price;

    const modifiersTotal = selectedOptions.reduce((sum, opt) => sum + (parseFloat(opt.price_modifier) || 0), 0);
    const itemPrice = basePrice + modifiersTotal;
    const itemComparePrice = baseComparePrice ? baseComparePrice + modifiersTotal : null;

    const rate = exchangeRate || 1;
    const itemPriceBs = itemPrice * rate;
    const itemComparePriceBs = itemComparePrice ? itemComparePrice * rate : null;

    // Clave única según producto + modificadores + comentario para separar líneas distintas del mismo producto
    const optionKey = selectedOptions.map(o => o.id).sort().join('_');
    const cartItemId = `${product.id}-${optionKey}-${comment}`;

    setCart((prev) => {
      const existing = prev.find(item => item.cartItemId === cartItemId);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(item =>
          item.cartItemId === cartItemId ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { 
        ...product, 
        cartItemId,
        price: itemPrice,
        compare_price: itemComparePrice,
        price_bs: itemPriceBs,
        compare_price_bs: itemComparePriceBs,
        selectedOptions,
        comment,
        qty: 1 
      }];
    });
    toast.success(`😋 ¡${product.name} agregado al carrito!`);
  };

  const updateQuantity = (cartItemId, amount) => {
    setCart((prev) =>
      prev.map(item => {
        if (item.cartItemId === cartItemId) {
          const newQty = item.qty + amount;
          if (newQty >= 1 && newQty <= item.stock) {
            return { ...item, qty: newQty };
          }
        }
        return item;
      })
    );
  };

  const removeFromCart = (cartItemId) => {
    setCart((prev) => prev.filter(item => item.cartItemId !== cartItemId));
  };

  // Total en dólares (price)
  const totalUSD = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  // Total en bolívares (price_bs)
  const totalBS = cart.reduce((acc, item) => acc + ((item.price_bs ?? 0) * item.qty), 0);

  const getTotal = (currency) => currency === 'BS' ? totalBS : totalUSD;

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, totalUSD, totalBS, getTotal, setCart, validateCartBeforeCheckout }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);