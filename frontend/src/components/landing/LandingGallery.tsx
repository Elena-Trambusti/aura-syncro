export default function LandingGallery() {

  // Placeholder arrays per lo scorrimento infinito.
  // L'utente potrà sostituire le URL in questo array quando avrà gli screen definitivi.
  const placeholders = [
    { id: 1, title: 'Dashboard', bg: 'bg-gradient-to-br from-slate-900 to-slate-800', imageUrl: '/screenshots/dashboard.png' },
    { id: 2, title: 'Pagamenti Digitali', bg: 'bg-gradient-to-br from-aura-gold/10 to-slate-900', imageUrl: '/screenshots/pagamenti.png' },
    { id: 3, title: 'Menu QR', bg: 'bg-gradient-to-br from-slate-800 to-slate-900', imageUrl: '/screenshots/menu-qr.png' },
    { id: 4, title: 'Schermata Cucina', bg: 'bg-gradient-to-br from-slate-900 to-aura-gold/5', imageUrl: '/screenshots/cucina.png' },
    { id: 5, title: 'Analytics', bg: 'bg-gradient-to-br from-slate-900 to-slate-800', imageUrl: '/screenshots/analytics.png' },
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
        <div className="flex shrink-0 animate-[marquee_40s_linear_infinite] group-hover:[animation-play-state:paused] gap-8 px-4 items-center">
          {galleryItems.map((item, index) => (
            <div 
              key={`${item.id}-${index}`}
              className="relative w-[320px] sm:w-[600px] shrink-0 rounded-xl overflow-hidden border border-white/10 bg-[#0B0E14] shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:border-aura-gold/40 hover:shadow-aura-signature-glow group/card"
            >
              {/* Browser Header (Mac style) */}
              <div className="h-8 bg-[#1A1D26] border-b border-white/5 flex items-center px-4 gap-2 w-full">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                <div className="ml-4 text-xs font-medium text-slate-500 font-sans truncate">
                  aurasyncro.com / {item.title.toLowerCase().replace(/ /g, '-')}
                </div>
              </div>

              {/* Contenuto / Immagine */}
              <div className="relative aspect-video w-full bg-[#020202]">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover object-left-top opacity-90 transition-opacity duration-500 group-hover/card:opacity-100" />
                ) : (
                  <div className={`w-full h-full ${item.bg} flex items-center justify-center`}>
                    <span className="text-white/30 font-display text-xl sm:text-2xl tracking-wide">
                      {item.title}
                    </span>
                  </div>
                )}
                
                {/* Overlay luxury in hover (gradiente dal basso) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 flex items-end p-6">
                  <div className="flex flex-col translate-y-4 group-hover/card:translate-y-0 transition-transform duration-300">
                    <span className="text-aura-gold font-bold tracking-wider uppercase text-sm mb-1">
                      {item.title}
                    </span>
                    <span className="text-slate-300 text-sm">
                      Esplora il modulo e scopri le funzionalità avanzate.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
