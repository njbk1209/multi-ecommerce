import React from 'react';

const About = () => {
    return (
        <section id="nosotros" className="bg-white py-20 px-6">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">

                {/* Lado de la imagen o Decoración Visual */}
                <div className="w-full md:w-1/2 relative">
                    <div className="aspect-square bg-primary-light rounded-2xl overflow-hidden shadow-sm group">
                        <img
                            src="/images/pharmacy_about.png"
                            alt="Nuestra Red de Farmacias"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    {/* Elemento decorativo flotante */}
                    <div className="absolute -bottom-4 -right-4 bg-primary-dark text-white p-6 rounded-lg hidden md:block shadow-lg">
                        <p className="text-sm font-light tracking-widest font-serif">Desde 2026</p>
                    </div>
                </div>

                {/* Contenido de Texto */}
                <div className="w-full md:w-1/2 text-left">
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary-dark mb-6">
                        Nuestra <span className="italic">Historia</span>
                    </h2>

                    <div className="space-y-4 text-slate-600/80 text-lg leading-relaxed">
                        <p>
                            Nacimos en la ciudad de <strong>Guanare, Portuguesa</strong>, con el compromiso fundamental de cuidar la salud y el bienestar de nuestra comunidad y familias llaneras.
                        </p>
                        <p>
                            Lo que comenzó como un sueño de brindar atención farmacéutica humana, ética y accesible, se ha consolidado en una red de farmacias modernas distribuidas estratégicamente por la ciudad, ofreciendo siempre medicamentos 100% garantizados y atención profesional personalizada.
                        </p>
                        <p>
                            Nos mueve la vocación de servicio, la confianza de nuestros clientes y el firme propósito de mantener un stock completo en cada una de nuestras sucursales al mejor precio.
                        </p>
                    </div>

                    <div className="mt-8 flex items-center gap-2 text-primary font-serif italic">
                        <span className="h-px w-8 bg-primary-light"></span>
                        <span>Comprometidos con el bienestar de Guanare y Portuguesa</span>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default About;