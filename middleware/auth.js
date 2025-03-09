const User = require('../models/User');
const requestIp = require('request-ip');

const auth = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        // Check if user is blocked
        if (user.isBlocked) {
            req.session.destroy();
            return res.redirect('/login?error=Account blocked');
        }

        // Track IP
        const clientIp = requestIp.getClientIp(req);
        const isAllowed = await user.trackIP(clientIp);
        if (!isAllowed) {
            req.session.destroy();
            return res.redirect('/login?error=Too many IPs or requests');
        }

        // Auto logout after 30 minutes of inactivity
        const thirtyMinutes = 30 * 60 * 1000;
        const lastActivity = new Date(user.lastLogin).getTime();
        const now = new Date().getTime();

        if (now - lastActivity > thirtyMinutes) {
            req.session.destroy();
            return res.redirect('/login?error=Session expired');
        }

        // Update last login time
        user.lastLogin = now;
        await user.save();

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.redirect('/login');
    }
};

const adminAuth = (req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).send('Access denied');
    }
    next();
};

module.exports = { auth, adminAuth }; 