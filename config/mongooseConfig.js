const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // await mongoose.connect('mongodb+srv://gooteen6:XYZ200cls1konabatahaha@cluster0.ui6yy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        await mongoose.connect('mongodb://localhost:27017'); 
        console.log('MongoDB connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};


module.exports = connectDB;
