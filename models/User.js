const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 30 * 24 * 60 * 60 // 30 days in seconds
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    ipAddresses: [{
        ip: String,
        lastUsed: Date,
        requestCount: {
            type: Number,
            default: 0
        }
    }],
    isBlocked: {
        type: Boolean,
        default: false
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lastLoginAttempt: Date
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Track IP method
userSchema.methods.trackIP = async function(ip) {
    const existingIP = this.ipAddresses.find(addr => addr.ip === ip);
    
    if (existingIP) {
        existingIP.lastUsed = new Date();
        existingIP.requestCount++;
        
        // Block if too many requests from this IP
        if (existingIP.requestCount > 1000) { // Adjust limit as needed
            this.isBlocked = true;
        }
    } else {
        // Check if too many IPs
        if (this.ipAddresses.length >= 3) { // Max 3 IPs per user
            this.isBlocked = true;
        } else {
            this.ipAddresses.push({
                ip,
                lastUsed: new Date(),
                requestCount: 1
            });
        }
    }
    
    await this.save();
    return !this.isBlocked;
};

module.exports = mongoose.model('User', userSchema); 