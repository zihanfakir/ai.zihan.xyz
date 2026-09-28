const { getSystemSettings } = require('../../utils/getModelConfig');

// Helper function to scrape DuckDuckGo as free fallback
async function runDuckDuckGoSearch(query, maxSnippets = 3) {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo returned status ${response.status}`);
  }

  const html = await response.text();
  let snippets = [];
  const snippetRegex = /class="result__snippet[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = snippetRegex.exec(html)) !== null) {
    let text = match[1].replace(/<[^>]*>/g, '')
                       .replace(/&quot;/g, '"')
                       .replace(/&#39;/g, "'")
                       .replace(/&amp;/g, '&')
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
                       .trim();
    if (text) snippets.push(text);
  }

  if (snippets.length === 0) return null;
  return snippets.slice(0, maxSnippets).join('\n\n');
}

// Unified search execution function with API provider routing & DuckDuckGo fallback
async function executeSearch(query, forcedSettings = null) {
  const settings = forcedSettings || await getSystemSettings();
  const provider = String(settings.web_search_provider || 'duckduckgo').toLowerCase().trim();
  const apiKey = String(settings.web_search_api_key || process.env.WEB_SEARCH_API_KEY || process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY || process.env.BRAVE_API_KEY || '').trim();
  const maxResults = Math.min(Math.max(parseInt(settings.web_search_max_results, 10) || 4, 1), 10);
  const customUrl = settings.web_search_custom_url ? String(settings.web_search_custom_url).trim() : '';

  // 1. Tavily Search API
  if (provider === 'tavily' && apiKey) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          search_depth: 'basic',
          max_results: maxResults,
          include_answer: true
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const data = await res.json();
        let parts = [];
        if (data.answer) parts.push(`📌 Summary: ${data.answer}`);
        if (Array.isArray(data.results)) {
          data.results.forEach((r, idx) => {
            if (r.content) parts.push(`[${idx + 1}] ${r.title || 'Result'}: ${r.content} (${r.url || ''})`);
          });
        }
        if (parts.length > 0) {
          return { results: parts.join('\n\n'), provider: 'tavily' };
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`[Tavily Search API Error]: HTTP ${res.status} ${errText}`);
      }
    } catch (e) {
      console.warn('[Tavily Search Exception]:', e.message);
    }
  }

  // 2. Serper.dev (Google Search API)
  if (provider === 'serper' && apiKey) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query, num: maxResults }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const data = await res.json();
        let parts = [];
        if (data.knowledgeGraph?.description) {
          parts.push(`📌 Knowledge: ${data.knowledgeGraph.title || ''} — ${data.knowledgeGraph.description}`);
        }
        if (Array.isArray(data.organic)) {
          data.organic.slice(0, maxResults).forEach((o, idx) => {
            if (o.snippet) parts.push(`[${idx + 1}] ${o.title || 'Result'}: ${o.snippet} (${o.link || ''})`);
          });
        }
        if (parts.length > 0) {
          return { results: parts.join('\n\n'), provider: 'serper' };
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`[Serper API Error]: HTTP ${res.status} ${errText}`);
      }
    } catch (e) {
      console.warn('[Serper Search Exception]:', e.message);
    }
  }

  // 3. Brave Search API
  if (provider === 'brave' && apiKey) {
    try {
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey
        },
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const data = await res.json();
        let parts = [];
        if (Array.isArray(data.web?.results)) {
          data.web.results.slice(0, maxResults).forEach((r, idx) => {
            if (r.description) parts.push(`[${idx + 1}] ${r.title || 'Result'}: ${r.description} (${r.url || ''})`);
          });
        }
        if (parts.length > 0) {
          return { results: parts.join('\n\n'), provider: 'brave' };
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`[Brave Search API Error]: HTTP ${res.status} ${errText}`);
      }
    } catch (e) {
      console.warn('[Brave Search Exception]:', e.message);
    }
  }

  // 4. Custom Search Endpoint
  if (provider === 'custom' && customUrl) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const res = await fetch(customUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, q: query, count: maxResults }),
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.results || data.snippet || data.answer || (typeof data === 'string' ? data : JSON.stringify(data));
        return { results: String(content), provider: 'custom' };
      }
    } catch (e) {
      console.warn('[Custom Search API Exception]:', e.message);
    }
  }

  // 5. Default Fallback: DuckDuckGo HTML Scraper
  try {
    const ddgResults = await runDuckDuckGoSearch(query, maxResults);
    if (ddgResults) {
      return { results: ddgResults, provider: 'duckduckgo' };
    }
  } catch (ddgErr) {
    console.warn('[DuckDuckGo Search Exception]:', ddgErr.message);
  }

  return { results: "No direct web search results found.", provider: 'none' };
}

const searchDuckDuckGo = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const { results, provider } = await executeSearch(query.trim());
    return res.json({ success: true, results, provider });
  } catch (error) {
    console.error('Web search error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch search results' });
  }
};

module.exports = { searchDuckDuckGo, searchWeb: searchDuckDuckGo, executeSearch };
