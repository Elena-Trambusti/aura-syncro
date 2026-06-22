import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import PublicLanguageSwitcher from '../components/public/PublicLanguageSwitcher'
import {
  AlertCircle, Search, X, Star, Wheat, Milk, Egg, Fish, Shell,
  Nut, Bean, Clock, Flame, UtensilsCrossed, CalendarDays,
} from 'lucide-react'

interface MenuItem {
  id: string; name: string; description?: string | null
  price: number
  available: boolean; soldOut?: boolean; orderable?: boolean
  allergens?: string | null
  calories?: number | null
  preparationTime?: number | null
  featured?: boolean
  image?: string | null
}

interface Category {
  id: string
  name: string
  description?: string | null
  items: MenuItem[]
}

const ALLERGEN_ICONS: Record<string, typeof Wheat> = {
  glutine: Wheat, gluten: Wheat, latte: Milk, milk: Milk, latticini: Milk,
  uova: Egg, egg: Egg, eggs: Egg, pesce: Fish, fish: Fish,
  crostacei: Shell, shellfish: Shell, crustaceans: Shell,
  arachidi: Nut, peanut: Nut, peanuts: Nut, frutta: Nut, nuts: Nut,
  soia: Bean, soy: Bean,
}

function AllergenBadge({ allergen }: { allergen: string }) {
  const key = allergen.toLowerCase().trim()
  const Icon = ALLERGEN_ICONS[key] ?? AlertCircle
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {allergen}
    </span>
  )
}

function MenuItemCard({ item }: { item: MenuItem }) {
  const { t } = useTranslation()
  const allergenList = item.allergens?.split(',').map(a => a.trim()).filter(Boolean) ?? []

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        {item.image && (
          <img
            src={item.image}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg border border-slate-100 object-cover"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
                {item.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" aria-hidden />
                    {t('publicMenu.featured')}
                  </span>
                )}
                {item.soldOut && (
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-rose-700">
                    {t('publicMenu.soldOut')}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{item.description}</p>
              )}
            </div>
            <p className="shrink-0 text-lg font-bold tabular-nums text-slate-900">
              {formatCurrency(item.price)}
            </p>
          </div>

          {allergenList.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('publicMenu.allergens')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allergenList.map(a => <AllergenBadge key={a} allergen={a} />)}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            {item.calories != null && item.calories > 0 && (
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" aria-hidden />
                {item.calories} kcal
              </span>
            )}
            {item.preparationTime != null && item.preparationTime > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {t('publicMenu.prepTime', { min: item.preparationTime })}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function parseTableFromSearch(params: URLSearchParams): number | null {
  const raw = params.get('tavolo') ?? params.get('table')
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export default function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const tableNumber = useMemo(() => parseTableFromSearch(searchParams), [searchParams])

  const { data, isLoading, error } = useQuery<{
    restaurant: {
      name: string
      logo?: string | null
      description?: string | null
      colorTheme?: string
      slug: string
    }
    categories: Category[]
  }>({
    queryKey: ['public-menu', slug],
    queryFn: () => api.get(`/public/menu/${slug}`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const categories = useMemo(() => {
    if (!data?.categories) return []
    return data.categories.filter(cat => cat.items.length > 0)
  }, [data?.categories])

  const allItems = useMemo(() => categories.flatMap(c => c.items), [categories])

  const filteredItems = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return allItems.filter(
      i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q),
    )
  }, [search, allItems])

  const activeCategory = selectedCategory
    ? categories.find(c => c.id === selectedCategory)
    : categories[0]

  const displayItems = filteredItems ?? activeCategory?.items ?? []
  const displayTitle = search.trim()
    ? t('publicMenu.searchResults', { query: search })
    : activeCategory?.name ?? t('publicMenu.title')

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500/30 border-t-amber-500" />
          <p className="text-sm font-medium text-slate-500">{t('publicMenu.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !data || !slug) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-rose-500" />
          <h2 className="text-lg font-bold text-slate-900">{t('publicMenu.notFound')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('publicMenu.notFoundHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900">{data.restaurant.name}</h1>
            {data.restaurant.description && (
              <p className="truncate text-xs text-slate-500">{data.restaurant.description}</p>
            )}
            {tableNumber != null && (
              <p className="mt-0.5 text-xs font-semibold text-amber-700">
                {t('publicMenu.tableBadge', { number: tableNumber })}
              </p>
            )}
          </div>
          <PublicLanguageSwitcher />
        </div>

        <div className="border-t border-slate-100 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            <p className="text-sm font-medium text-amber-900">
              {tableNumber != null
                ? t('publicMenu.atTableOrderHint', { number: tableNumber })
                : t('publicMenu.browseBeforeVisitHint')}
            </p>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('publicMenu.searchPlaceholder')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {!search.trim() && categories.length > 1 && (
        <nav
          className="sticky top-[11.5rem] z-10 border-b border-slate-200 bg-white"
          aria-label={t('publicMenu.categories')}
        >
          <div className="flex gap-2 overflow-x-auto px-4 py-2.5 scrollbar-none">
            {categories.map(cat => {
              const isActive = (selectedCategory ?? categories[0]?.id) === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        </nav>
      )}

      <main className="px-4 py-4 pb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {displayTitle}
        </h2>

        {displayItems.length > 0 ? (
          <div className="space-y-3">
            {displayItems.map(item => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center shadow-sm">
            <Search className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-900">{t('publicMenu.noResults')}</p>
            <p className="mt-1 text-sm text-slate-500">{t('publicMenu.noResultsHint')}</p>
          </div>
        )}

        <div className="mt-8 space-y-3">
          {tableNumber != null ? (
            <p className="text-center text-xs text-slate-400">{t('publicMenu.browseOnlyHint')}</p>
          ) : (
            <>
              <Link
                to={`/prenota/${slug}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
              >
                <CalendarDays className="h-4 w-4 text-amber-700" />
                {t('publicMenu.bookTable')}
              </Link>
              <p className="text-center text-xs text-slate-400">{t('publicMenu.bookingFooterHint')}</p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
