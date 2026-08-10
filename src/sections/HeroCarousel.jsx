import React, { useState, useEffect, useRef, useCallback } from 'react'

const SLIDES = [
  {
    id: 1,
    image: '/images/hero/pharmacy_slide1.png',
    fallback: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1600&q=80',
    tag: 'Farmacia & Medicamentos',
    title: 'Medicamentos & Salud',
    highlight: 'Garantizados & Certificados',
    description: 'Encuentra medicamentos de patente, genéricos, tratamientos crónicos y productos de primeros auxilios con despacho rápido y seguro.',
    buttonText: 'Ver Medicamentos',
    buttonLink: '#catalogo'
  },
  {
    id: 2,
    image: '/images/hero/pharmacy_slide2.png',
    fallback: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1600&q=80',
    tag: 'Dermocosmética & Cuidado Personal',
    title: 'Cuidado para tu Piel',
    highlight: '& Estética Dermatológica',
    description: 'Protectores solares, tratamientos faciales, cuidado capilar y corporal de marcas dermatológicas líderes.',
    buttonText: 'Explorar Dermocosmética',
    buttonLink: '#catalogo'
  },
  {
    id: 3,
    image: '/images/hero/pharmacy_slide3.png',
    fallback: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1600&q=80',
    tag: 'Bienestar & Nutrición',
    title: 'Vitaminas & Suplementos',
    highlight: 'Para toda la Familia',
    description: 'Multivitamínicos, suplementos nutricionales, cuidado infantil y atención farmacéutica especializada a tu alcance.',
    buttonText: 'Conocer Más',
    buttonLink: '#nosotros'
  }
]

const AUTO_PLAY_INTERVAL = 5000

const HeroCarousel = () => {
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const touchStartX = useRef(null)
  const touchEndX = useRef(null)

  const total = SLIDES.length

  const nextSlide = useCallback(() => {
    setCurrent(prev => (prev + 1) % total)
  }, [total])

  const prevSlide = useCallback(() => {
    setCurrent(prev => (prev - 1 + total) % total)
  }, [total])

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(nextSlide, AUTO_PLAY_INTERVAL)
    return () => clearInterval(timer)
  }, [isPaused, nextSlide])

  // Gestos táctiles para móviles
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    const distance = touchStartX.current - touchEndX.current
    const isLeftSwipe = distance > 40
    const isRightSwipe = distance < -40

    if (isLeftSwipe) {
      nextSlide()
    } else if (isRightSwipe) {
      prevSlide()
    }

    touchStartX.current = null
    touchEndX.current = null
  }

  return (
    <section id="inicio" className="w-full py-6 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div
          className="relative w-full h-[280px] sm:h-[400px] md:h-[450px] rounded-none overflow-hidden shadow-2xl bg-gray-900 group select-none"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Diapositivas */}
          {SLIDES.map((slide, index) => {
            const isActive = index === current
            return (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                  }`}
              >
                {/* Imagen de fondo */}
                <img
                  src={slide.image}
                  onError={(e) => {
                    e.target.onerror = null
                    e.target.src = slide.fallback
                  }}
                  alt={slide.title}
                  className={`w-full h-full object-cover transform transition-transform duration-7000 ease-out ${isActive ? 'scale-105' : 'scale-100'
                    }`}
                />

                {/* Overlay degradado para legibilidad */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/50 to-transparent flex items-center" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20" />

                {/* Contenido textual */}
                <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 md:px-16 max-w-2xl text-white z-20">
                  <span className="inline-block self-start text-xs sm:text-sm font-semibold uppercase tracking-widest text-white bg-primary-dark backdrop-blur-md px-3 py-1 rounded-full mb-2 sm:mb-4 border border-primary shadow-sm">
                    {slide.tag}
                  </span>

                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif font-bold text-white tracking-tight leading-tight mb-2 sm:mb-3 drop-shadow-md">
                    {slide.title}{' '}
                    <span className="italic font-light text-primary block sm:inline">
                      {slide.highlight}
                    </span>
                  </h1>

                  <p className="text-xs sm:text-base md:text-lg text-gray-200 font-light mb-4 sm:mb-6 line-clamp-2 sm:line-clamp-3 max-w-lg leading-relaxed drop-shadow">
                    {slide.description}
                  </p>

                  <div>
                    <a
                      href={slide.buttonLink}
                      className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium px-5 py-2.5 sm:px-7 sm:py-3.5 rounded-full text-xs sm:text-sm transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      {slide.buttonText}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Flecha Izquierda */}
          <button
            onClick={prevSlide}
            aria-label="Anterior diapositiva"
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 rounded-full bg-black/40 hover:bg-primary-dark text-white backdrop-blur-md transition-all duration-300 opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-110 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Flecha Derecha */}
          <button
            onClick={nextSlide}
            aria-label="Siguiente diapositiva"
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3 rounded-full bg-black/40 hover:bg-primary-dark text-white backdrop-blur-md transition-all duration-300 opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-110 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Puntos Indicadores (Dots) */}
          <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 flex justify-center items-center gap-2 z-30">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Ir a diapositiva ${i + 1}`}
                className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 ${i === current
                  ? 'w-7 sm:w-9 bg-primary shadow-md'
                  : 'w-2 sm:w-2.5 bg-white/50 hover:bg-white/80'
                  }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroCarousel
