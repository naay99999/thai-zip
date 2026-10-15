import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { renderFullDocs } from '../lib/docs-markdown'

export const GET: APIRoute = async () =>
  new Response(renderFullDocs(await getCollection('docs')), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
