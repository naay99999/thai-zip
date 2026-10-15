import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { renderDocsIndex } from '../lib/docs-markdown'

export const GET: APIRoute = async () =>
  new Response(renderDocsIndex(await getCollection('docs')), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
