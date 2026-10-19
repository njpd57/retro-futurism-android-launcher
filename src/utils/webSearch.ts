export const WEB_SEARCH_BASE = 'https://duckduckgo.com/?q=';

/** URL of a web search for the text, or null when there is nothing to search. */
export function webSearchUrl(query: string)
{
    const q = query.trim();
    return q ? `${WEB_SEARCH_BASE}${encodeURIComponent(q)}` : null;
}
