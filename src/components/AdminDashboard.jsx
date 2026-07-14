import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  LogOut, 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  ExternalLink, 
  RefreshCw, 
  TrendingUp, 
  DollarSign, 
  Phone
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../utils/supabase'
import { useCurrency } from '../context/CurrencyContext'

const AdminDashboard = ({ onLogout, session }) => {
  const navigate = useNavigate()
  const { store } = useCurrency()
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all') // 'all' | 'pendiente' | 'preparando' | 'completado' | 'cancelado'
  const [expandedOrders, setExpandedOrders] = useState({})
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Cargar pedidos de Supabase
  const fetchOrders = async (showToast = false) => {
    if (!store?.id) return
    setIsRefreshing(true)
    try {
      const { data, error } = await supabase
        .from('pedido')
        .select(`
          *,
          items:pedido_item (
            *
          )
        `)
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setOrders(data || [])
      
      // Auto-expandir el primer pedido si existe y no hay nada expandido
      if (data && data.length > 0 && Object.keys(expandedOrders).length === 0) {
        setExpandedOrders({ [data[0].id]: true })
      }

      if (showToast) {
        toast.success('Pedidos sincronizados correctamente', {
          icon: '🔄',
          style: { background: '#18181b', color: '#fff', borderRadius: '12px' }
        })
      }
    } catch (err) {
      console.error('Error al cargar pedidos:', err)
      toast.error('No se pudieron cargar los pedidos de la base de datos.', {
        style: { background: '#18181b', color: '#fff', borderRadius: '12px' }
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Cargar al montar el componente o al cambiar de tienda
  useEffect(() => {
    fetchOrders()
  }, [store?.id])

  const handleRefresh = () => {
    fetchOrders(true)
  }

  // Cambiar el estado de un pedido en la base de datos
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const { error } = await supabase
        .from('pedido')
        .update({ estado: newStatus })
        .eq('id', orderId)

      if (error) throw error

      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId ? { ...order, estado: newStatus } : order
        )
      )
      toast.success(`Pedido #${orderId} cambiado a: ${newStatus}`, {
        style: { background: '#18181b', color: '#fff', borderRadius: '12px' }
      })
    } catch (err) {
      console.error('Error al actualizar estado:', err)
      toast.error('No se pudo actualizar el estado del pedido.', {
        style: { background: '#18181b', color: '#fff', borderRadius: '12px' }
      })
    }
  }

  // Toggle expansión de detalles
  const toggleExpand = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }))
  }

  // Cálculos de métricas globales en tiempo real
  const totalOrdersCount = orders.length
  const pendingCount = orders.filter(o => o.estado === 'pendiente').length
  const preparingCount = orders.filter(o => o.estado === 'preparando').length
  const completedCount = orders.filter(o => o.estado === 'completado').length

  // Calcular ingresos totales sumando los pedidos que no están cancelados
  const revenueUSD = orders
    .filter(o => o.estado !== 'cancelado')
    .reduce((acc, o) => acc + o.total_usd, 0)

  const revenueBS = orders
    .filter(o => o.estado !== 'cancelado')
    .reduce((acc, o) => acc + o.total_bs, 0)

  // Filtrado de listado
  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    return order.estado === filter
  })

  // Helper para formato de fecha simple
  const formatDate = (isoString) => {
    const d = new Date(isoString)
    return d.toLocaleDateString('es-VE', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans selection:bg-zinc-800 selection:text-white">
      
      {/* Barra de navegación superior */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200/80 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif text-zinc-950 font-semibold tracking-tight">
              Postrecito Admin
            </h1>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Conectado
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs font-medium text-zinc-500">
              {session?.user?.email || 'admin@postrecito.com'}
            </span>
            <button
              onClick={() => {
                onLogout()
                navigate('/')
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-zinc-200 hover:border-zinc-900 text-xs font-semibold text-zinc-600 hover:text-zinc-900 rounded-xl transition-all hover:shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        
        {/* Panel de Métricas (Paleta Neutra) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Pedidos Totales</span>
              <p className="text-3xl font-serif font-semibold text-zinc-900">{totalOrdersCount}</p>
            </div>
            <div className="p-3 bg-zinc-50 text-zinc-600 border border-zinc-100 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Ingresos USD</span>
              <p className="text-3xl font-serif font-semibold text-zinc-900">${revenueUSD.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-zinc-50 text-zinc-600 border border-zinc-100 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Ingresos BS</span>
              <p className="text-xl font-mono font-bold text-zinc-900">{revenueBS.toLocaleString('es-VE')} Bs</p>
            </div>
            <div className="p-3 bg-zinc-50 text-zinc-600 border border-zinc-100 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Pendientes</span>
              <p className="text-3xl font-serif font-semibold text-zinc-900">{pendingCount}</p>
            </div>
            <div className={`p-3 rounded-xl border ${pendingCount > 0 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-zinc-50 text-zinc-600 border-zinc-100'}`}>
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
          </div>

        </section>

        {/* Encabezado del listado y filtros */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-serif font-semibold text-zinc-950">Historial de Pedidos</h2>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-1.5 text-zinc-400 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 bg-white rounded-xl shadow-sm transition-all ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Selector de filtros */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'pendiente', label: `Pendientes (${pendingCount})` },
              { id: 'preparando', label: `Preparando (${preparingCount})` },
              { id: 'completado', label: `Completados (${completedCount})` },
              { id: 'cancelado', label: 'Cancelados' }
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all
                  ${filter === btn.id 
                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' 
                    : 'bg-white border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
                  }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </section>

        {/* Listado de pedidos */}
        <section className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-zinc-200/85 rounded-3xl p-16 text-center space-y-3">
              <ShoppingBag className="w-12 h-12 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-500">No hay pedidos con el estado seleccionado en este momento.</p>
            </div>
          ) : (
            filteredOrders.map(order => {
              const isExpanded = !!expandedOrders[order.id]
              
              // Estado Badge Styles
              let statusBg = 'bg-zinc-100 text-zinc-700 border-zinc-200'
              if (order.estado === 'pendiente') statusBg = 'bg-amber-50 text-amber-700 border-amber-100'
              if (order.estado === 'preparando') statusBg = 'bg-blue-50 text-blue-700 border-blue-100'
              if (order.estado === 'completado') statusBg = 'bg-emerald-50 text-emerald-700 border-emerald-100'
              if (order.estado === 'cancelado') statusBg = 'bg-rose-50 text-rose-700 border-rose-100'

              return (
                <div 
                  key={order.id}
                  className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow transition-all"
                >
                  
                  {/* Fila principal del pedido */}
                  <div 
                    onClick={() => toggleExpand(order.id)}
                    className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 transition-colors"
                  >
                    
                    {/* ID y fecha */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-900 text-sm md:text-base">#{order.id}</span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${statusBg}`}>
                          {order.estado}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-medium">{formatDate(order.created_at)}</p>
                    </div>

                    {/* Cliente */}
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-zinc-800">{order.nombre_cliente}</p>
                      <a 
                        href={`https://wa.me/${order.whatsapp_cliente}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1 font-medium"
                      >
                        <Phone className="w-3 h-3 text-zinc-400" />
                        +{order.whatsapp_cliente}
                      </a>
                    </div>

                    {/* Entrega */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Entrega</p>
                      <p className="text-xs font-bold text-zinc-700">
                        {order.metodo_entrega === 'shipping' ? '🚚 Domicilio' : '🛍️ Retiro'}
                      </p>
                    </div>

                    {/* Monto Total */}
                    <div className="space-y-1 text-left md:text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Monto Total</p>
                      <p className="text-sm font-bold text-zinc-900">
                        {order.moneda_activa === 'USD' 
                          ? `$${order.total_usd.toFixed(2)}` 
                          : `${order.total_bs.toLocaleString('es-VE')} Bs`}
                      </p>
                    </div>

                    {/* Botón despliegue */}
                    <button className="self-end md:self-auto p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-900 transition-all">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                  </div>

                  {/* Sección expandida: Detalles */}
                  {isExpanded && (
                    <div className="border-t border-zinc-100 bg-zinc-50/30 p-6 space-y-6">
                      
                      {/* Grid de dirección y acciones */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Ubicación */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Detalles de Entrega</h4>
                          {order.metodo_entrega === 'shipping' ? (
                            <div className="bg-white border border-zinc-200/60 rounded-xl p-3.5 space-y-2">
                              <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                                <span className="font-semibold text-zinc-800">Dirección:</span> {order.direccion_entrega}
                              </p>
                              {order.gps_url && (
                                <a 
                                  href={order.gps_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-zinc-500 hover:text-zinc-900 hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                                  Ver coordenadas GPS <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <div className="bg-white border border-zinc-200/60 rounded-xl p-3.5">
                              <p className="text-xs text-zinc-500 font-medium">El cliente retirará personalmente en la tienda.</p>
                            </div>
                          )}
                        </div>

                        {/* Cambiar Estado (Acciones en Paleta Neutra) */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Acciones del Pedido</h4>
                          <div className="flex flex-wrap gap-2">
                            {order.estado !== 'pendiente' && (
                              <button 
                                onClick={() => handleUpdateStatus(order.id, 'pendiente')}
                                className="px-3.5 py-2 text-xs font-semibold border border-zinc-200 hover:border-zinc-900 bg-white text-zinc-600 hover:text-zinc-900 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                              >
                                <Clock className="w-3.5 h-3.5" /> Pendiente
                              </button>
                            )}
                            {order.estado !== 'preparando' && order.estado !== 'completado' && order.estado !== 'cancelado' && (
                              <button 
                                onClick={() => handleUpdateStatus(order.id, 'preparando')}
                                className="px-3.5 py-2 text-xs font-semibold border border-zinc-200 hover:border-zinc-900 bg-white text-zinc-600 hover:text-zinc-900 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                              >
                                🧑‍🍳 Preparar
                              </button>
                            )}
                            {order.estado !== 'completado' && order.estado !== 'cancelado' && (
                              <button 
                                onClick={() => handleUpdateStatus(order.id, 'completado')}
                                className="px-3.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl transition-all flex items-center gap-1.5 active:scale-95 shadow-sm hover:shadow"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Completar
                              </button>
                            )}
                            {order.estado !== 'cancelado' && order.estado !== 'completado' && (
                              <button 
                                onClick={() => handleUpdateStatus(order.id, 'cancelado')}
                                className="px-3.5 py-2 text-xs font-semibold border border-rose-200 hover:border-rose-400 bg-rose-50/50 hover:bg-rose-50 text-rose-600 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Cancelar
                              </button>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Productos Comprados */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Productos del Pedido</h4>
                        <div className="bg-white border border-zinc-200/60 rounded-xl divide-y divide-zinc-100 overflow-hidden shadow-inner">
                          {order.items?.map(item => (
                            <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                              
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-zinc-800">{item.cantidad}x {item.nombre_producto}</span>
                                  
                                  {/* Modificadores */}
                                  {item.opciones_seleccionadas?.length > 0 && (
                                    <div className="flex gap-1.5">
                                      {item.opciones_seleccionadas.map((opt, i) => (
                                        <span key={i} className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded font-medium">
                                          {opt.nombre} {opt.price_modifier > 0 && `(+$${opt.price_modifier.toFixed(2)})`}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {item.comentario && (
                                  <p className="text-xs font-medium text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-100 w-fit">
                                    📝 Nota: {item.comentario}
                                  </p>
                                )}
                              </div>

                              <span className="font-semibold text-zinc-700 self-start sm:self-auto">
                                Unitario: ${item.precio_unitario.toFixed(2)}
                              </span>

                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )
            })
          )}
        </section>

      </main>
    </div>
  )
}

export default AdminDashboard
