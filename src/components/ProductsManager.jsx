import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Edit3, X, Loader2, Image as ImageIcon, Building2, Star, Link as LinkIcon, Check, Download, Upload, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { useCurrency } from '../context/CurrencyContext'
import toast from 'react-hot-toast'
import { buildCategoryTree } from './CategoriesManager'
import { exportProductsToCSV } from '../utils/csv'
import CSVImportModal from './CSVImportModal'

const slugify = (text) => {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

export default function ProductsManager() {
  const { store } = useCurrency()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [branches, setBranches] = useState([])
  const [branchStockMap, setBranchStockMap] = useState({}) // { producto_id: [ { sucursal_id, nombre, stock, stock_status } ] }
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const handleExportCSV = () => {
    try {
      if (products.length === 0) {
        toast.error('No hay productos en el catálogo para exportar.')
        return
      }
      exportProductsToCSV(products, branchStockMap, branches, store?.comercial_name || 'tienda')
      toast.success('Archivo CSV de inventario generado correctamente.')
    } catch (err) {
      console.error('Error al exportar CSV:', err)
      toast.error(err.message || 'Error al exportar el archivo CSV.')
    }
  }

  // Form fields
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugAutoModified, setSlugAutoModified] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState('')
  const [comparePrice, setComparePrice] = useState('')
  const [branchStocksInput, setBranchStocksInput] = useState({}) // { sucursal_id: stock_val }
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  
  // Lista de Imágenes { id?: string, url: string, is_primary: boolean, file?: File }
  const [imageList, setImageList] = useState([])
  const [newUrlInput, setNewUrlInput] = useState('')

  const [barcode, setBarcode] = useState('')
  const [tax, setTax] = useState('0')
  const [precioPorTamano, setPrecioPorTamano] = useState(false)
  const [allOptionGroups, setAllOptionGroups] = useState([])
  const [selectedGroupIds, setSelectedGroupIds] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories, null, 0)
  }, [categories])

  // Fetch products, categories, branches & stocks
  const fetchData = async () => {
    if (!store?.id) return
    setLoading(true)
    try {
      // 1. Cargar categorías
      const { data: catData, error: catError } = await supabase
        .from('category')
        .select('*')
        .eq('store', store.id)
        .order('name', { ascending: true })

      if (catError) throw catError
      setCategories(catData || [])

      // 2. Cargar sucursales
      const { data: branchData, error: branchErr } = await supabase
        .from('sucursal')
        .select('*')
        .eq('store_id', store.id)
        .order('es_principal', { ascending: false })
        .order('nombre', { ascending: true })

      if (branchErr) throw branchErr
      setBranches(branchData || [])

      // 3. Cargar productos
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

      // 4. Cargar desglose de stock por sucursal
      const branchIds = (branchData || []).map(b => b.id)
      if (branchIds.length > 0) {
        const { data: pssData, error: pssError } = await supabase
          .from('producto_stock_sucursal')
          .select('*')
          .in('sucursal_id', branchIds)

        if (pssError) {
          console.error('Error al cargar stock por sucursal:', pssError)
        } else {
          const map = {}
          const branchNames = {}
          ;(branchData || []).forEach(b => { branchNames[b.id] = b.nombre })
          ;(pssData || []).forEach(item => {
            if (!map[item.producto_id]) map[item.producto_id] = []
            map[item.producto_id].push({
              sucursal_id: item.sucursal_id,
              sucursal_nombre: branchNames[item.sucursal_id] || 'Sucursal',
              stock: item.stock,
              stock_status: item.stock_status
            })
          })
          setBranchStockMap(map)
        }
      }

      // 5. Cargar grupos de opciones
      const { data: optGroupsData, error: optGroupsError } = await supabase
        .from('producto_opciones_grupo')
        .select('id, nombre')
        .eq('store', store.id)
        .order('nombre', { ascending: true })

      if (optGroupsError) throw optGroupsError
      setAllOptionGroups(optGroupsData || [])
    } catch (err) {
      console.error('Error al cargar datos:', err)
      toast.error('No se pudieron cargar los datos del catálogo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [store?.id])

  const handleNameChange = (e) => {
    const val = e.target.value
    setName(val)
    if (!slugAutoModified) {
      setSlug(slugify(val))
    }
  }

  const handleSlugChange = (e) => {
    setSlugAutoModified(true)
    setSlug(e.target.value)
  }

  const handleOpenCreate = () => {
    setEditingProduct(null)
    setName('')
    setSlug('')
    setSlugAutoModified(false)
    setCategoryId(categories[0]?.id || '')
    setSku('PROD-' + Math.floor(100000 + Math.random() * 900000))
    setPrice('')
    setComparePrice('')
    
    // Inicializar inputs de stock por sucursal con 999 por defecto
    const initialStocks = {}
    branches.forEach(b => {
      initialStocks[b.id] = '999'
    })
    setBranchStocksInput(initialStocks)

    setDescription('')
    setIsActive(true)
    setImageList([])
    setNewUrlInput('')
    setSelectedGroupIds([])
    setBarcode('')
    setTax('0')
    setPrecioPorTamano(false)
    setModalOpen(true)
  }

  const handleOpenEdit = (product) => {
    setEditingProduct(product)
    setName(product.name || '')
    setSlug(product.slug || slugify(product.name || ''))
    setSlugAutoModified(true)
    setCategoryId(product.category?.id || '')
    setSku(product.sku || '')
    setPrice(product.price ? product.price.toString() : '')
    setComparePrice(product.compare_price ? product.compare_price.toString() : '')
    
    // Cargar stock por sucursal existente
    const stocks = {}
    const pss = branchStockMap[product.id] || []
    branches.forEach(b => {
      const match = pss.find(item => item.sucursal_id === b.id)
      stocks[b.id] = match ? match.stock.toString() : '0'
    })
    setBranchStocksInput(stocks)

    setDescription(product.description || '')
    setIsActive(product.is_active)
    setBarcode(product.barcode || '')
    setTax(product.tax ? product.tax.toString() : '0')
    setPrecioPorTamano(product.precio_por_tamano || false)
    setSelectedGroupIds(product.producto_grupo_relacion?.map(rel => rel.grupo_id) || [])

    // Cargar imágenes existentes
    const existingImages = (product.ProductImagen || []).map(img => ({
      id: img.id,
      url: img.url,
      is_primary: img.is_primary
    }))

    // Asegurar que al menos una sea principal si existen imágenes
    if (existingImages.length > 0 && !existingImages.some(img => img.is_primary)) {
      existingImages[0].is_primary = true
    }

    setImageList(existingImages)
    setNewUrlInput('')
    setModalOpen(true)
  }

  // Manejador de selección múltiple de archivos de imagen
  const handleMultipleFilesChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newItems = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`El archivo ${file.name} no es una imagen.`)
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`La imagen ${file.name} supera los 5MB.`)
        continue
      }
      newItems.push({
        url: URL.createObjectURL(file),
        is_primary: false,
        file: file
      })
    }

    if (newItems.length > 0) {
      setImageList(prev => {
        const list = [...prev, ...newItems]
        if (!list.some(img => img.is_primary) && list.length > 0) {
          list[0].is_primary = true
        }
        return list
      })
    }

    e.target.value = null
  }

  // Manejador para añadir una URL de imagen manualmente
  const handleAddUrlImage = () => {
    if (!newUrlInput.trim()) return
    const url = newUrlInput.trim()
    
    setImageList(prev => {
      const isFirst = prev.length === 0
      return [...prev, { url, is_primary: isFirst }]
    })
    setNewUrlInput('')
  }

  // Establecer imagen principal
  const handleSetPrimaryImage = (index) => {
    setImageList(prev => prev.map((img, i) => ({
      ...img,
      is_primary: i === index
    })))
  }

  // Eliminar una imagen de la lista
  const handleRemoveImageItem = (index) => {
    setImageList(prev => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length > 0 && !updated.some(img => img.is_primary)) {
        updated[0].is_primary = true
      }
      return updated
    })
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
      const finalSlug = slugify(slug || name)

      // 1. Calcular stock total sumando todas las sucursales
      const totalStockSum = Object.values(branchStocksInput).reduce((sum, val) => sum + (parseInt(val) || 0), 0)

      const productPayload = {
        store: store.id,
        name: name.trim(),
        slug: finalSlug,
        category: parseInt(categoryId),
        sku: sku.trim().toUpperCase(),
        price: parseFloat(price),
        compare_price: comparePrice ? parseFloat(comparePrice) : null,
        stock: totalStockSum,
        stock_status: totalStockSum > 0,
        description: description.trim(),
        is_active: isActive,
        barcode: barcode.trim() || null,
        tax: parseFloat(tax) || 0,
        precio_por_tamano: precioPorTamano
      }

      let productId

      if (editingProduct) {
        const { error } = await supabase
          .from('producto')
          .update(productPayload)
          .eq('id', editingProduct.id)

        if (error) throw error
        productId = editingProduct.id
      } else {
        const { data, error } = await supabase
          .from('producto')
          .insert(productPayload)
          .select('id')
          .single()

        if (error) throw error
        productId = data.id
      }

      // 2. Guardar stock en producto_stock_sucursal para cada sucursal
      if (branches.length > 0) {
        const pssPayload = branches.map(b => {
          const sVal = parseInt(branchStocksInput[b.id]) || 0
          return {
            producto_id: productId,
            sucursal_id: b.id,
            stock: sVal,
            stock_status: sVal > 0
          }
        })

        const { error: pssErr } = await supabase
          .from('producto_stock_sucursal')
          .upsert(pssPayload, { onConflict: 'producto_id, sucursal_id' })

        if (pssErr) {
          console.error('Error al guardar stock por sucursal:', pssErr)
        }
      }

      // 3. Subir imágenes nuevas a Supabase Storage y preparar lista final para ProductImagen
      const storeFolderName = store?.comercial_name
        ? slugify(store.comercial_name)
        : `store-${store.id}`

      const finalImagesToSave = []

      for (let i = 0; i < imageList.length; i++) {
        const item = imageList[i]
        let imgUrl = item.url

        if (item.file) {
          const fileExt = item.file.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
          const filePath = `${storeFolderName}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('productos')
            .upload(filePath, item.file)

          if (uploadError) {
            console.error('Error al subir imagen a Supabase Storage:', uploadError)
            if (uploadError.message?.includes('Bucket not found') || uploadError.error === 'Bucket not found' || uploadError.statusCode === '404') {
              toast.error("El bucket 'productos' no existe en Supabase Storage. Créalo como público en Supabase.", { duration: 6000 })
            }
          } else {
            const { data: urlData } = supabase.storage
              .from('productos')
              .getPublicUrl(filePath)
            imgUrl = urlData.publicUrl
          }
        }

        if (imgUrl && imgUrl.trim()) {
          finalImagesToSave.push({
            product: productId,
            url: imgUrl.trim(),
            is_primary: !!item.is_primary,
            order: i
          })
        }
      }

      // Sincronizar tabla ProductImagen (borrar anteriores e insertar lista final actualizada)
      await supabase
        .from('ProductImagen')
        .delete()
        .eq('product', productId)

      if (finalImagesToSave.length > 0) {
        const { error: imgInsertError } = await supabase
          .from('ProductImagen')
          .insert(finalImagesToSave)

        if (imgInsertError) {
          console.error('Error al guardar lista de imágenes:', imgInsertError)
        }
      }

      // 4. Opciones relacionales (tabla producto_grupo_relacion)
      if (editingProduct) {
        const { error: relDeleteError } = await supabase
          .from('producto_grupo_relacion')
          .delete()
          .eq('producto_id', productId)

        if (relDeleteError) console.error('Error al limpiar relaciones:', relDeleteError)
      }

      if (selectedGroupIds.length > 0) {
        const relationsPayload = selectedGroupIds.map((groupId, index) => ({
          producto_id: productId,
          grupo_id: groupId,
          orden: index
        }))

        const { error: relInsertError } = await supabase
          .from('producto_grupo_relacion')
          .insert(relationsPayload)

        if (relInsertError) console.error('Error al insertar relaciones de grupos:', relInsertError)
      }

      toast.success(editingProduct ? 'Producto actualizado correctamente.' : 'Producto creado con éxito.')
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
          <p className="text-xs text-zinc-400 font-medium">Administra los productos, precios, inventarios por sucursal y visibilidad.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={products.length === 0}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl border transition-all shadow-sm active:scale-95
              ${products.length === 0
                ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                : 'bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-300 hover:border-zinc-400'}`}
            title="Descargar plantilla CSV con el inventario actual"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Bajar CSV
          </button>

          <button
            onClick={() => setCsvModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-xl border bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-300 hover:border-zinc-400 transition-all shadow-sm active:scale-95"
            title="Subir archivo CSV para actualizar inventario y productos"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            Subir CSV
          </button>

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
                  <th className="px-6 py-4">Stock por Sucursal</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm text-zinc-700">
                {products.map((product) => {
                  const images = product.ProductImagen || []
                  const mainImg = images.find(img => img.is_primary) || images[0]
                  const pssList = branchStockMap[product.id] || []
                  const totalStock = pssList.reduce((sum, item) => sum + (item.stock || 0), 0)

                  return (
                    <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-100 bg-zinc-50 flex items-center justify-center shrink-0">
                            {mainImg ? (
                              <img src={mainImg.url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-zinc-300" />
                            )}
                            {images.length > 1 && (
                              <span className="absolute bottom-0 right-0 bg-zinc-900/80 text-white text-[9px] font-bold px-1 rounded-tl">
                                +{images.length - 1}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-900 block leading-tight">{product.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {product.sku && <span className="text-[10px] text-zinc-400 font-mono">SKU: {product.sku}</span>}
                              {product.slug && <span className="text-[10px] text-zinc-400 font-mono">/{product.slug}</span>}
                            </div>
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
                      <td className="px-6 py-4">
                        {pssList.length === 0 ? (
                          <span className="text-xs text-zinc-400 font-mono font-bold">{totalStock || product.stock || 0} unid.</span>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-xs font-bold font-mono text-zinc-900 block">
                              Total: {totalStock} unid.
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {pssList.map((item) => (
                                <span
                                  key={item.sucursal_id}
                                  className={`text-[10px] px-2 py-0.5 rounded border font-mono ${
                                    item.stock > 0
                                      ? 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                      : 'bg-rose-50 text-rose-600 border-rose-200 font-bold'
                                  }`}
                                >
                                  {item.sucursal_nombre}: {item.stock}
                                </span>
                              ))}
                            </div>
                          </div>
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
              
              {/* Nombre y Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre del Producto *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={handleNameChange}
                    placeholder="Ej. Torta Tres Leches"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Slug URL *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={slug}
                      onChange={handleSlugChange}
                      placeholder="torta-tres-leches"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all font-mono bg-zinc-50/50"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 font-medium">Auto-generado desde el nombre. URL limpia para la web.</p>
                </div>
              </div>

              {/* Categoría y SKU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Categoría *</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all bg-white"
                  >
                    {categoryTree.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {'— '.repeat(cat.depth)}
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">SKU (Código único) *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Ej. TORT-001"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all font-mono uppercase"
                  />
                </div>
              </div>

              {/* Precio y Precio de Comparación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Precio ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ej. 12.50"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all font-mono"
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
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all font-mono"
                  />
                </div>
              </div>

              {/* Inventario por Sucursal */}
              {branches.length > 0 && (
                <div className="space-y-2 border-t border-zinc-100 pt-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                    Inventario Inicial por Sucursal / Almacén
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-50/50 p-4 border border-zinc-200/80 rounded-xl">
                    {branches.map((branch) => (
                      <div key={branch.id} className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700 block truncate">
                          {branch.nombre} {branch.es_principal ? '(Principal)' : ''}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={branchStocksInput[branch.id] !== undefined ? branchStocksInput[branch.id] : '0'}
                          onChange={(e) =>
                            setBranchStocksInput({
                              ...branchStocksInput,
                              [branch.id]: e.target.value
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs font-mono font-bold bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Barcode y Tax */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Código de Barras (Barcode - Opcional)</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Ej. 750103049..."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all font-mono"
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
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm transition-all font-mono"
                  />
                </div>
              </div>

              {/* SECCIÓN MULTI-IMÁGENES */}
              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                    Galería de Imágenes del Producto ({imageList.length})
                  </label>
                  <span className="text-[10px] text-zinc-400 font-medium">Haz clic en la estrella ⭐ para fijar la imagen principal</span>
                </div>

                {/* Subir archivos múltiples o pegar URL */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-300 hover:border-zinc-500 bg-zinc-50/50 hover:bg-zinc-50 py-3 px-4 rounded-xl cursor-pointer transition-all">
                    <span className="text-xs text-zinc-700 font-semibold flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-zinc-500" />
                      Subir Imágenes (Seleccionar Varias)
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleMultipleFilesChange}
                    />
                  </label>

                  <div className="flex-1 flex gap-2">
                    <input
                      type="url"
                      value={newUrlInput}
                      onChange={(e) => setNewUrlInput(e.target.value)}
                      placeholder="O pegar URL de imagen..."
                      className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 focus:ring-1 focus:ring-zinc-950 outline-none text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddUrlImage}
                      className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-semibold shrink-0 transition-colors"
                    >
                      Añadir
                    </button>
                  </div>
                </div>

                {/* Galería de miniaturas */}
                {imageList.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
                    {imageList.map((img, index) => (
                      <div
                        key={index}
                        className={`relative group rounded-xl overflow-hidden border-2 aspect-square bg-zinc-50 shadow-sm transition-all ${
                          img.is_primary ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-zinc-200'
                        }`}
                      >
                        <img src={img.url} alt={`Imagen ${index + 1}`} className="w-full h-full object-cover" />

                        {/* Badge de Imagen Principal */}
                        {img.is_primary && (
                          <span className="absolute top-1.5 left-1.5 bg-amber-400 text-amber-950 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow">
                            <Star className="w-2.5 h-2.5 fill-current" /> Principal
                          </span>
                        )}

                        {/* Acciones en Hover */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                          {!img.is_primary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryImage(index)}
                              className="p-1.5 bg-amber-400 text-amber-950 rounded-lg hover:scale-105 transition-transform"
                              title="Marcar como Principal"
                            >
                              <Star className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImageItem(index)}
                            className="p-1.5 bg-rose-600 text-white rounded-lg hover:scale-105 transition-transform"
                            title="Eliminar imagen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Escribe detalles del producto, características, etc..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-950 outline-none text-sm resize-none transition-all"
                />
              </div>

              {/* Toggles */}
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
                    Variantes definen el precio
                  </label>
                </div>
              </div>

              {/* Grupos de opciones adicionales */}
              {allOptionGroups.length > 0 && (
                <div className="space-y-2 border-t border-zinc-100 pt-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Modificadores y Grupos de Opciones Vinculados
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {allOptionGroups.map((group) => {
                      const isSelected = selectedGroupIds.includes(group.id)
                      return (
                        <label
                          key={group.id}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <span>{group.nombre}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroupIds([...selectedGroupIds, group.id])
                              } else {
                                setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.id))
                              }
                            }}
                            className="hidden"
                          />
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-3">
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

      {/* Modal de Importación CSV */}
      <CSVImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        existingProducts={products}
        branches={branches}
        onImportSuccess={fetchData}
      />
    </div>
  )
}
