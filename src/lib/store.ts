import JSZip from 'jszip'
import type { CoffeePack, CoffeePackInput, Recipe } from '../types'
import { isSupabaseConfigured, PHOTO_BUCKET, supabase } from './supabase'

const LOCAL_KEY = 'coffee-memories-v1'

type DbPack = {
  id: string
  name: string
  country: string | null
  region: string | null
  variety: string | null
  process: string | null
  price_eur: number | null
  shop: string | null
  rating: number | null
  notes: string | null
  image_path: string | null
  created_at: string
}

type DbRecipe = {
  id: string
  coffee_pack_id: string
  temperature_c: number
  grind_step: number
  note: string | null
}

function localRead(): CoffeePack[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as CoffeePack[]
  } catch {
    return []
  }
}

function mapPack(row: DbPack, recipes: DbRecipe[]): CoffeePack {
  const { data } = supabase!.storage.from(PHOTO_BUCKET).getPublicUrl(row.image_path || '')
  return {
    id: row.id,
    name: row.name,
    country: row.country || '',
    region: row.region || '',
    variety: row.variety || '',
    process: row.process || '',
    priceEur: row.price_eur,
    shop: row.shop || '',
    rating: row.rating,
    notes: row.notes || '',
    imagePath: row.image_path,
    imageUrl: row.image_path ? data.publicUrl : null,
    createdAt: row.created_at,
    recipes: recipes
      .filter((recipe) => recipe.coffee_pack_id === row.id)
      .map((recipe) => ({
        id: recipe.id,
        temperatureC: recipe.temperature_c,
        grindStep: recipe.grind_step,
        note: recipe.note || '',
      })),
  }
}

function readPhoto(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the photo.'))
    reader.readAsDataURL(file)
  })
}

async function compressPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob || file), 'image/webp', 0.84)
    })
  } catch {
    // Some browsers cannot decode formats such as HEIC; retain the original file.
    return file
  }
}

export async function getPacks(): Promise<CoffeePack[]> {
  if (!isSupabaseConfigured || !supabase) {
    return localRead().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const [{ data: packs, error: packError }, { data: recipes, error: recipeError }] = await Promise.all([
    supabase.from('coffee_packs').select('*').order('created_at', { ascending: false }),
    supabase.from('coffee_recipes').select('*'),
  ])
  if (packError) throw packError
  if (recipeError) throw recipeError
  return ((packs || []) as DbPack[]).map((pack) => mapPack(pack, (recipes || []) as DbRecipe[]))
}

export async function savePack(input: CoffeePackInput, photo?: File | null): Promise<CoffeePack> {
  const id = input.id || crypto.randomUUID()
  const createdAt = input.createdAt || new Date().toISOString()
  let imageUrl = input.imageUrl || null
  let imagePath = input.imagePath || null
  const previousImagePath = imagePath

  if (!isSupabaseConfigured || !supabase) {
    if (photo) imageUrl = await readPhoto(await compressPhoto(photo))
    const saved: CoffeePack = { ...input, id, createdAt, imageUrl, imagePath: null }
    const current = localRead().filter((pack) => pack.id !== id)
    localStorage.setItem(LOCAL_KEY, JSON.stringify([saved, ...current]))
    return saved
  }

  if (photo) {
    const optimized = await compressPhoto(photo)
    const contentType = optimized.type || photo.type || 'image/jpeg'
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType.split('/')[1] || 'jpg'
    const nextPath = `${id}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(nextPath, optimized, {
      contentType,
      upsert: false,
    })
    if (uploadError) throw uploadError
    imagePath = nextPath
  }

  const { error: packError } = await supabase.from('coffee_packs').upsert({
    id,
    name: input.name.trim(),
    country: input.country || null,
    region: input.region || null,
    variety: input.variety || null,
    process: input.process || null,
    price_eur: input.priceEur,
    shop: input.shop || null,
    rating: input.rating,
    notes: input.notes || null,
    image_path: imagePath,
    created_at: createdAt,
  })
  if (packError) throw packError
  if (photo && previousImagePath && previousImagePath !== imagePath) {
    const { error: cleanupError } = await supabase.storage.from(PHOTO_BUCKET).remove([previousImagePath])
    if (cleanupError) console.error('Coffee was saved, but its previous photo could not be removed.', cleanupError)
  }

  const existingIds = input.recipes.map((recipe) => recipe.id)
  const { data: previousRecipes, error: previousError } = await supabase
    .from('coffee_recipes')
    .select('id')
    .eq('coffee_pack_id', id)
  if (previousError) throw previousError

  const removedIds = (previousRecipes || [])
    .map((recipe) => recipe.id as string)
    .filter((recipeId) => !existingIds.includes(recipeId))
  if (removedIds.length) {
    const { error } = await supabase.from('coffee_recipes').delete().in('id', removedIds)
    if (error) throw error
  }
  if (input.recipes.length) {
    const { error } = await supabase.from('coffee_recipes').upsert(input.recipes.map((recipe) => ({
      id: recipe.id,
      coffee_pack_id: id,
      temperature_c: recipe.temperatureC,
      grind_step: recipe.grindStep,
      note: recipe.note || null,
    })))
    if (error) throw error
  }

  return {
    ...input,
    id,
    createdAt,
    imagePath,
    imageUrl: imagePath ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(imagePath).data.publicUrl : null,
  }
}

export async function deletePack(pack: CoffeePack): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(localRead().filter((item) => item.id !== pack.id)))
    return
  }
  const { error } = await supabase.from('coffee_packs').delete().eq('id', pack.id)
  if (error) throw error
  if (pack.imagePath) {
    const { error: photoError } = await supabase.storage.from(PHOTO_BUCKET).remove([pack.imagePath])
    if (photoError) console.error('Coffee record was deleted, but its photo could not be removed.', photoError)
  }
}

export async function exportArchive(packs: CoffeePack[]): Promise<void> {
  const zip = new JSZip()
  const records: Array<Record<string, unknown>> = []
  const photos = zip.folder('photos')!

  for (const pack of packs) {
    let photoFile: string | null = null
    if (pack.imageUrl) {
      try {
        const response = await fetch(pack.imageUrl)
        if (response.ok) {
          const blob = await response.blob()
          photoFile = `photos/${pack.id}.${blob.type.split('/')[1] || 'jpg'}`
          photos.file(`${pack.id}.${blob.type.split('/')[1] || 'jpg'}`, blob)
        }
      } catch {
        // Keep the record in the archive even if a remote photo is unavailable.
      }
    }
    records.push({ ...pack, imageUrl: null, imagePath: null, imageFile: photoFile })
  }

  zip.file('coffee-memories.json', JSON.stringify({ exportedAt: new Date().toISOString(), packs: records }, null, 2))
  const archive = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(archive)
  const link = document.createElement('a')
  link.href = url
  link.download = `coffee-memories-${new Date().toISOString().slice(0, 10)}.zip`
  link.click()
  URL.revokeObjectURL(url)
}

export function newRecipe(): Recipe {
  return { id: crypto.randomUUID(), temperatureC: 92, grindStep: 9, note: '' }
}
