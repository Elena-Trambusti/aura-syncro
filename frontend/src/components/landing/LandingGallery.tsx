export default function LandingGallery() {

  // Placeholder arrays per lo scorrimento infinito.
  // L'utente potrà sostituire le URL in questo array quando avrà gli screen definitivi.
  const placeholders = [
    { id: 1, title: 'Dashboard', bg: 'bg-gradient-to-br from-slate-900 to-slate-800', imageUrl: '/screenshots/dashboard.png' },
    { id: 2, title: 'POS & Cassa', bg: 'bg-gradient-to-br from-aura-gold/10 to-slate-900' },
    { id: 3, title: 'Menu QR', bg: 'bg-gradient-to-br from-slate-800 to-slate-900' },
    { id: 4, title: 'Schermata Cucina', bg: 'bg-gradient-to-br from-slate-900 to-aura-gold/5', imageUrl: '/screenshots/cucina.png' },
    { id: 5, title: 'Analytics', bg: 'bg-gradient-to-br from-slate-900 to-slate-800' },
    { id: 6, title: 'Gestione Tavoli', bg: 'bg-gradient-to-br from-aura-gold/10 to-slate-900', imageUrl: '/screenshots/tavoli.png' },
  ]

  // Duplichiamo per l'effetto loop infinito
  const galleryItems = [...placeholders, ...placeholders]

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden bg-black/40 border-y border-white/5">
      {/* Sfondi e sfumature */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-aura-gold/20 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03),transparent)] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center mb-16 relative z-10">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-white tracking-tight mb-4">
          L'eccellenza in <span className="text-transparent bg-clip-text bg-gradient-to-r from-aura-gold to-aura-gold-light">ogni dettaglio</span>
        </h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Un'interfaccia progettata per offrire il massimo controllo con un'eleganza senza compromessi.
        </p>
      </div>

      {/* Marquee Container */}
      <div className="relative flex overflow-x-hidden w-full group">
        
        {/* Sfumature laterali per fondere il carosello con lo sfondo */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#020202] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#020202] to-transparent z-10 pointer-events-none" />

        {/* Traccia in movimento */}
        <div className="flex shrink-0 animate-[marquee_40s_linear_infinite] group-hover:[animation-play-state:paused] gap-6 px-3">
          {galleryItems.map((item, index) => (
            <div 
              key={`${item.id}-${index}`}
              className="relative w-[300px] h-[200px] sm:w-[450px] sm:h-[300px] shrink-0 rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-transform duration-500 hover:scale-[1.02] hover:border-aura-gold/30 hover:shadow-aura-signature-glow"
            >
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover object-top" />
              ) : (
                <div className={`w-full h-full ${item.bg} flex items-center justify-center`}>
                  <span className="text-white/30 font-display text-xl sm:text-2xl tracking-wide">
                    {item.title}
                  </span>
                </div>
              )}
              
              {/* Overlay luxury in hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100 flex items-end p-6">
                <span className="text-aura-gold font-medium tracking-wider uppercase text-sm">
                  Esplora {item.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
