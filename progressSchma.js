const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema({
    clientId:{
        type : mongoose.Schema.Types.ObjectId,
        ref : "Client",
        required : true
    },
    Lead : {
        assignee: { type: String, trim: true },
        date: { type: String, trim: true }
    },
    firstContact : {
        assignee: { type: String, trim: true },
        date: { type: String, trim: true }
    },
    followUp : {
        assignee: { type: String, trim: true },
        date: { type: String, trim: true }
    },
    RFQ : {
        assignee: { type: String, trim: true },
        date: { type: String, trim: true }
    },
    quote : {
        assignee: { type: String, trim: true },
        date: { type: String, trim: true }
    },
    quoteFollowUp : {
        assignee: { type: String, trim: true },
        date: { type: String, trim: true }
    },
    order : {
        assignee: { type: String, trim: true },
        value: { type: Number }
    },
    delivered : {
        type: Boolean,
        default : false
    }
}, {
    timestamps: true
});

// Add index for faster queries
progressSchema.index({ clientId: 1 });

module.exports = mongoose.model("Progress", progressSchema);