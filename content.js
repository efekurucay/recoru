function parseSong(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');
    const path = parsed.pathname;

    if (host === 'hakoru.net' && path.startsWith('/akor/')) {
      const slug = path.replace('/akor/', '').replace(/\/$/, '');
      if (!slug) return null;
      return { songKey: 'hakoru:' + slug, songTitle: slugToTitle(slug), site: 'Hakoru' };
    }

    if (host === 'repertuarim.com' && path.startsWith('/akor/')) {
      const slug = path.replace('/akor/', '').replace('.html', '').replace(/\/$/, '');
      if (!slug) return null;
      return { songKey: 'repertuarim:' + slug, songTitle: slugToTitle(slug), site: 'Repertuarım' };
    }

    return null;
  } catch {
    return null;
  }
}

function slugToTitle(slug) {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const songInfo = parseSong(window.location.href);

if (songInfo) {
  chrome.storage.session.set({ currentSong: songInfo });
}
