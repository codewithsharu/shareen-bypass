const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

// Basic proxy configuration
const proxy = createProxyMiddleware({
    target: 'https://env-softeesolutions.bestserver.host',
    changeOrigin: true,
    secure: false,
    ws: true,
    logLevel: 'debug',
    onProxyRes: function(proxyRes, req, res) {
        if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/html')) {
            delete proxyRes.headers['content-length'];
            proxyRes.headers['transfer-encoding'] = 'chunked';
            
            let body = '';
            proxyRes.on('data', function(chunk) {
                body += chunk;
            });
            
            proxyRes.on('end', function() {
                // Remove datadog scripts
                body = body.replace(/<script[^>]*datadog[^>]*>[\s\S]*?<\/script>/gi, '');
                
                // Remove watermark div
                body = body.replace(/<div[^>]*id=["']watermarckk["'][^>]*>[\s\S]*?<\/div>/gi, '');
                
                // Add our blocking code at the very start of head
                const injection = `
                    <script>
                        // Block datadog scripts
                        const originalCreateElement = document.createElement.bind(document);
                        document.createElement = function(tagName) {
                            const element = originalCreateElement(tagName);
                            if (tagName.toLowerCase() === 'script') {
                                const originalSetAttribute = element.setAttribute.bind(element);
                                element.setAttribute = function(name, value) {
                                    if (name === 'src' && value.includes('datadog')) {
                                        return; // Block datadog scripts
                                    }
                                    return originalSetAttribute(name, value);
                                };
                            }
                            return element;
                        };
                    </script>
                    <style>
                        #watermarckk, div[id*="watermar"], [id*="watermar"] { 
                            display: none !important; 
                            opacity: 0 !important;
                            visibility: hidden !important;
                            position: fixed !important;
                            top: -9999px !important;
                            left: -9999px !important;
                            z-index: -9999 !important;
                            pointer-events: none !important;
                            width: 0 !important;
                            height: 0 !important;
                        }
                    </style>
                `;
                
                // Insert our code at the start of head
                body = body.replace('<head>', '<head>' + injection);
                res.end(body);
            });
        } else {
            // Block datadog requests
            if (req.url.includes('datadog')) {
                res.status(404).end();
                return;
            }
            proxyRes.pipe(res);
        }
    },
    headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'identity',
        'Accept-Language': 'en-US,en;q=0.9'
    }
});

// Block datadog requests at router level
app.use((req, res, next) => {
    if (req.url.includes('datadog')) {
        res.status(404).end();
        return;
    }
    next();
});

// Use proxy for all routes
app.use('/', proxy);

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
}); 