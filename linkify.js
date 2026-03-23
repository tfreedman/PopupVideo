// from https://github.com/delirehberi/nostr-ro-client/blob/master/src/views.js
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[m];
    });
}

function linkifyAndEmbed(content) {
  const urlRegex = /https?:\/\/[^\s<]+/g;
  const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  const videoRegex = /(https?:\/\/[^\s<]+?\.(?:mp4|webm|ogg))(?=[^\w.]|$)/;
  const imgRegex = /(https?:\/\/[^\s<]+?\.(?:jpe?g|png|gif|bmp|webp))(?=[^\w.]|$)/;

  let replaced = content.replace(urlRegex, (url) => {
    // YouTube
    const ytMatch = url.match(ytRegex);
    if (ytMatch && ytMatch[1]) {
      const videoId = ytMatch[1];
      return `<div class="youtube-embed">
        <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
      </div>`;
    }

    // Native Video
    if (videoRegex.test(url)) {
      // Create a random ID for the container to easily reference it if needed,
      // but strictly we can pass the URL to the function.
      const cleanUrl = escapeHtml(url);
      return `<div class="video-container" onclick="loadVideo(this, '${cleanUrl}')">
        <div class="play-icon">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <span style="font-size:0.9em; margin-top:0.5em; color:var(--meta)">Play Video</span>
       </div>`;
    }

    // Image
    if (imgRegex.test(url)) {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">
        <img src="${escapeHtml(url)}" class="post-image" />
      </a>`;
    }

    // Fallback Link
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
  });

  //replaced = linkifyNostrEvents(replaced, profileMap);
  return replaced;
}
