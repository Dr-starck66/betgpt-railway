import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const root = resolve(process.cwd());
const previewUrl = 'https://matchfolio-editorial-production.up.railway.app';
const legacyUrl = 'https://match-methode-zxyfqf.v2.appdeploy.ai';
const proposedSiteUrl = String(process.env.SITE_URL || previewUrl).replace(/\/$/, '');
const siteUrl = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(proposedSiteUrl) ? proposedSiteUrl : previewUrl;
// A staging URL is never indexable. Even on a custom domain, the operator must
// explicitly set ENABLE_INDEXING=true once publisher identity and DNS are confirmed.
const indexable = process.env.ENABLE_INDEXING === 'true' && siteUrl === 'https://matchfolio.club';
const port = Number(process.env.PORT || 3000);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};
const warning = 'Les jeux d\u0027argent et de hasard peuvent être dangereux : pertes d\u0027argent, conflits familiaux, addiction… Retrouvez nos conseils sur joueurs-info-service.fr (09 74 75 13 13 - appel non surtaxé).';
function headers(contentType, noindex = !indexable) {
  const h = {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Cache-Control': 'public,max-age=120'
  };
  if (noindex) h['X-Robots-Tag'] = 'noindex, nofollow';
  return h;
}
http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Allow': 'GET, HEAD' });
    res.end();
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('Invalid request'); return; }
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : 'ok');
    return;
  }
  if (pathname === '/robots.txt') {
    const robots = indexable ? `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
    res.writeHead(200, headers('text/plain; charset=utf-8', !indexable));
    res.end(req.method === 'HEAD' ? undefined : robots);
    return;
  }
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(v => v.startsWith('.'))) {
    res.writeHead(404, headers('text/plain; charset=utf-8', true));
    res.end('Not found');
    return;
  }
  let requested = resolve(root, '.' + pathname);
  if (requested !== root && !requested.startsWith(root + sep)) {
    res.writeHead(403, headers('text/plain; charset=utf-8', true));
    res.end('Forbidden');
    return;
  }
  try {
    const info = await stat(requested);
    if (info.isDirectory()) requested = resolve(requested, 'index.html');
  } catch {
    if (!extname(requested)) requested = resolve(requested, 'index.html');
  }
  const relativePath = requested.slice(root.length).replaceAll('\\', '/').replace(/^\//, '');
  const extension = extname(requested).toLowerCase();
  // Prevent accidental exposure of server.js, package.json, markdown or repository internals.
  if (!Object.keys(mime).includes(extension) || (extension === '.js' && relativePath !== 'app.js')) {
    res.writeHead(404, headers('text/plain; charset=utf-8', true));
    res.end('Not found');
    return;
  }
  let data, status = 200;
  try { data = await readFile(requested); }
  catch {
    status = 404;
    data = await readFile(resolve(root, '404.html')).catch(() => Buffer.from('<h1>Page introuvable</h1>'));
  }
  const noindex = !indexable || status === 404;
  let contentType = status === 404 ? mime['.html'] : mime[extension];
  if (status === 200 && (extension === '.html' || extension === '.xml')) {
    let content = data.toString('utf8').replaceAll(legacyUrl, siteUrl).replaceAll(previewUrl, siteUrl);
    if (extension === '.html') {
      // Serve the current regulatory warning even on legacy editorial pages.
      content = content.replaceAll(
        '<b>Jouer comporte des risques : endettement, isolement, dépendance.</b> Jeux d’argent interdits aux mineurs. Aide : <a href="https://www.joueurs-info-service.fr/">Joueurs Info Service</a> · 09 74 75 13 13.',
        `<b>${warning}</b> <a href="https://www.joueurs-info-service.fr/" rel="noopener noreferrer">Informations et aide</a>. Jeux d’argent interdits aux mineurs.`
      );
    }
    data = Buffer.from(content);
  }
  res.writeHead(status, headers(contentType, noindex));
  res.end(req.method === 'HEAD' ? undefined : data);
}).listen(port, '0.0.0.0', () => console.log('MatchFolio server listening on ' + port));
