const { default: mongoose } = require("mongoose");

const schma = require("mongoose").Schema;

const progressSchma = new schma({
    clientId:{
        type : mongoose.Schema.Types.ObjectId,
        ref : "Client",
        required : true
    },
    Lead : {
        type : String,
        trim : true
    },
    firstContact :{
        type:String,
        trim:true
    },

    followUp : {
        type : String,
        trim : true},
    RFQ :{
        type : String,
        trim : true
    },
    quote : {
        type : String,
        trim : true
    },
    quoteFollowUp : {
        type : String,
        trim : true
    },
    order:{
        type : Number,
    },
    delivered : {
        type: Boolean,
        default : false
    }

})
module.exports = require("mongoose").model("Progress",progressSchma)