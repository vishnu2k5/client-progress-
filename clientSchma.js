const schma = require('mongoose').Schema;

const clientSchma = new schma({
    clientName:{
        type:String,
        required:true,
        trim:true
    }
},{
    timestamps:true
})

module.exports = require('mongoose').model("Client",clientSchma)