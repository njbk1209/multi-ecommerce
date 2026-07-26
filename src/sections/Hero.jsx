import React from "react";

const Hero = () => (
  <section id="inicio" className="bg-rose-50 py-16 px-6 text-center">
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-serif font-light text-rose-800 mb-4">
        Pizzas Napolitanas,{" "}
        <span className="italic">Auténtica Pasión Italiana</span>
      </h1>
      <p className="text-rose-600/80 text-lg font-light mb-8">
        Disfruta de la verdadera experiencia napolitana con nuestra masa de
        fermentación lenta y cocción artesanal.
      </p>
      <a
        href="#catalogo"
        className="inline-block bg-rose-400 hover:bg-rose-500 text-white px-8 py-3 rounded-full transition-all shadow-sm"
      >
        Ver Catálogo
      </a>
    </div>
  </section>
);

export default Hero;
