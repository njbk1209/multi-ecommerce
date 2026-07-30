import React from 'react';

const About = () => {
    return (
        <section id="nosotros" className="bg-white py-20 px-6">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">

                {/* Lado de la imagen o Decoración Visual */}
                <div className="w-full md:w-1/2 relative">
                    <div className="aspect-square bg-primary-light rounded-2xl overflow-hidden shadow-sm group">
                        <img
                            src="/images/autoparts_about.png"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1000&q=80";
                            }}
                            alt="Nuestra Tienda de Repuestos y Lubricantes"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    {/* Elemento decorativo flotante */}
                    <div className="absolute -bottom-4 -right-4 bg-primary-dark text-white p-6 rounded-lg hidden md:block shadow-lg">
                        <p className="text-sm font-light tracking-widest font-serif">Calidad & Garantía</p>
                    </div>
                </div>

                {/* Contenido de Texto */}
                <div className="w-full md:w-1/2 text-left">
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary-dark mb-6">
                        Sobre <span className="italic">Nosotros</span>
                    </h2>

                    <div className="space-y-4 text-slate-600/80 text-lg leading-relaxed">
                        <p>
                            Somos especialistas en la importación y comercialización de <strong>repuestos automotrices, kits de tiempo, lubricantes de alto rendimiento y aditivos</strong> para vehículos de todas las marcas.
                        </p>
                        <p>
                            Nos dedicamos a ofrecer soluciones mecánicas confiables con piezas 100% garantizadas, aceites de motor sintéticos y minerales, sistemas de frenos, correas y componentes de suspensión con la mejor relación calidad-precio.
                        </p>
                        <p>
                            Nos mueve la pasión por el rendimiento automotriz, la asesoría técnica personalizada y brindar la máxima compatibilidad para que mantengas tu vehículo siempre en óptimas condiciones de marcha.
                        </p>
                    </div>

                    <div className="mt-8 flex items-center gap-2 text-primary font-serif italic">
                        <span className="h-px w-8 bg-primary-light"></span>
                        <span>Comprometidos con el rendimiento y protección de tu vehículo</span>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default About;