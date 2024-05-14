const mongoose=require('mongoose');

const connectDB= async()=>{
    try{
        await mongoose.connect('mongodb://127.0.0.1:27017/Mydatabase');
        console.log('Conncet with database');
    }
    catch{
        console.log('Database not connect');
    }
}
module.exports= connectDB;