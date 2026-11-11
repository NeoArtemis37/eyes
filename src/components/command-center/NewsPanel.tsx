'use client';
import { useState, useEffect, useCallback } from 'react';
import { Zap, ExternalLink, RefreshCw, Search, Clock, Globe } from 'lucide-react';

interface Article {
  title: string;
  url: string;
  domain: string;
  seenDate: string;
  image?: string;
  language?: string;
  sourceCountry?: string;
  score?: number;
  comments?: number;
}

export default function NewsPanel() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('intelligence');
  const [source, setSource] = useState<string>('');
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchNews = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/horus/news?q=${encodeURIComponent(q)}&max=30`);
      if (!res.ok) throw new Error(`News API ${res.status}`);
      const data = await res.json();
      setArticles(data.articles || []);
      setSource(data.source || '');
      setLastFetch(Date.now());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNews(query); }, []);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) fetchNews(query.trim());
  };

  const timeAgo = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-1.5 border-b border-cyan-900/20 bg-black/60">
        <div className="flex items-center gap-2 mb-1.5">
          <Zap className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-rose-400 font-mono text-[10px] tracking-[0.2em] font-bold">INTEL NEWS</span>
          <span className="text-gray-600 font-mono text-[8px] ml-auto">{source.toUpperCase()}</span>
        </div>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-rose-600" />
            <input
              type="text"
              placeholder="Search intel..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="w-full bg-black/60 border border-cyan-900/30 rounded pl-5 pr-2 py-1 text-[9px] font-mono text-rose-300 placeholder:text-rose-900 focus:border-rose-600 focus:outline-none"
            />
          </div>
          <button
            onClick={() => fetchNews(query)}
            disabled={loading}
            className="px-2 py-1 bg-rose-900/40 border border-rose-700/40 rounded text-[9px] font-mono text-rose-400 hover:bg-rose-800/50"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'SCAN'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {loading && articles.length === 0 && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] font-mono text-rose-400">Scanning intelligence feeds...</span>
          </div>
        )}
        {error && <div className="text-[9px] font-mono text-red-400 px-2 py-1 bg-red-900/20 border border-red-900/30 rounded">{error}</div>}
        {articles.map((article, i) => (
          <a
            key={`${article.url}-${i}`}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-2 py-1.5 rounded border border-gray-800/30 bg-black/40 hover:bg-gray-800/40 hover:border-gray-700/50 transition-all group"
          >
            <div className="flex items-start gap-2">
              {article.image && (
                <img
                  src={article.image}
                  alt=""
                  className="w-10 h-8 rounded object-cover flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-mono text-gray-200 leading-tight group-hover:text-rose-300 transition-colors line-clamp-2">
                  {article.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[7px] font-mono text-rose-600">{article.domain}</span>
                  {article.sourceCountry && (
                    <Globe className="w-2 h-2 text-gray-700" />
                  )}
                  {article.comments != null && article.comments > 0 && (
                    <span className="text-[7px] font-mono text-amber-600">{article.comments} 💬</span>
                  )}
                </div>
              </div>
              <ExternalLink className="w-2.5 h-2.5 text-gray-700 group-hover:text-rose-400 flex-shrink-0 mt-0.5 transition-colors" />
            </div>
          </a>
        ))}
        {lastFetch > 0 && articles.length > 0 && (
          <div className="text-[7px] font-mono text-gray-700 text-center pt-2 flex items-center justify-center gap-1">
            <Clock className="w-2 h-2" />
            Updated {timeAgo(lastFetch)} · {articles.length} articles
          </div>
        )}
      </div>
    </div>
  );
}
