import React, { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useCurrency } from '../context/CurrencyContext'
import { Loader2, Save, CreditCard, DollarSign, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsManager() {
  const { store } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Campos Pago Móvil
  const [pmBanco, setPmBanco] = useState('')
  const [pmTelefono, setPmTelefono] = useState('')
  const [pmCedula, setPmCedula] = useState('')

  // Campos Zelle
  const [zelleEmail, setZelleEmail] = useState('')
  const [zelleNombre, setZelleNombre] = useState('')

  // Campos Binance
  const [binanceEmail, setBinanceEmail] = useState('')
  const [binanceId, setBinanceId] = useState('')

  // Campos Marca
  const [comercialName, setComercialName] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [colorPrimario, setColorPrimario] = useState('#e11d48')
  const [colorSecundario, setColorSecundario] = useState('#fdf2f8')
  const [colorAcento, setColorAcento] = useState('#fb7185')
  const [fontFamily, setFontFamily] = useState('Inter')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [facebookUrl, setFacebookUrl] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    const fetchPaymentAndBranding = async () => {
      if (!store?.id) return
      setLoading(true)
      try {
        // Cargar datos de pago
        const { data: paymentData, error: paymentError } = await supabase
          .from('datos_pago')
          .select('*')
          .eq('store_id', store.id)
          .maybeSingle()

        if (paymentError) throw paymentError

        if (paymentData) {
          setPmBanco(paymentData.pago_movil_banco || '')
          setPmTelefono(paymentData.pago_movil_telefono || '')
          setPmCedula(paymentData.pago_movil_cedula || '')
          setZelleEmail(paymentData.zelle_email || '')
          setZelleNombre(paymentData.zelle_nombre || '')
          setBinanceEmail(paymentData.binance_email || '')
          setBinanceId(paymentData.binance_id || '')
        }

        // Cargar datos de personalización del store
        setComercialName(store.comercial_name || '')
        setDescripcion(store.descripcion || '')
        setColorPrimario(store.color_primario || '#e11d48')
        setColorSecundario(store.color_secundario || '#fdf2f8')
        setColorAcento(store.color_acento || '#fb7185')
        setFontFamily(store.font_family || 'Inter')
        setInstagramUrl(store.instagram_url || '')
        setFacebookUrl(store.facebook_url || '')
        setLogoUrl(store.logo_url || '')

      } catch (err) {
        console.error('Error al cargar datos:', err)
        toast.error('No se pudieron cargar los datos de la tienda.')
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentAndBranding()
  }, [store])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!store?.id) return

    setSaving(true)
    try {
      // 1. Guardar métodos de pago
      const { error: paymentError } = await supabase
        .from('datos_pago')
        .upsert({
          store_id: store.id,
          pago_movil_banco: pmBanco.trim() || null,
          pago_movil_telefono: pmTelefono.trim() || null,
          pago_movil_cedula: pmCedula.trim() || null,
          zelle_email: zelleEmail.trim() || null,
          zelle_nombre: zelleNombre.trim() || null,
          binance_email: binanceEmail.trim() || null,
          binance_id: binanceId.trim() || null
        }, { onConflict: 'store_id' })

      if (paymentError) throw paymentError

      // 2. Subir logotipo si hay archivo seleccionado
      let finalLogoUrl = logoUrl
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const storeFolderName = store?.comercial_name
          ? store.comercial_name
              .toLowerCase()
              .trim()
              .replace(/\s+/g, '-')
              .replace(/[^\w\-]+/g, '')
          : `store-${store.id}`
        const fileName = `logo-${Date.now()}.${fileExt}`
        const filePath = `${storeFolderName}/branding/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('productos')
          .upload(filePath, logoFile, { upsert: true })

        if (uploadError) throw uploadError

        const { data } = supabase.storage
          .from('productos')
          .getPublicUrl(filePath)

        finalLogoUrl = data.publicUrl
      }

      // 3. Guardar personalización en la tabla store
      const { error: storeError } = await supabase
        .from('store')
        .update({
          comercial_name: comercialName.trim() || null,
          descripcion: descripcion.trim() || null,
          color_primario: colorPrimario.trim() || null,
          color_secundario: colorSecundario.trim() || null,
          color_acento: colorAcento.trim() || null,
          font_family: fontFamily,
          instagram_url: instagramUrl.trim() || null,
          facebook_url: facebookUrl.trim() || null,
          logo_url: finalLogoUrl
        })
        .eq('id', store.id)

      if (storeError) throw storeError

      toast.success('Configuración y marca guardados. Aplicando cambios...', { icon: '✨' })
      
      setTimeout(() => {
        window.location.reload()
      }, 1200)

    } catch (err) {
      console.error('Error al guardar configuración:', err)
      toast.error('Error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        <p className="text-xs font-semibold text-zinc-400">Cargando configuración de la tienda...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-serif font-semibold text-zinc-900">Configuración y Marca de la Tienda</h2>
        <p className="text-xs font-medium text-zinc-450 mt-1">
          Configura tus cuentas de cobro y personaliza la identidad visual de tu plataforma.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Personalización de Identidad Visual */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <div className="p-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg">
              <span className="text-lg">🎨</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800">Identidad y Marca</h3>
              <p className="text-[10px] text-zinc-400 font-medium">Personaliza el logotipo, colores y tipografía de tu tienda.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Nombre de la Tienda</label>
              <input
                required
                type="text"
                placeholder="Nombre comercial"
                value={comercialName}
                onChange={(e) => setComercialName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Logotipo de la Tienda</label>
              <div className="flex items-center gap-3">
                {logoUrl && (
                  <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain border border-zinc-200 rounded-lg bg-zinc-50" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files[0])}
                  className="text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[11px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Descripción de la Tienda</label>
              <textarea
                placeholder="Breve eslogan o descripción de tu negocio..."
                value={descripcion}
                rows={2}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Color Principal (Primario)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-zinc-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  placeholder="#hex"
                  value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Color de Fondo (Secundario)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorSecundario}
                  onChange={(e) => setColorSecundario(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-zinc-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  placeholder="#hex"
                  value={colorSecundario}
                  onChange={(e) => setColorSecundario(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Color de Acento</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorAcento}
                  onChange={(e) => setColorAcento(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-zinc-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  placeholder="#hex"
                  value={colorAcento}
                  onChange={(e) => setColorAcento(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Tipografía (Google Font)</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs bg-white"
              >
                {['Inter', 'Outfit', 'Poppins', 'Playfair Display', 'Montserrat', 'Roboto', 'Lora', 'Pacifico'].map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Instagram (Enlace o Nombre de Usuario)</label>
              <input
                type="text"
                placeholder="https://instagram.com/tu_tienda"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Facebook (Enlace de Página)</label>
              <input
                type="text"
                placeholder="https://facebook.com/tu_tienda"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all font-mono"
              />
            </div>
          </div>
        </div>

        {/* Pago Móvil */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <div className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800">🇻🇪 Pago Móvil</h3>
              <p className="text-[10px] text-zinc-400 font-medium">Transferencia bancaria rápida para clientes en Venezuela.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Banco</label>
              <input
                type="text"
                placeholder="Ej. Banesco, Mercantil"
                value={pmBanco}
                onChange={(e) => setPmBanco(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Teléfono móvil</label>
              <input
                type="text"
                placeholder="Ej. 04121234567"
                value={pmTelefono}
                onChange={(e) => setPmTelefono(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Cédula o RIF</label>
              <input
                type="text"
                placeholder="Ej. V-12345678"
                value={pmCedula}
                onChange={(e) => setPmCedula(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all font-mono"
              />
            </div>
          </div>
        </div>

        {/* Zelle */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <div className="p-2 bg-purple-50 text-purple-600 border border-purple-100 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800">💵 Zelle</h3>
              <p className="text-[10px] text-zinc-400 font-medium">Pagos directos en divisas (USD).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Correo electrónico</label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={zelleEmail}
                onChange={(e) => setZelleEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-450">Titular de la cuenta</label>
              <input
                type="text"
                placeholder="Nombre completo"
                value={zelleNombre}
                onChange={(e) => setZelleNombre(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all"
              />
            </div>
          </div>
        </div>

        {/* Binance */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <div className="p-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800">🪙 Binance Pay</h3>
              <p className="text-[10px] text-zinc-400 font-medium">Pagos utilizando criptomonedas (USDT).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-455">ID de Binance Pay</label>
              <input
                type="text"
                placeholder="Ej. 29384729"
                value={binanceId}
                onChange={(e) => setBinanceId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-455">Correo registrado</label>
              <input
                type="email"
                placeholder="correo@binance.com"
                value={binanceEmail}
                onChange={(e) => setBinanceEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs transition-all font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-all shadow-sm active:scale-95"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Guardar Configuración
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
