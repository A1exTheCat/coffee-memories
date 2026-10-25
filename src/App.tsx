import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bean, Check, ChevronDown,
  Coffee, Download, ImagePlus, LoaderCircle, MapPin, Plus,
  RefreshCw, Search, SlidersHorizontal, Star, Trash2, Upload, X,
} from 'lucide-react'
import { deletePack, exportArchive, getPacks, newRecipe, savePack } from './lib/store'
import { isSupabaseConfigured } from './lib/supabase'
import type { CoffeePack, CoffeePackInput, Recipe } from './types'
import './App.css'

type Screen = 'home' | 'collection'
type ModalState = 'add' | 'view' | 'edit' | null

const EMPTY_PACK: CoffeePackInput = {
  id: '', name: '', country: '', region: '', variety: '', process: '', priceEur: null,
  shop: '', rating: null, notes: '', recipes: [],
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function getGrindLabel(step: number) {
  const whole = 3 + Math.floor(step / 3)
  const third = step % 3
  if (third === 0) return String(whole)
  return `${whole}${third === 1 ? '⅓' : '⅔'}`
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [packs, setPacks] = useState<CoffeePack[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [selected, setSelected] = useState<CoffeePack | null>(null)
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [processFilter, setProcessFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('recent')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    setLoading(true)
    setLoadError('')
    try {
      setPacks(await getPacks())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your collection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void reload() }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (!modal) return
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) setModal(null) }
    window.addEventListener('keydown', handleKey)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.classList.remove('modal-open')
    }
  }, [modal, busy])

  const countries = useMemo(() => [...new Set(packs.map((pack) => pack.country).filter(Boolean))].sort(), [packs])
  const processes = useMemo(() => [...new Set(packs.map((pack) => pack.process).filter(Boolean))].sort(), [packs])
  const filteredPacks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const result = packs.filter((pack) => {
      const searchable = [pack.name, pack.country, pack.region, pack.variety, pack.process, pack.shop, pack.notes]
        .join(' ').toLowerCase()
      return (!normalized || searchable.includes(normalized))
        && (!countryFilter || pack.country === countryFilter)
        && (!processFilter || pack.process === processFilter)
        && (!ratingFilter || String(pack.rating) === ratingFilter)
    })
    return result.sort((a, b) => {
      if (sortOrder === 'oldest') return a.createdAt.localeCompare(b.createdAt)
      if (sortOrder === 'name') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      if (sortOrder === 'rating') return (b.rating ?? 0) - (a.rating ?? 0) || b.createdAt.localeCompare(a.createdAt)
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [packs, query, countryFilter, processFilter, ratingFilter, sortOrder])

  const openAdd = () => { setSelected(null); setModal('add') }
  const openPack = (pack: CoffeePack) => { setSelected(pack); setModal('view') }
  async function handleSave(input: CoffeePackInput, photo: File | null) {
    setBusy(true)
    try {
      const saved = await savePack(input, photo)
      if (!isSupabaseConfigured) setToast('Saved on this device')
      else setToast(input.id ? 'Coffee updated' : 'Coffee added to your collection')
      await reload()
      setSelected(saved)
      setModal('view')
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Could not save this coffee.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(pack: CoffeePack) {
    if (!window.confirm(`Delete “${pack.name}” and its recipes? This cannot be undone.`)) return
    setBusy(true)
    try {
      await deletePack(pack)
      setPacks((current) => current.filter((item) => item.id !== pack.id))
      setSelected(null)
      setModal(null)
      setToast('Coffee deleted')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not delete this coffee.')
    } finally {
      setBusy(false)
    }
  }

  async function handleExport() {
    if (!packs.length) return
    setBusy(true)
    try {
      await exportArchive(packs)
      setToast('Your archive is ready')
    } catch {
      setToast('Could not create the archive')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen('home')} aria-label="Go to home">
          <span className="brand-mark"><Bean size={19} strokeWidth={1.7} /></span>
          <span>Coffee memories</span>
        </button>
        <nav className="topnav" aria-label="Main navigation">
          <button type="button" className={screen === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => setScreen('home')}>Home</button>
          <button type="button" className={screen === 'collection' ? 'nav-link active' : 'nav-link'} onClick={() => setScreen('collection')}>My collection</button>
        </nav>
      </header>

      <main>
        {loadError && <div className="error-banner"><span>{loadError}</span><button onClick={() => void reload()}>Try again</button></div>}
        {screen === 'home' ? (
          <HomeScreen onAdd={openAdd} onCollection={() => setScreen('collection')} />
        ) : (
          <CollectionScreen
            packs={filteredPacks} total={packs.length} loading={loading} query={query}
            onQuery={setQuery} countries={countries} processes={processes}
            countryFilter={countryFilter} processFilter={processFilter} ratingFilter={ratingFilter}
            sortOrder={sortOrder} onSort={setSortOrder}
            onCountry={setCountryFilter} onProcess={setProcessFilter} onRating={setRatingFilter}
            onAdd={openAdd} onOpen={openPack} onRefresh={() => void reload()}
            onExport={() => void handleExport()} exporting={busy}
          />
        )}
      </main>

      {modal && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setModal(null) }}>
          <section className="coffee-modal" role="dialog" aria-modal="true" aria-label={modal === 'add' ? 'Add coffee' : selected?.name || 'Coffee details'}>
            <button className="modal-close" onClick={() => setModal(null)} aria-label="Close" disabled={busy}><X size={20} /></button>
            {modal === 'view' && selected && <CoffeeDetails pack={selected} busy={busy} onEdit={() => setModal('edit')} onDelete={() => void handleDelete(selected)} onClose={() => setModal(null)} />}
            {(modal === 'add' || modal === 'edit') && (
              <CoffeeEditor
                initial={modal === 'edit' && selected ? selected : EMPTY_PACK}
                mode={modal} busy={busy} onCancel={() => modal === 'edit' && selected ? setModal('view') : setModal(null)}
                onSave={handleSave}
              />
            )}
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  )
}

function HomeScreen({ onAdd, onCollection }: {
  onAdd: () => void; onCollection: () => void
}) {
  return (
    <div className="home-page page-wrap">
      <section className="minimal-home">
        <div className="hero-actions">
          <button type="button" className="button button-dark" onClick={onCollection}>My collection <ArrowRight size={16} /></button>
          <button type="button" className="button button-outline" onClick={onAdd}><Plus size={16} /> Add new</button>
        </div>
      </section>
    </div>
  )
}

function FilterDropdown({ label, value, options, onChange }: {
  label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className={`filter-dropdown${open ? ' is-open' : ''}`} ref={root}>
      <button type="button" className="filter-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{options.find((option) => option.value === value)?.label || label}</span><ChevronDown size={14} />
      </button>
      {open && <div className="filter-menu" role="listbox" aria-label={label}>
        {options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'filter-option selected' : 'filter-option'} key={option.value} onClick={() => { onChange(option.value); setOpen(false) }}>{option.label}</button>)}
      </div>}
    </div>
  )
}

function CollectionScreen({ packs, total, loading, query, onQuery, countries, processes, countryFilter, processFilter, ratingFilter, sortOrder, onSort, onCountry, onProcess, onRating, onAdd, onOpen, onRefresh, onExport, exporting }: {
  packs: CoffeePack[]; total: number; loading: boolean; query: string; onQuery: (value: string) => void
  countries: string[]; processes: string[]; countryFilter: string; processFilter: string; ratingFilter: string
  sortOrder: string; onSort: (value: string) => void
  onCountry: (value: string) => void; onProcess: (value: string) => void; onRating: (value: string) => void
  onAdd: () => void; onOpen: (pack: CoffeePack) => void; onRefresh: () => void; onExport: () => void; exporting: boolean
}) {
  const hasFilters = Boolean(query || countryFilter || processFilter || ratingFilter)
  const clearFilters = () => { onQuery(''); onCountry(''); onProcess(''); onRating('') }
  return (
    <div className="collection-page page-wrap">
      <div className="collection-heading">
        <div><span className="eyebrow"><span className="eyebrow-line" /> THE COFFEE JOURNAL</span><h1>My <em>collection.</em></h1><p className="collection-subtitle">A shelf of good cups and the stories behind them.</p></div>
        <div className="collection-actions">
          <button className="button button-light" onClick={onExport} disabled={!total || exporting}>{exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} Export</button>
          <button className="button button-dark" onClick={onAdd}><Plus size={17} /> Add coffee</button>
        </div>
      </div>
      <div className="collection-tools">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search your coffees…" /></label>
        <div className="filters-row"><span className="filter-label"><SlidersHorizontal size={15} /> FILTER BY</span>
          <FilterDropdown label="All origins" value={countryFilter} options={[{ value: '', label: 'All origins' }, ...countries.map((item) => ({ value: item, label: item }))]} onChange={onCountry} />
          <FilterDropdown label="All processes" value={processFilter} options={[{ value: '', label: 'All processes' }, ...processes.map((item) => ({ value: item, label: item }))]} onChange={onProcess} />
          <FilterDropdown label="Any rating" value={ratingFilter} options={[{ value: '', label: 'Any rating' }, ...[5, 4, 3, 2, 1].map((value) => ({ value: String(value), label: `${value} stars` }))]} onChange={onRating} />
          <button className="refresh-button" onClick={onRefresh} title="Refresh collection"><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      <div className="results-line"><span>{loading ? 'UPDATING COLLECTION…' : `${packs.length} ${packs.length === 1 ? 'COFFEE' : 'COFFEES'}${hasFilters ? ' FOUND' : ''}`}</span><label className="results-sort">SORT BY <select aria-label="Sort coffees" value={sortOrder} onChange={(event) => onSort(event.target.value)}><option value="recent">Most recent</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="rating">Top rated</option></select><ArrowDown size={13} /></label></div>
      {loading && !total ? <div className="loading-state"><LoaderCircle className="spin" size={22} /><span>Gathering your coffees…</span></div> : packs.length ? (
        <div className="coffee-grid">{packs.map((pack, index) => <CoffeeCard key={pack.id} pack={pack} index={index} onClick={() => onOpen(pack)} />)}</div>
      ) : (
        <div className="empty-state"><div className="empty-art"><Coffee size={33} strokeWidth={1.2} /><span>✳</span></div><span className="eyebrow"><span className="eyebrow-line" /> {hasFilters ? 'NO MATCHES YET' : 'A FRESH PAGE'}</span><h2>{hasFilters ? 'Nothing found.' : <>Your next favourite<br />starts here.</>}</h2><p>{hasFilters ? 'Try changing your search or clearing the filters.' : 'Add a coffee you’ve enjoyed and keep its story close.'}</p>{hasFilters ? <button className="button button-light" onClick={clearFilters}>Clear filters</button> : <button className="button button-dark" onClick={onAdd}><Plus size={17} /> Add your first coffee</button>}</div>
      )}
    </div>
  )
}

function CoffeeCard({ pack, index, onClick }: { pack: CoffeePack; index: number; onClick: () => void }) {
  return (
    <button className={`coffee-card card-tone-${index % 4}`} onClick={onClick}>
      <div className="card-photo">
        {pack.imageUrl ? <img src={pack.imageUrl} alt={`${pack.name} coffee bag`} /> : <div className="photo-placeholder"><div className="placeholder-sun" /><Bean size={36} strokeWidth={1.1} /><span>ADD A PHOTO</span></div>}
        <span className="card-date">{formatDate(pack.createdAt)}</span>
        <span className="card-arrow"><ArrowUpRight size={17} /></span>
      </div>
      <div className="card-body"><div className="card-title-row"><h3>{pack.name}</h3>{pack.rating && <span className="card-rating"><Star size={12} fill="currentColor" /> {pack.rating}</span>}</div>
        <p className="card-origin"><MapPin size={13} /> {[pack.region, pack.country].filter(Boolean).join(', ') || 'Origin not added'}</p>
        <div className="card-tags">{pack.process && <span>{pack.process}</span>}{pack.variety && <span>{pack.variety}</span>}{!pack.process && !pack.variety && <span className="muted-tag">New discovery</span>}</div>
      </div>
    </button>
  )
}

function CoffeeDetails({ pack, busy, onEdit, onDelete, onClose }: { pack: CoffeePack; busy: boolean; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  return (
    <div className="detail-view">
      <div className="detail-image">{pack.imageUrl ? <img src={pack.imageUrl} alt={`${pack.name} coffee`} /> : <div className="photo-placeholder"><div className="placeholder-sun" /><Bean size={43} strokeWidth={1.1} /><span>NO PHOTO YET</span></div>}
        <button className="detail-back" onClick={onClose}><ArrowLeft size={16} /> Collection</button>
        <span className="detail-date">ADDED {formatDate(pack.createdAt).toUpperCase()}</span>
      </div>
      <div className="detail-content">
        <div className="detail-title-row"><div><span className="eyebrow"><span className="eyebrow-line" /> COFFEE NOTES</span><h2>{pack.name}</h2></div>{pack.rating && <div className="detail-rating"><Star size={15} fill="currentColor" /><strong>{pack.rating}</strong><span>/ 5</span></div>}</div>
        <div className="detail-origin"><MapPin size={15} /> {[pack.region, pack.country].filter(Boolean).join(', ') || 'Origin not recorded'}</div>
        <div className="detail-facts">{[
          ['VARIETY', pack.variety], ['PROCESS', pack.process], ['PAID', pack.priceEur !== null ? `€${pack.priceEur.toFixed(2)}` : '—'], ['PICKED UP AT', pack.shop],
        ].map(([label, value]) => <div className="fact" key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}</div>
        {pack.notes && <div className="detail-notes"><span className="eyebrow">TASTING NOTES</span><p>{pack.notes}</p></div>}
        <div className="recipes-section"><div className="recipes-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> THE BREW</span><h3>Filter recipes <span>{String(pack.recipes.length).padStart(2, '0')}</span></h3></div><span className="brew-chip"><Coffee size={13} /> POUR OVER</span></div>
          {pack.recipes.length ? <div className="recipe-list">{pack.recipes.map((recipe, index) => <RecipeCard recipe={recipe} number={index + 1} key={recipe.id} />)}</div> : <div className="no-recipes"><span>No recipes saved for this coffee yet.</span><button onClick={onEdit}>Add a recipe <ArrowRight size={14} /></button></div>}
        </div>
        <div className="detail-actions"><button className="button button-dark" onClick={onEdit}><SlidersHorizontal size={15} /> Edit details</button><button className="button button-danger" onClick={onDelete} disabled={busy}><Trash2 size={15} /> Delete</button></div>
      </div>
    </div>
  )
}

function RecipeCard({ recipe, number }: { recipe: Recipe; number: number }) {
  return <div className="recipe-card"><div className="recipe-number">{String(number).padStart(2, '0')}</div><div className="recipe-metrics"><div><strong>{recipe.temperatureC}°</strong><span>WATER</span></div><div className="metric-divider" /><div><strong>{getGrindLabel(recipe.grindStep)}</strong><span>GRIND</span></div></div>{recipe.note && <p>{recipe.note}</p>}</div>
}

function CoffeeEditor({ initial, mode, busy, onCancel, onSave }: {
  initial: CoffeePackInput; mode: 'add' | 'edit'; busy: boolean
  onCancel: () => void; onSave: (pack: CoffeePackInput, photo: File | null) => Promise<void>
}) {
  const [draft, setDraft] = useState<CoffeePackInput>(() => ({ ...initial, recipes: initial.recipes.map((recipe) => ({ ...recipe })) }))
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.imageUrl || null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!photo) return
    const objectUrl = URL.createObjectURL(photo)
    setPhotoPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  const update = <K extends keyof CoffeePackInput>(key: K, value: CoffeePackInput[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const setRecipe = (index: number, field: keyof Recipe, value: string | number) => {
    const recipes = [...draft.recipes]
    recipes[index] = { ...recipes[index], [field]: value }
    update('recipes', recipes)
  }
  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return }
    setError('')
    setPhoto(file)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try { await onSave(draft, photo) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this coffee.') }
  }

  return (
    <form className="editor-view" onSubmit={submit}>
      <div className="editor-header"><span className="eyebrow"><span className="eyebrow-line" /> {mode === 'add' ? 'A NEW DISCOVERY' : 'UPDATE YOUR NOTES'}</span><h2>{mode === 'add' ? <>Add a <em>coffee.</em></> : <>Edit <em>details.</em></>}</h2><p>{mode === 'add' ? 'Save a bag you’ve enjoyed, one detail at a time.' : 'Keep the details of this bag up to date.'}</p></div>
      <label className="photo-upload" style={photoPreview ? { backgroundImage: `linear-gradient(180deg, transparent 60%, rgba(33,27,22,.45)), url("${photoPreview}")` } : undefined}>
        <input type="file" accept="image/*" onChange={handlePhoto} />
        <span className="upload-icon"><ImagePlus size={20} /></span><span className="upload-copy"><strong>{photoPreview ? 'Change coffee photo' : 'Add a coffee photo'}</strong><small>Optional · JPG, PNG or WebP</small></span><span className="upload-action"><Upload size={15} /></span>
      </label>

      <div className="form-section"><div className="form-section-title"><span>01</span><h3>The bag</h3><i /></div>
        <div className="field-grid">
          <Field label="Coffee name" required><input value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. La Esperanza" required /></Field>
          <Field label="Country"><input value={draft.country} onChange={(event) => update('country', event.target.value)} placeholder="e.g. Colombia" /></Field>
          <Field label="Region"><input value={draft.region} onChange={(event) => update('region', event.target.value)} placeholder="e.g. Huila" /></Field>
          <Field label="Variety"><input value={draft.variety} onChange={(event) => update('variety', event.target.value)} placeholder="e.g. Caturra" /></Field>
          <Field label="Process"><input value={draft.process} onChange={(event) => update('process', event.target.value)} placeholder="e.g. Washed" /></Field>
          <Field label="Price · EUR"><div className="input-prefix"><span>€</span><input type="number" min="0" step="0.01" value={draft.priceEur ?? ''} onChange={(event) => update('priceEur', event.target.value === '' ? null : Number(event.target.value))} placeholder="0.00" /></div></Field>
          <Field label="Where did you get it?" wide><input value={draft.shop} onChange={(event) => update('shop', event.target.value)} placeholder="Shop or roastery" /></Field>
          <Field label="Your rating" wide><div className="rating-picker">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={(draft.rating || 0) >= value ? 'rating-star selected' : 'rating-star'} onClick={() => update('rating', draft.rating === value ? null : value)} aria-label={`${value} stars`}><Star size={21} fill={(draft.rating || 0) >= value ? 'currentColor' : 'none'} /></button>)}<span>{draft.rating ? `${draft.rating} / 5` : 'Leave a rating'}</span></div></Field>
          <Field label="Tasting notes" wide><textarea rows={3} value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="What stood out? What would you brew differently?" /></Field>
        </div>
      </div>

      <div className="form-section recipe-editor-section"><div className="form-section-title"><span>02</span><h3>Filter recipes</h3><i /><button type="button" className="text-add" onClick={() => update('recipes', [...draft.recipes, newRecipe()])}><Plus size={15} /> Add recipe</button></div>
        {draft.recipes.length ? <div className="recipe-editor-list">{draft.recipes.map((recipe, index) => <div className="recipe-editor-card" key={recipe.id}>
          <div className="recipe-editor-top"><span>RECIPE {String(index + 1).padStart(2, '0')}</span><button type="button" onClick={() => update('recipes', draft.recipes.filter((item) => item.id !== recipe.id))} aria-label="Remove recipe"><Trash2 size={15} /></button></div>
          <div className="recipe-inputs"><Field label="Water temperature"><div className="input-suffix"><input required type="number" min="1" max="100" value={recipe.temperatureC} onChange={(event) => setRecipe(index, 'temperatureC', Number(event.target.value))} /><span>°C</span></div></Field>
            <Field label="Grind size"><label className="select-wrap full-select"><select required value={recipe.grindStep} onChange={(event) => setRecipe(index, 'grindStep', Number(event.target.value))}>{Array.from({ length: 22 }, (_, step) => <option value={step} key={step}>{getGrindLabel(step)}</option>)}</select><ChevronDown size={14} /></label></Field>
            <Field label="Brew note" wide><input value={recipe.note} onChange={(event) => setRecipe(index, 'note', event.target.value)} placeholder="e.g. brighter with a slower pour" /></Field>
          </div>
        </div>)}</div> : <div className="recipe-empty"><Coffee size={17} /><span>No brew recipes yet</span><button type="button" onClick={() => update('recipes', [newRecipe()])}>Add the first one <ArrowRight size={14} /></button></div>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="editor-actions"><button type="button" className="button button-light" onClick={onCancel} disabled={busy}>Cancel</button><button className="button button-dark" type="submit" disabled={busy || !draft.name.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{mode === 'add' ? 'Save coffee' : 'Save changes'}</button></div>
    </form>
  )
}

function Field({ label, required = false, wide = false, children }: { label: string; required?: boolean; wide?: boolean; children: ReactNode }) {
  return <label className={`field${wide ? ' field-wide' : ''}`}><span>{label}{required && <i> *</i>}</span>{children}</label>
}

export default App
