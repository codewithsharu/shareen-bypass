const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const { auth, adminAuth } = require('./middleware/auth');
const User = require('./models/User');
const requestIp = require('request-ip');
const path = require('path');

const app = express();
const PORT = 3000;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// MongoDB Connection
mongoose.connect('mongodb+srv://temp:Fgouter55%23@cluster0.bblcm.mongodb.net/envato?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: 'mongodb+srv://temp:Fgouter55%23@cluster0.bblcm.mongodb.net/envato?retryWrites=true&w=majority&appName=Cluster0',
        ttl: 30 * 60 // 30 minutes
    }),
    cookie: {
        maxAge: 30 * 60 * 1000, // 30 minutes
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Login page route
app.get('/login', (req, res) => {
    res.render('login', { error: req.query.error || null });
});

// Login route
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await user.comparePassword(password))) {
            return res.redirect('/login?error=Invalid credentials');
        }

        if (user.isBlocked) {
            return res.redirect('/login?error=Account is blocked');
        }

        req.session.userId = user._id;
        res.redirect('/');
    } catch (error) {
        res.redirect('/login?error=Login failed');
    }
});

// Create initial admin user if not exists
const createAdminUser = async () => {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const admin = new User({
                username: 'admin',
                password: 'shareenbypass#$!@',
                isAdmin: true
            });
            await admin.save();
            console.log('Admin user created successfully');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
};

// Call createAdminUser after MongoDB connection
mongoose.connection.once('open', createAdminUser);

// Admin route to add users
app.post('/admin/users', auth, adminAuth, async (req, res) => {
    try {
        const { username, password, isAdmin } = req.body;
        const user = new User({ username, password, isAdmin });
        await user.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Basic proxy configuration with auth middleware
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
                // Remove datadog scripts and watermark
                body = body.replace(/<script[^>]*datadog[^>]*>[\s\S]*?<\/script>/gi, '');
                body = body.replace(/<div[^>]*id=["']watermarckk["'][^>]*>[\s\S]*?<\/div>/gi, '');
                
                const injection = `
                    <script>
                        const originalCreateElement = document.createElement.bind(document);
                        document.createElement = function(tagName) {
                            const element = originalCreateElement(tagName);
                            if (tagName.toLowerCase() === 'script') {
                                const originalSetAttribute = element.setAttribute.bind(element);
                                element.setAttribute = function(name, value) {
                                    if (name === 'src' && value.includes('datadog')) {
                                        return;
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
                
                body = body.replace('<head>', '<head>' + injection);
                res.end(body);
            });
        } else {
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

// Apply auth middleware before proxy
app.use('/', auth, proxy);

// Admin panel route
app.get('/admin', auth, adminAuth, (req, res) => {
    res.render('admin', { user: req.user });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
}); 