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
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1000&q=80";
                            }}
                            alt="Nuestra Farmacia y Servicios de Salud"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    </div>
                    {/* Elemento decorativo flotante */}
                    <div className="absolute -bottom-4 -right-4 bg-primary-dark text-white p-6 rounded-lg hidden md:block shadow-lg">
                        <p className="text-sm font-light tracking-widest font-serif">Salud & Confianza</p>
                    </div>
                </div>

                {/* Contenido de Texto */}
                <div className="w-full md:w-1/2 text-left">
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary-dark mb-6">
                        Sobre <span className="italic">Nosotros</span>
                    </h2>

                    <div className="space-y-4 text-slate-600/80 text-lg leading-relaxed">
                        <p>
                            Somos una farmacia dedicada a cuidar de ti y de tu familia, ofreciendo una amplia gama de <strong>medicamentos de patente, genéricos, productos de cuidado personal, dermocosmética y suplementos nutricionales</strong> de la más alta calidad.
                        </p>
                        <p>
                            Nos enfocamos en brindar una atención farmacéutica cercana, ética y profesional, garantizando la disponibilidad de tus tratamientos médicos con la mejor asesoría y los mejores precios del mercado.
                        </p>
                        <p>
                            Tu salud y bienestar son nuestra prioridad. Contamos con servicio de despacho rápido y un equipo de profesionales listos para guiarte en el cuidado y conservación de tu salud.
                        </p>
                    </div>

                    <div className="mt-8 flex items-center gap-2 text-primary font-serif italic">
                        <span className="h-px w-8 bg-primary-light"></span>
                        <span>Comprometidos con tu salud, bienestar y calidad de vida</span>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default About;