/** Watch-link helpers: turn Riot's vod/stream records into plain URLs. */
import type { VodTarget } from './types';

type Payload = any;

export function localeGroup(locale: unknown): 'zh' | 'en' | null {
  const value = typeof locale === 'string' ? locale.toLowerCase() : '';
  if (value.startsWith('zh')) return 'zh';
  if (value.startsWith('en')) return 'en';
  return null;
}

export function vodUrl(vod: Payload): string | null {
  if (vod.provider === 'twitch') return `https://www.twitch.tv/videos/${encodeURIComponent(vod.parameter)}`;
  if (vod.provider === 'youtube') {
    const base = `https://www.youtube.com/watch?v=${encodeURIComponent(vod.parameter)}`;
    const seconds = Math.floor((vod.startMillis ?? 0) / 1000);
    return seconds >= 5 ? `${base}&t=${seconds}s` : base;
  }
  return null;
}

export function streamUrl(stream: Payload): string | null {
  if (stream?.provider === 'twitch') return `https://www.twitch.tv/${encodeURIComponent(stream.parameter)}`;
  if (stream?.provider === 'youtube') return `https://www.youtube.com/watch?v=${encodeURIComponent(stream.parameter)}`;
  return null;
}

/**
 * At most one Chinese and one English target, UI language first. A Chinese
 * interface surfaces the Chinese broadcast, an English one the English feed;
 * other feed locales are dropped because the panel cannot label them.
 */
export function localizedTargets<T extends { locale: string }>(items: T[], lang: string): T[] {
  const zh = items.find(item => localeGroup(item.locale) === 'zh');
  const en = items.find(item => localeGroup(item.locale) === 'en');
  const ordered = localeGroup(lang) === 'zh' ? [zh, en] : [en, zh];
  return ordered.filter((item): item is T => item !== undefined);
}

/** Watch targets that survived URL building, de-duplicated by address. */
export function watchTargets(
  vods: Payload[],
  url: (vod: Payload) => string | null,
): VodTarget[] {
  const seen = new Set<string>();
  const targets: VodTarget[] = [];
  for (const vod of vods) {
    const href = url(vod);
    if (href === null || href === '' || seen.has(href)) continue;
    seen.add(href);
    targets.push({ href, locale: vod.locale });
  }
  return targets;
}
