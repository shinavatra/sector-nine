import { useEffect, useState } from 'react';
import { Loader2, Pin } from 'lucide-react';
import { newsAPI } from '../utils/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  is_pinned: boolean;
  author_name: string;
  published_at: string;
};

export function NewsFeed() {
  const [items, setItems] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const requestedLimit = 10;
    newsAPI
      .list({ page: 1, limit: requestedLimit })
      .then((response: any) => {
        if (active) {
          setItems(Array.isArray(response.items) ? response.items : []);
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Unable to load platform news.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retryToken]);

  return (
      <Card className="min-w-0 border-orange-900/20 bg-black/40">
        <CardHeader>
          <CardTitle className="font-mono text-orange-400">LATEST NEWS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <State loading text="Loading news..." />
          ) : error ? (
            <div className="rounded border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-200">
              <p>{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setRetryToken((value) => value + 1)}
              >
                Retry
              </Button>
            </div>
          ) : items.length ? (
            <div className="space-y-3">
              {items.map((article) => (
                <article
                  key={article.id}
                  className="min-w-0 rounded-lg border border-orange-900/20 bg-black/30 p-3 sm:p-4"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {article.is_pinned && <Pin className="size-4 shrink-0 text-orange-400" />}
                    <h3 className="break-words text-lg font-semibold text-orange-300">
                      {article.title}
                    </h3>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <Badge variant="outline" className="capitalize">
                      {article.category}
                    </Badge>
                    <span>{new Date(article.published_at).toLocaleDateString()}</span>
                    <span>by {article.author_name}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-5 text-gray-400">
                    {article.summary || article.content}
                  </p>
                   {article.content && article.content !== article.summary && (
                     <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-300">{article.content}</p>
                   )}
                </article>
              ))}
            </div>
          ) : (
            <State text="No published news is available." />
          )}
        </CardContent>
      </Card>
  );
}

function State({ text, loading = false }: { text: string; loading?: boolean }) {
  return (
    <div className="flex min-h-24 items-center justify-center gap-3 py-6 text-center font-mono text-sm text-gray-500">
      {loading && <Loader2 className="size-5 animate-spin text-orange-400" />}
      {text}
    </div>
  );
}
