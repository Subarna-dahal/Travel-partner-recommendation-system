const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    age: {
        type: Number,
        required: true,
    },
    img: {
        type: String, // Store image URL
    },
    destination: {
        type: String,
        required: true,
    },
    gender: {
        type: String,
    },
    budget: {
        type: Number,          
    },
});

const UserProfile = mongoose.model('UserProfile', UserProfileSchema);

module.exports = UserProfile;
