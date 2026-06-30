import { useTranslation } from 'react-i18next'
import {
  Calculator,
  Banknote,
  ShieldAlert,
  FileWarning,
  Ship,
  Layers,
  TrendingDown,
  Scale,
  type LucideIcon,
} from 'lucide-react'
import AuraIcon from '../ui/AuraIcon'

type GalleryProblem = {
  icon: LucideIcon
  title: string
  desc: string
  accent?: string
}

type GalleryData = {
  eyebrow?: string
  title: string
  subtitle: string
  problems: GalleryProblem[]
}

const IT_PROBLEM_KEYS = ['p1', 'p2', 'p3'] as const
const IT_PROBLEM_ICONS: Record<(typeof IT_PROBLEM_KEYS)[number], LucideIcon> = {
  p1: Layers,
  p2: TrendingDown,
  p3: Scale,
}

const MARKET_DATA: Record<string, GalleryData> = {
  es: {
    title: 'Resolvemos los problemas reales de la Hostelería en España',
    subtitle: 'Olvídate de las sanciones de Hacienda. Aura Syncro automatiza tu cumplimiento fiscal y operativo.',
    problems: [
      {
        icon: ShieldAlert,
        title: 'Cumplimiento Veri*Factu',
        desc: 'Sistema certificado que envía automáticamente cada ticket a la Agencia Tributaria en tiempo real, garantizando la inmutabilidad de los datos y evitando multas masivas.',
      },
      {
        icon: FileWarning,
        title: 'Factura Simplificada y TicketBAI',
        desc: 'Generación legal de Facturas Simplificadas y adaptación a normativas regionales estrictas como TicketBAI en el País Vasco, todo sin esfuerzo.',
      },
      {
        icon: Banknote,
        title: 'Control Estricto de Arqueo',
        desc: 'Control exhaustivo de los cierres de caja (Arqueos) y gestión de propinas para cumplir con las inspecciones de la legislación laboral española.',
      },
    ],
  },
  'es-cn': {
    title: 'Soluciones diseñadas exclusivamente para Canarias',
    subtitle: 'No somos un software de la península adaptado a medias. Aura Syncro nació entendiendo el IGIC y el REF.',
    problems: [
      {
        icon: Calculator,
        title: 'Gestión Nativa del IGIC (7%)',
        desc: 'Motor fiscal adaptado 100% para Canarias. Todos los cálculos, tickets y reportes usan el IGIC de forma nativa, sin configuraciones raras ni IVA camuflado.',
      },
      {
        icon: FileWarning,
        title: 'Cumplimiento del REF Canario',
        desc: 'Totalmente adaptado al Régimen Económico y Fiscal de Canarias, simplificando la contabilidad para presentar los reportes a la Agencia Tributaria Canaria.',
      },
      {
        icon: Ship,
        title: 'Control de Stock Aduanero',
        desc: 'Gestión inteligente del inventario que tiene en cuenta los tiempos de importación desde la península (DUA) y los extracostes aduaneros (AIEM).',
      },
    ],
  },
}

function resolveGalleryData(lang: string, t: (key: string) => string): GalleryData {
  const base = lang.split('-')[0]

  if (base === 'it') {
    return {
      title: t('landing.gallery.title'),
      subtitle: t('landing.gallery.subtitle'),
      problems: IT_PROBLEM_KEYS.map(key => ({
        icon: IT_PROBLEM_ICONS[key],
        title: t(`landing.gallery.${key}.title`),
        desc: t(`landing.gallery.${key}.desc`),
      })),
    }
  }

  return MARKET_DATA[lang] ?? MARKET_DATA.es
}

export default function LandingGallery() {
  const { t, i18n } = useTranslation()
  const data = resolveGalleryData(i18n.language || 'it', t)

  return (
    <section className="relative overflow-hidden border-y border-[#D4AF37]/10 py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(212,175,55,0.12),transparent_65%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(0,0,0,0.55),transparent)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent" />

      <div className="relative z-10 mx-auto mb-16 max-w-7xl px-6 text-center lg:px-8">
        {data.eyebrow && (
          <p className="lux-eyebrow mb-4">
            {data.eyebrow}
          </p>
        )}
        <h2 className="lux-heading text-[#C5A059] font-display text-3xl font-medium tracking-tight sm:text-4xl lg:text-5xl">
          {data.title}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base font-light leading-relaxed text-slate-300 sm:text-lg">
          {data.subtitle}
        </p>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {data.problems.map(problem => {
            const Icon = problem.icon
            return (
              <article
                key={problem.title}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#D4AF37]/15 bg-gradient-to-b from-[#1a1408]/90 via-[#0f0c08]/95 to-[#080604] shadow-[0_24px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(232,200,114,0.1)] transition-all duration-500 hover:-translate-y-1 hover:border-[#D4AF37]/35 hover:shadow-[0_28px_56px_rgba(0,0,0,0.55),0_0_40px_rgba(212,175,55,0.08)]"
              >
                <div className="relative flex h-44 items-center justify-center overflow-hidden border-b border-[#D4AF37]/10 bg-gradient-to-br from-[#120e08] to-[#080604]">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.14),transparent_68%)] opacity-60 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-black/60 text-[#E8C872] shadow-[0_0_28px_rgba(212,175,55,0.18)] backdrop-blur-sm transition-all duration-500 group-hover:scale-105 group-hover:border-[#E8C872]/40 group-hover:shadow-[0_0_36px_rgba(212,175,55,0.28)]">
                    <AuraIcon icon={Icon} size="2xl" weight="display" className="text-[#E8C872]" />
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-7 sm:p-8">
                  <h3 className="font-display text-xl font-medium tracking-tight text-slate-100 transition-colors duration-300 group-hover:text-white">
                    {problem.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-300">
                    {problem.desc}
                  </p>
                </div>

                <div className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
