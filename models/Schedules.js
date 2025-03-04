const mongoose = require('mongoose')

const SchedulesSchema = new mongoose.Schema({
    purokID: {
        type: String,
        required: true
    },
    start: {
        type: String,
        required: true
    },
    end: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    dateAdded: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('Schedules', SchedulesSchema)