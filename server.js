const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/mongooseConfig');
const User = require('./models/User');
const Resident = require('./models/Resident');
const Purok = require('./models/Purok');
const Schedules = require('./models/Schedules');
const moment = require('moment');
const twilio = require('twilio');

const app = express();
app.use(express.json());
app.use(cors());

const verifyToken = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).send('No token, authorization denied');
    }
    try {
        const decoded = jwt.verify(token, 'waste_secret');
        req.user = decoded.user;
        next();
    } catch (error) {
        res.status(401).send('Token is not valid');
    }
};

const now = new Date();

let location = {};

// Twilio configuration
const accountSid = 'AC0edb0d5400983639aeb759c44f4f7da4';
const authToken = '102938fee90038207fb842430a9a46da';
const client = twilio(accountSid, authToken);

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

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find();
        res.send(users);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.send('User deleted successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/residents', async (req, res) => {
    try {
        const newResident = await Resident.create(req.body);
        res.send('Added new resident');
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

app.delete('/api/residents/:id', async (req, res) => {
    try {
        const resident = await Resident.findByIdAndDelete(req.params.id);
        if (!resident) {
            return res.status(404).send('Resident not found');
        }
        res.send('Resident deleted successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
}

function toRad(value) {
    return value * Math.PI / 180;
}

const lastNotified = new Map();

app.post('/api/location', async (req, res) => {
    const { lng, lat } = req.body;

    if (!lng || !lat) {
        return res.status(400).send('Longitude and latitude are required');
    }

    location = {
        lat: lat,
        lng: lng,
    }

    const now = moment().toISOString();

    try {
        const schedule = await Schedules.findOne({
            start: { $lte: now },
            end: { $gte: now },
            title: 'Trash Collection'
        });

        if (!schedule) {
            return res.status(404).send('No active schedule found');
        }

        const purok = await Purok.findById(schedule.purokID);

        if (!purok) {
            return res.status(404).send('Purok not found');
        }

        const residents = await Resident.find({
            location: purok.name
        });

        const distance = getDistance(lat, lng, purok.lat, purok.lng);
        const notificationKey = `${schedule._id}-${purok._id}`;

        if (distance <= 15) {
            if (!lastNotified.has(notificationKey)) {
                const residentNames = residents.map(resident => resident.name).join(', ');
                res.send(`Location is within 15 km of the purok (${distance.toFixed(2)} km). Residents: ${residentNames}`);

                for (const resident of residents) {
                    client.messages.create({
                        body: `Hello ${resident.name}, the trash collection is within 15 km of your location.`,
                        from: '+19894690660',
                        to: `+63${resident.phone}`
                    }).then(message => console.log(`Message sent to ${resident.phone}: ${message.sid}`))
                        .catch(error => console.error(`Failed to send message to ${resident.phone}: ${error}`));
                }

                lastNotified.set(notificationKey, true);
            } else {
                res.send(`Location is still within 15 km (${distance.toFixed(2)} km). No new notification sent.`);
            }
        } else {
            res.send(`Location is farther than 15 km (${distance.toFixed(2)} km)`);
            lastNotified.delete(notificationKey);
        }
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
        if (res) {
            res.send('adasd')
        }
    } catch (error) {
        res.send(error)
    }
});

app.get('/api/purok', async (req, res) => {
    try {
        const puroks = await Purok.find();
        if (puroks.length) {
            res.send(puroks)
        } else {
            res.send({ message: 'No purok found' })
        }
    } catch (error) {
        res.send(error)
    }
});

app.post('/api/schedules', async (req, res) => {
    try {
        const response = await Schedules.create(req.body);
        if (response) {
            res.send('Scheduled a collection')
        }
        // res.send(req.body)
    } catch (error) {
        res.send(error)
    }
});

app.get('/api/schedules', async (req, res) => {
    try {
        const schedules = await Schedules.find();
        if (schedules.length) {
            res.send(schedules)
        } else {
            res.send({ message: 'No schedules found' })
        }
    } catch (error) {
        res.send(error)
    }
});

app.delete('/api/schedules/:id', async (req, res) => {
    try {
        const schedule = await Schedules.findByIdAndDelete(req.params.id);
        if (!schedule) {
            return res.status(404).send('Schedule not found');
        }
        res.send({ message: 'Schedule deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

app.post('/api/send-message', async (req, res) => {
    const { location, message } = req.body

    if (!location && !message) return res.send('Purok or message is missing')

    try {
        const residents = await Resident.find({
            location: location
        })

        if (residents.length) {
            for (const resident of residents) {
                client.messages.create({
                    body: message,
                    from: '+19894690660',
                    to: `+63${resident.phone}`
                }).then(message => console.log(`Message sent to ${resident.phone}: ${message.sid}`))
                    .catch(error => console.error(`Failed to send message to ${resident.phone}: ${error}`));
            }

            res.send('Message sent successfully')
        }else{
            res.send('No residents in this location.')
        }
    } catch (error) {
        console.log(error)
        res.send(error)
    }
})

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));