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
            position="top-center"
            reverseOrder={false}
            containerStyle={{
              top: 16,
              left: 16,
              right: 16,
              zIndex: 99999,
            }}
            toastOptions={{
              duration: 4000,
              style: {
                maxWidth: "92vw",
                fontSize: "13px",
                fontWeight: "600",
                borderRadius: "14px",
                boxShadow:
                  "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              },
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
