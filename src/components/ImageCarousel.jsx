import React, {useState, useEffect, useRef, useCallback} from 'react'

const AUTO_SCROLL_INTERVAL = 3000

const ImageCarousel = ({ images, name, isOutOfStock }) => {
  const [current, setCurrent]     = useState(0)
  const [isPaused, setIsPaused]   = useState(false)
  const touchStartX               = useRef(null)
  const intervalRef               = useRef(null)

  const sorted = images?.length
    ? [...images].sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0))
    : []

  const total = sorted.length

  const next = useCallback(() => {
    setCurrent(prev => (prev + 1) % total)
  }, [total])

  const prev = useCallback(() => {
    setCurrent(prev => (prev - 1 + total) % total)
  }, [total])

  useEffect(() => {
    if (total <= 1 || isPaused) return
    intervalRef.current = setInterval(next, AUTO_SCROLL_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [total, isPaused, next])

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev()
    touchStartX.current = null
  }

  if (!total) return (
    <div className="w-full h-full flex items-center justify-center bg-primary-light/30 text-primary/40 text-sm font-medium">
      Sin imagen
    </div>
  )

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Imágenes */}
      {sorted.map((img, i) => (
        <img
          key={img.id}
          src={img.image}
          alt={`${name} ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500
            ${i === current ? 'opacity-100' : 'opacity-0'}
            ${!isOutOfStock ? 'group-hover:scale-105' : ''}
            transition-transform duration-500`}
        />
      ))}

      {/* Puntos indicadores — solo si hay más de 1 imagen */}
      {total > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
          {sorted.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i) }}
              className={`rounded-full transition-all duration-300
                ${i === current
                  ? 'bg-white w-3.5 h-1.5'
                  : 'bg-white/50 w-1.5 h-1.5'
                }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageCarousel