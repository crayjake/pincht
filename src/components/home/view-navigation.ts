export function viewEditorHref(id: string) {
  const origin = location.hash.slice(1) || '/journal';
  return `#/views/edit/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(origin)}`;
}

export function viewEditorReturnPath(value?: string) {
  return value?.startsWith('/') && !value.startsWith('//') && !value.startsWith('/views/edit/')
    ? `#${value}` : '#/journal';
}
