export function createPageUrl(pageName: string, action?: string) {
    const path = '/' + pageName.replace(/ /g, '-');
    return action ? `${path}?action=${encodeURIComponent(action)}` : path;
}
