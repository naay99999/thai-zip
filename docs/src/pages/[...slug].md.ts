import type { APIRoute, GetStaticPaths } from 'astro'
import { getCollection, type CollectionEntry } from 'astro:content'
import { getMarkdownParams, renderPageMarkdown } from '../lib/docs-markdown'

export const getStaticPaths = (async () => getMarkdownParams(await getCollection('docs'))) satisfies GetStaticPaths

export const GET: APIRoute<{ entry: CollectionEntry<'docs'> }> = ({ props }) =>
  new Response(renderPageMarkdown(props.entry), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
