const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Add this line
const connectDB = require('./config/mongooseConfig');
const User = require('./models/User');
const Resident = require('./models/Resident');
const Purok = require('./models/Purok');

const app = express();
app.use(express.json())
app.use(cors())

const verifyToken = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).send('No token, authorization denied');
    }
    try {
        const decoded = jwt.verify(token, 'waste_secret'); // Replace 'your_jwt_secret' with your actual secret
        req.user = decoded.user;
        next();
    } catch (error) {
        res.status(401).send('Token is not valid');
    }
};

let location = {};

app.post('/api/users', async (req, res) => {
    try {
        const { password, ...rest } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await User.create({ ...rest, password: hashedPassword });
        res.send(newUser);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/residents', async (req, res) => {
    try {
        const newResident = await Resident.create(req.body);
        res.send(newResident);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
})

app.get('/api/residents', async (req, res) => {
    try {
        const residents = await Resident.find({ location: req.query.location });
        res.send(residents);
    } catch (error) {
        console.log(error);
    }
});

app.post('/api/location', async (req, res) => {
    const { lng, lat } = req.query;
    if (!lng || !lat) {
        return res.status(400).send('Longitude and latitude are required');
    }
    try {
        location = { lng, lat }; 
        res.send(`Reserved location at longitude: ${lng}, latitude: ${lat}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

app.get('/api/location', (req, res) => {
    try {
        if (!location.lng || !location.lat) {
            return res.status(200).send('No location set');
        }
        res.json(location);
    } catch (error) {
        res.send(error)
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).send('Invalid username or password');
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).send('Invalid username or password');
        }
        const payload = {
            user: {
                id: user.id
            }
        };
        const token = jwt.sign(payload, 'waste_secret');
        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/purok', async (req, res) => {
    try {
        const res = await Purok.create(req.body);
        if(res){
            res.send('adasd')
        }   
    } catch (error) {
        res.send(error)
    }
});

app.get('/api/purok', async (req, res) => {
    try {
        const puroks = await Purok.find();
        if(puroks.length){
            res.send(puroks)
        }else{
            res.send({ message: 'No purok found' })
        }
    } catch (error) {
        res.send(error)
    }
});

connectDB();

const PORT = process.env.PORT || 5000;  
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));