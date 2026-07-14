import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { CurrencyProvider } from './context/CurrencyContext.jsx'
import { Toaster } from 'react-hot-toast';
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react";
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CurrencyProvider>
        <CartProvider>
          <App />
          <Toaster
            toastOptions={{
              success: {
                duration: 4000,
              },
            }}
          />
        </CartProvider>
      </CurrencyProvider>
    </BrowserRouter>
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)
