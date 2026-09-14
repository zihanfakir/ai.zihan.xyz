

const searchDuckDuckGo = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
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

    if (snippets.length === 0) {
      return res.json({ success: true, results: "No direct web search results found." });
    }

    // Limit to top 3 snippets to save context window
    const combined = snippets.slice(0, 3).join('\n\n');
    res.json({ success: true, results: combined });
  } catch (error) {
    console.error('Web search error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch search results' });
  }
};

module.exports = { searchDuckDuckGo };
