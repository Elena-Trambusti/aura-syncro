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
import {
  LandingSectionHeader,
  LandingSectionShell,
  LUXURY_CARD_CLASS,
  LuxuryCardHoverLine,
} from './landingLuxury'

type GalleryProblem = {
  icon: LucideIcon
  title: string
  desc: string
}

type GalleryData = {
  eyebrow?: string
  title: string
  subtitle: string
  problems: GalleryProblem[]
}

const GALLERY_PROBLEM_KEYS = ['p1', 'p2', 'p3'] as const
const GALLERY_PROBLEM_ICONS: Record<(typeof GALLERY_PROBLEM_KEYS)[number], LucideIcon> = {
  p1: Layers,
  p2: TrendingDown,
  p3: Scale,
}

const MARKET_DATA: Record<string, GalleryData> = {
  es: {
    eyebrow: 'Hostelería',
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
    eyebrow: 'Canarias',
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

const I18N_GALLERY_LANGS = new Set(['it', 'en', 'de', 'fr'])

function resolveGalleryData(lang: string, t: (key: string) => string): GalleryData {
  const base = lang.split('-')[0]

  if (I18N_GALLERY_LANGS.has(base)) {
    return {
      eyebrow: t('landing.gallery.eyebrow'),
      title: t('landing.gallery.title'),
      subtitle: t('landing.gallery.subtitle'),
      problems: GALLERY_PROBLEM_KEYS.map(key => ({
        icon: GALLERY_PROBLEM_ICONS[key],
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
    <LandingSectionShell>
      <LandingSectionHeader
        eyebrow={data.eyebrow}
        title={data.title}
        subtitle={data.subtitle}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {data.problems.map(problem => {
            const Icon = problem.icon
            return (
              <article key={problem.title} className={LUXURY_CARD_CLASS}>
                <div className="relative flex h-44 items-center justify-center overflow-hidden border-b border-[#D4AF37]/10 bg-gradient-to-br from-[#120e08] to-[#080604]">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.14),transparent_68%)] opacity-60 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-black/60 text-[#E8C872] shadow-[0_0_28px_rgba(212,175,55,0.18)] backdrop-blur-sm transition-all duration-500 group-hover:scale-105 group-hover:border-[#E8C872]/40 group-hover:shadow-[0_0_36px_rgba(212,175,55,0.28)]">
                    <AuraIcon icon={Icon} size="2xl" weight="display" className="text-[#E8C872]" />
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-7 sm:p-8">
                  <h3 className="font-display text-xl font-medium tracking-tight text-[#F0E6D2] transition-colors duration-300 group-hover:text-white">
                    {problem.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm font-light leading-relaxed lux-text-soft">
                    {problem.desc}
                  </p>
                </div>

                <LuxuryCardHoverLine />
              </article>
            )
          })}
        </div>
      </div>
    </LandingSectionShell>
  )
}
