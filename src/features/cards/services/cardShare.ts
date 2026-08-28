export type CardSharePlan =
  | { kind: 'activity'; url: string; message?: string }
  | { kind: 'file'; uri: string; mimeType: 'image/png' };

/** view-shot tmpfile is sometimes a bare path on Android. */
export function toShareFileUri(uri: string): string {
  if (uri.startsWith('file:') || uri.startsWith('content:')) {
    return uri;
  }
  return `file://${uri}`;
}

export function planCardShare(
  platform: string,
  uri: string,
  title?: string,
): CardSharePlan {
  const fileUri = toShareFileUri(uri);
  if (platform === 'ios') {
    return { kind: 'activity', url: fileUri, message: title };
  }
  return { kind: 'file', uri: fileUri, mimeType: 'image/png' };
}
