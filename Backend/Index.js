const express = require('express');
const app = express();
const multer = require('multer');
const path = require('path');
const connectDB = require('./database/Connection.js');
const User = require('./database/User.js');
const UserProfile = require('./database/Userprofile.js');
const bcrypt = require('bcrypt');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const recommendCards = require('./recomanded.js');

// Middleware for parsing JSON
app.use(express.json());

// Enable CORS
app.use(cors());

// Multer configuration for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage }).single('image'); // Use correct field name ("image")

let currentUserId = null; // Variable to store the current user's ID

// Connect to MongoDB and start the server
connectDB().then(() => {
  const port = 8000;

  // Register endpoint
  app.post('/register', async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Check if the user already exists based on either name or email
      const existingUser = await User.findOne({ $or: [{ name: name }, { email: email }] });

      if (existingUser) {
        return res.status(400).send({ message: 'User already registered' });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a new user
      const user = new User({
        name,
        email,
        password: hashedPassword,
      });

      // Save the user to the database
      await user.save();

      res.send({ message: 'Successfully Registered, Please login now.' });
    } catch (error) {
      console.error('Error during registration:', error);

      if (error.code === 11000) {
        // Handle duplicate key error (unique constraint)
        return res.status(400).send({ message: 'User with this name or email already registered' });
      }

      res.status(500).send({ message: 'Internal Server Error during registration' });
    }
  });

  // Login endpoint
  app.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find the user by email
      const user = await User.findOne({ email: email });

      if (!user) {
        return res.send({ message: 'User not registered' });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);

      if (passwordMatch) {
        currentUserId = user._id; // Set the current user's ID

        res.send({ message: 'Login Successful', user: user });
      } else {
        res.send({ message: "Password didn't match" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Profile endpoint
  app.post('/profile', upload, async (req, res, next) => {
    try {
      const { age: userAge, budget: userBudget } = req.body;

      // Check if the user is logged in
      if (!currentUserId) {
        return res.status(401).send({ message: 'Unauthorized' });
      }

      // Check if the user already has a profile
      const existingProfile = await UserProfile.findOne({ user: currentUserId });

      if (existingProfile) {
        return res.status(400).send({ message: 'User already has a profile' });
      }

      const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

      // Create a new user profile
      const userProfile = new UserProfile({
        user: currentUserId,
        img: imagePath,
        ...req.body, // Add other profile details
      });

      await userProfile.save();

      // Extract card data
      const cardData = userData;

      // Use recommendCards function to get recommendations
      const recommendations = recommendCards(
        { age: userAge, budget: userBudget },
        cardData
      );
      console.log('Recommendations:', recommendations);

      res.send({ message: 'User profile submitted successfully', recommendations });
    } catch (error) {
      
      console.error(error);
      next(error); // Pass the error to the error-handling middleware
    }
  });
  
  let userData = [];

  const processCSV = async () => {
    try {
      const responseStream = fs.createReadStream('C:/Users/subar/OneDrive/Desktop/Project.csv').pipe(csv());

      for await (const row of responseStream) {
        row.latitude = parseFloat(row.latitude);
        row.longitude = parseFloat(row.longitude);

        const geocodeResponse = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
          params: {
            key: '2f1d27a18b7247cda3f24ae65f4a475d',
            q: row.address,
          },
        });

        const { results } = geocodeResponse.data;

        if (results.length > 0) {
          const { lat, lng } = results[0].geometry;
          row.latitude = lat;
          row.longitude = lng;
        } else {
          console.error(`No results found for geocoding address: ${row.address}`);
        }

        userData.push(row);
      }

      console.log('CSV file successfully processed');
    } catch (error) {
      console.error('Error processing CSV:', error);
    }
  };

  // Process CSV data before starting the server
  processCSV();

  // Endpoint to get user data
  app.get('/users', (req, res) => {
    if (Array.isArray(userData)) {
      res.json(userData);
    } else {
      res.status(500).json({ error: 'Internal Server Error - userData is not an array' });
    }
  });

  // Endpoint to get geocode data
  app.get('/geocode', async (req, res) => {
    const { location } = req.query;

    try {
      const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
        params: {
          key: '2f1d27a18b7247cda3f24ae65f4a475d',
          q: location,
        },
      });

      const { results } = response.data;

      if (results.length > 0) {
        const { lat, lng } = results[0].geometry;
        res.json({ latitude: lat, longitude: lng });
      } else {
        console.error('No results found for the provided location.');
        res.status(404).json({ error: 'Location not found' });
      }
    } catch (error) {
      console.error('Error fetching location coordinates:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Endpoint for searching users
  app.get('/users/search', (req, res) => {
    try {
      const { destination, location } = req.query;
      const { latitude, longitude } = JSON.parse(location || '{}');

      const destinationFilteredUsers = userData.filter(user =>
        user.destination_name && user.destination_name.toLowerCase().includes(destination.toLowerCase())
      );

      if (destinationFilteredUsers.length === 0) {
        res.json([]);
        return;
      }

      const usersWithDistances = destinationFilteredUsers.map(user => ({
        ...user,
        distance: calculateDistance(user.latitude, user.longitude, latitude, longitude),
      }));

      usersWithDistances.sort((a, b) => a.distance - b.distance);

      const nearestPartner = usersWithDistances[0];

      res.json(nearestPartner);
    } catch (error) {
      console.error('Error searching users:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Function to calculate distance between two coordinates
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  }

  // Function to convert degrees to radians
  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  // Start the server
  app.listen(port, () => {
    console.log(`Server is listening on Port ${port}`);
  });
});
