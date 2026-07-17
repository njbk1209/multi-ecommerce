import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, X, Loader2, Image as ImageIcon, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { useCurrency } from '../context/CurrencyContext'
import toast from 'react-hot-toast'

export default function ProductsManager() {
  const { store } = useCurrency()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  // Form fields
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [comparePrice, setComparePrice] = useState('')
  const [stock, setStock] = useState('999')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [barcode, setBarcode] = useState('')
  const [tax, setTax] = useState('0')
  const [precioPorTamano, setPrecioPorTamano] = useState(false)
  const [allOptionGroups, setAllOptionGroups] = useState([])
  const [selectedGroupIds, setSelectedGroupIds] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Fetch products and categories
  const fetchData = async () => {
    if (!store?.id) return
    setLoading(true)
    try {
      // 1. Cargar categorías para el selector
      const { data: catData, error: catError } = await supabase
        .from('category')
        .select('*')
        .eq('store', store.id)
        .order('name', { ascending: true })

      if (catError) throw catError
      setCategories(catData || [])

      // 2. Cargar productos con relaciones (incluyendo producto_grupo_relacion)
      const { data: prodData, error: prodError } = await supabase
        .from('producto')
        .select(`
          *,
          category:category!producto_category_fkey(id, name),
          ProductImagen(*),
          producto_grupo_relacion(grupo_id)
        `)
        .eq('store', store.id)
        .order('created_at', { ascending: false })

      if (prodError) throw prodError
      setProducts(prodData || [])

      // 3. Cargar grupos de opciones disponibles en la tienda
      const { data: optGroupsData, error: optGroupsError } = await supabase
        .from('producto_opciones_grupo')
        .select('id, nombre')
        .eq('store', store.id)
        .order('nombre', { ascending: true })

      if (optGroupsError) throw optGroupsError
      setAllOptionGroups(optGroupsData || [])
    } catch (err) {
      console.error('Error al cargar datos:', err)
      toast.error('No se pudieron cargar los productos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [store?.id])

  const handleOpenCreate = () => {
    setEditingProduct(null)
    setName('')
    setCategoryId(categories[0]?.id || '')
    setSku('PROD-' + Math.floor(100000 + Math.random() * 900000))
    setPrice('')
    setComparePrice('')
    setStock('999')
    setDescription('')
    setIsActive(true)
    setImageUrl('')
    setImageFile(null)
    setPreviewUrl('')
    setSelectedGroupIds([])
    setBarcode('')
    setTax('0')
    setPrecioPorTamano(false)
    setModalOpen(true)
  }

  const handleOpenEdit = (product) => {
    setEditingProduct(product)
    setName(product.name)
    setCategoryId(product.category?.id || '')
    setSku(product.sku || '')
    setPrice(product.price ? product.price.toString() : '')
    setComparePrice(product.compare_price ? product.compare_price.toString() : '')
    setStock(product.stock ? product.stock.toString() : '0')
    setDescription(product.description || '')
    setIsActive(product.is_active)
    setBarcode(product.barcode || '')
    setTax(product.tax ? product.tax.toString() : '0')
    setPrecioPorTamano(product.precio_por_tamano || false)
    setSelectedGroupIds(product.producto_grupo_relacion?.map(rel => rel.grupo_id) || [])
    setImageFile(null)

    // Obtener imagen principal
    const mainImg = product.ProductImagen?.find(img => img.is_primary) || product.ProductImagen?.[0]
    const url = mainImg ? mainImg.url : ''
    setImageUrl(url)
    setPreviewUrl(url)

    setModalOpen(true)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('El archivo seleccionado debe ser una imagen.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB.')
      return
    }

    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImageUrl('')
    setPreviewUrl('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('El nombre del producto es obligatorio.')
      return
    }
    if (!categoryId) {
      toast.error('Debes seleccionar una categoría.')
      return
    }
    if (!sku.trim()) {
      toast.error('El SKU del producto es obligatorio.')
      return
    }
    if (!price || parseFloat(price) <= 0) {
      toast.error('El precio debe ser un número positivo.')
      return
    }

    setSubmitting(true)

    try {
      let finalImageUrl = imageUrl

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
        const filePath = `${store.id}/${fileName}`

        // Subir archivo al bucket 'productos'
        const { error: uploadError } = await supabase.storage
          .from('productos')
          .upload(filePath, imageFile)

        if (uploadError) throw uploadError

        // Obtener la URL pública de la imagen
        const { data: urlData } = supabase.storage
          .from('productos')
          .getPublicUrl(filePath)

        finalImageUrl = urlData.publicUrl
      }

      const productPayload = {
        store: store.id,
        name: name.trim(),
        category: parseInt(categoryId),
        sku: sku.trim().toUpperCase(),
        price: parseFloat(price),
        compare_price: comparePrice ? parseFloat(comparePrice) : null,
        stock: parseInt(stock) || 0,
        stock_status: (parseInt(stock) || 0) > 0,
        description: description.trim(),
        is_active: isActive,
        barcode: barcode.trim() || null,
        tax: parseFloat(tax) || 0,
        precio_por_tamano: precioPorTamano
      }

      let productId

      if (editingProduct) {
        // 1. Actualizar producto existente
        const { error } = await supabase
          .from('producto')
          .update(productPayload)
          .eq('id', editingProduct.id)

        if (error) throw error
        productId = editingProduct.id
        toast.success('Producto actualizado correctamente.')
      } else {
        // 2. Crear nuevo producto
        const { data, error } = await supabase
          .from('producto')
          .insert(productPayload)
          .select('id')
          .single()

        if (error) throw error
        productId = data.id
        toast.success('Producto creado con éxito.')
      }

      // 3. Manejo de imágenes (tabla ProductImagen)
      const existingImages = editingProduct?.ProductImagen || []
      const mainImg = existingImages.find(img => img.is_primary) || existingImages[0]

      if (finalImageUrl.trim()) {
        if (mainImg) {
          if (mainImg.url !== finalImageUrl.trim()) {
            // Si ya existe una imagen y es diferente, la actualizamos
            const { error: imgUpdateError } = await supabase
              .from('ProductImagen')
              .update({ url: finalImageUrl.trim() })
              .eq('id', mainImg.id)
            if (imgUpdateError) throw imgUpdateError
          }
        } else {
          // Si no existía imagen previa, la insertamos
          const { error: imgInsertError } = await supabase
            .from('ProductImagen')
            .insert({
              product: productId,
              url: finalImageUrl.trim(),
              is_primary: true,
              order: 0
            })
          if (imgInsertError) throw imgInsertError
        }
      } else if (mainImg) {
        // Si el usuario vació el campo y existía una imagen, la borramos
        const { error: imgDeleteError } = await supabase
          .from('ProductImagen')
          .delete()
          .eq('id', mainImg.id)
        if (imgDeleteError) throw imgDeleteError
      }

      // 4. Sincronizar grupos de opciones asociados (tabla producto_grupo_relacion)
      const { error: relDeleteError } = await supabase
        .from('producto_grupo_relacion')
        .delete()
        .eq('producto_id', productId)

      if (relDeleteError) throw relDeleteError

      if (selectedGroupIds.length > 0) {
        const relationsPayload = selectedGroupIds.map((groupId, index) => ({
          producto_id: productId,
          grupo_id: groupId,
          orden: index
        }))

        const { error: relInsertError } = await supabase
          .from('producto_grupo_relacion')
          .insert(relationsPayload)

        if (relInsertError) throw relInsertError
      }

      setModalOpen(false)
      fetchData()
    } catch (err) {
      console.error('Error al guardar producto:', err)
      toast.error('Ocurrió un error al guardar el producto.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (productId, productName) => {
    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar el producto "${productName}"?`)
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('producto')
        .delete()
        .eq('id', productId)

      if (error) throw error
      toast.success('Producto eliminado correctamente.')
      fetchData()
    } catch (err) {
      console.error('Error al eliminar producto:', err)
      toast.error('No se pudo eliminar el producto.')
    }
  }

  // Toggle rápido de estado de activación directo en la tabla
  const handleToggleActive = async (product) => {
    const updatedStatus = !product.is_active
    try {
      const { error } = await supabase
        .from('producto')
        .update({ is_active: updatedStatus })
        .eq('id', product.id)

      if (error) throw error

      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, is_active: updatedStatus } : p)
      )
      toast.success(`${product.name} ${updatedStatus ? 'activado' : 'desactivado'}.`)
    } catch (err) {
      console.error('Error al cambiar estado:', err)
      toast.error('No se pudo actualizar el estado de activación.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif font-semibold text-zinc-950">Catálogo de Productos</h2>
          <p className="text-xs text-zinc-400 font-medium">Administra los postres, sus precios, stock y visibilidad en la tienda.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          disabled={categories.length === 0}
          className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95
            ${categories.length === 0
              ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
              : 'bg-zinc-950 hover:bg-zinc-800 text-white'}`}
          title={categories.length === 0 ? 'Debes crear al menos una categoría primero' : ''}
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          <span className="text-xs text-zinc-500 font-medium">Cargando productos...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-16 text-center space-y-3">
          <ImageIcon className="w-12 h-12 text-zinc-300 mx-auto" />
          <p className="text-sm font-medium text-zinc-500">No hay productos registrados en esta tienda.</p>
          {categories.length === 0 ? (
            <p className="text-xs text-rose-500">⚠️ Por favor, crea una categoría primero para poder añadir productos.</p>
          ) : (
            <button
              onClick={handleOpenCreate}
              className="text-xs font-semibold text-zinc-900 border border-zinc-300 px-3.5 py-1.5 rounded-xl hover:border-zinc-900 transition-colors"
            >
              Añadir tu primer producto
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4">Precio ($)</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm text-zinc-700">
                {products.map((product) => {
                  const mainImg = product.ProductImagen?.find(img => img.is_primary) || product.ProductImagen?.[0]
                  return (
                    <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-100 bg-zinc-50 flex items-center justify-center shrink-0">
                            {mainImg ? (
                              <img src={mainImg.url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-zinc-300" />
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-900 block leading-tight">{product.name}</span>
                            {product.sku && <span className="text-[10px] text-zinc-400 font-mono">SKU: {product.sku}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded text-xs font-medium">
                          {product.category?.name || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold">
                        ${parseFloat(product.price).toFixed(2)}
                        {product.compare_price && (
                          <span className="text-zinc-400 line-through text-xs ml-1.5 font-normal">
                            ${parseFloat(product.compare_price).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {product.stock > 10 ? (
                          <span className="text-zinc-600">{product.stock}</span>
                        ) : product.stock > 0 ? (
                          <span className="text-amber-600 font-bold">{product.stock} (Bajo)</span>
                        ) : (
                          <span className="text-rose-600 font-bold">Agotado</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleActive(product)}
                          className="mx-auto block text-zinc-500 hover:text-zinc-900 transition-all p-1"
                          title={product.is_active ? 'Desactivar producto' : 'Activar producto'}
                        >
                          {product.is_active ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Activo</span>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Inactivo</span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id, product.name)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Formulario */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-2xl my-8 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-serif font-semibold text-zinc-900 text-lg">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 hover:rotate-90 transition-all p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre del Producto</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Torta de Tres Leches"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Categoría</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all bg-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">SKU (Código único)</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Ej. TORT-001"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Precio ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ej. 12.50"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Precio Comparación ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={comparePrice}
                    onChange={(e) => setComparePrice(e.target.value)}
                    placeholder="Ej. 15.00"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Stock (Inventario)</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="Ej. 50"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Código de Barras (Barcode - Opcional)</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Ej. 750103049..."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Impuesto / Tax (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    placeholder="Ej. 16.00"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Imagen del Producto (Subir Archivo)</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50 py-3.5 px-4 rounded-xl cursor-pointer transition-all">
                    <span className="text-xs text-zinc-655 font-semibold flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-zinc-450" />
                      {imageFile ? imageFile.name : 'Seleccionar Imagen...'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  
                  {previewUrl && (
                    <div className="relative w-14 h-14 border border-zinc-150 rounded-xl overflow-hidden shrink-0 bg-zinc-50 group">
                      <img src={previewUrl} alt="Vista previa" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-all"
                        title="Quitar imagen"
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Escribe detalles del postre, alérgenos, etc..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm resize-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-zinc-50/50 p-4 border border-zinc-100 rounded-xl">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                  />
                  <label htmlFor="isActive" className="text-xs font-bold uppercase tracking-wider text-zinc-600 cursor-pointer select-none">
                    Producto Activo (Público)
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-zinc-50/50 p-4 border border-zinc-100 rounded-xl">
                  <input
                    type="checkbox"
                    id="precioPorTamano"
                    checked={precioPorTamano}
                    onChange={(e) => setPrecioPorTamano(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                  />
                  <label htmlFor="precioPorTamano" className="text-xs font-bold uppercase tracking-wider text-zinc-600 cursor-pointer select-none">
                    Precio por Tamaño
                  </label>
                </div>
              </div>

              {allOptionGroups.length > 0 && (
                <div className="space-y-2.5 border-t border-zinc-100 pt-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">Modificadores y Variaciones Vinculados</label>
                  <p className="text-[10px] text-zinc-400 font-medium">Marca los grupos de opciones que aplican a este postre:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-36 overflow-y-auto pr-1">
                    {allOptionGroups.map(group => {
                      const isChecked = selectedGroupIds.includes(group.id)
                      return (
                        <label key={group.id} className="flex items-center gap-2.5 bg-zinc-50/50 hover:bg-zinc-50 border border-zinc-150 rounded-xl p-3 cursor-pointer transition-colors text-xs font-semibold text-zinc-700 select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroupIds([...selectedGroupIds, group.id])
                              } else {
                                setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.id))
                              }
                            }}
                            className="w-4 h-4 rounded border-zinc-300 text-zinc-955 focus:ring-zinc-950"
                          />
                          {group.nombre}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4.5 py-2.5 rounded-xl border border-zinc-200 hover:border-zinc-400 text-xs font-semibold text-zinc-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-1.5 bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
