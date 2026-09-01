'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignInModal } from '@/app/SignInModal';

export interface CommentView {
  id: number;
  parentId: number | null;
  body: string;
  createdAt: string;
  author: string;
  likeCount: number;
  likedByMe: boolean;
  isMine: boolean;
  deleted: boolean;
}

/** "5m ago" 식 상대 시간 */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
}

function CommentForm({
  eventId,
  parentId,
  placeholder,
  onDone,
}: {
  eventId: number;
  parentId?: number;
  placeholder: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error' | 'ratelimited'>('idle');

  const submit = async () => {
    if (!body.trim() || status === 'sending') return;
    setStatus('sending');
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, body, parentId }),
    }).catch(() => null);
    if (res?.ok) {
      setBody('');
      setStatus('idle');
      onDone?.();
      router.refresh();
    } else {
      setStatus(res?.status === 429 ? 'ratelimited' : 'error');
    }
  };

  return (
    <div className="mt-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={2}
        maxLength={1000}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800"
      />
      <div className="mt-1 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!body.trim() || status === 'sending'}
          className="rounded-lg bg-red-800 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
        >
          {status === 'sending' ? 'Posting…' : 'Post'}
        </button>
        {onDone && (
          <button onClick={onDone} className="text-sm text-stone-400 hover:text-stone-600">
            Cancel
          </button>
        )}
        {status === 'ratelimited' && (
          <span className="text-xs text-amber-600">Slow down — try again in a moment.</span>
        )}
        {status === 'error' && (
          <span className="text-xs text-red-600">Failed to post. Try again.</span>
        )}
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  eventId,
  signedIn,
  requireSignIn,
  isReply,
}: {
  comment: CommentView;
  eventId: number;
  signedIn: boolean;
  requireSignIn: () => void;
  isReply: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(comment.likedByMe);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [replying, setReplying] = useState(false);
  const [reported, setReported] = useState(false);

  const toggleLike = async () => {
    if (!signedIn) return requireSignIn();
    const want = !liked;
    setLiked(want);
    setLikeCount((c) => c + (want ? 1 : -1));
    const res = await fetch(`/api/comments/${comment.id}/like`, { method: 'POST' }).catch(
      () => null,
    );
    if (res?.ok) {
      const data = (await res.json()) as { liked: boolean; likeCount: number };
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } else {
      setLiked(!want);
      setLikeCount((c) => c - (want ? 1 : -1));
    }
  };

  const report = async () => {
    if (!signedIn) return requireSignIn();
    if (!window.confirm('Report this comment?')) return;
    await fetch(`/api/comments/${comment.id}/report`, { method: 'POST' }).catch(() => {});
    setReported(true);
    router.refresh();
  };

  const remove = async () => {
    if (!window.confirm('Delete this comment?')) return;
    await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' }).catch(() => {});
    router.refresh();
  };

  return (
    <div className={isReply ? 'ml-6 border-l-2 border-stone-200 pl-3 dark:border-stone-700' : ''}>
      <div className="flex items-baseline gap-2 text-xs text-stone-400">
        <span className="font-semibold text-stone-600 dark:text-stone-300">
          {comment.deleted ? '—' : comment.author}
        </span>
        <span>{timeAgo(comment.createdAt)}</span>
      </div>
      <p
        className={`mt-0.5 whitespace-pre-line text-sm ${
          comment.deleted ? 'italic text-stone-400' : 'text-stone-700 dark:text-stone-200'
        }`}
      >
        {comment.deleted ? '[deleted]' : comment.body}
      </p>
      {!comment.deleted && (
        <div className="mt-1 flex items-center gap-3 text-xs text-stone-400">
          <button
            onClick={toggleLike}
            className={`tabular-nums transition-colors hover:text-red-800 ${
              liked ? 'font-semibold text-red-800 dark:text-red-300' : ''
            }`}
          >
            👍 {likeCount}
          </button>
          {!isReply && (
            <button onClick={() => setReplying(!replying)} className="hover:text-stone-600">
              Reply
            </button>
          )}
          {comment.isMine ? (
            <button onClick={remove} className="hover:text-red-700">
              Delete
            </button>
          ) : (
            <button onClick={report} disabled={reported} className="hover:text-red-700 disabled:opacity-50">
              {reported ? 'Reported' : 'Report'}
            </button>
          )}
        </div>
      )}
      {replying && (
        <CommentForm
          eventId={eventId}
          parentId={comment.id}
          placeholder="Write a reply…"
          onDone={() => setReplying(false)}
        />
      )}
    </div>
  );
}

export function Comments({
  eventId,
  comments,
  signedIn,
}: {
  eventId: number;
  comments: CommentView[];
  signedIn: boolean;
}) {
  const [signInOpen, setSignInOpen] = useState(false);
  const topLevel = comments.filter((c) => c.parentId === null);
  const repliesOf = (id: number) => comments.filter((c) => c.parentId === id);

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold">
        Comments{' '}
        <span className="text-sm font-normal text-stone-400 tabular-nums">
          {comments.filter((c) => !c.deleted).length}
        </span>
      </h2>

      {signedIn ? (
        <CommentForm eventId={eventId} placeholder="Any tips for fellow hunters?" />
      ) : (
        <button
          onClick={() => setSignInOpen(true)}
          className="mt-2 w-full rounded-lg border border-dashed border-stone-300 px-3 py-2 text-left text-sm text-stone-400 hover:border-red-700 hover:text-red-800 dark:border-stone-600"
        >
          Sign in to leave a comment…
        </button>
      )}

      <div className="mt-4 space-y-4">
        {topLevel.map((c) => (
          <div key={c.id} className="space-y-3">
            <CommentItem
              comment={c}
              eventId={eventId}
              signedIn={signedIn}
              requireSignIn={() => setSignInOpen(true)}
              isReply={false}
            />
            {repliesOf(c.id).map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                eventId={eventId}
                signedIn={signedIn}
                requireSignIn={() => setSignInOpen(true)}
                isReply
              />
            ))}
          </div>
        ))}
      </div>

      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        message="Sign in to join the conversation."
      />
    </section>
  );
}
