const mongoose = require('mongoose');
const schema = mongoose.Schema;

const clientSchema = new schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true
    },
    clientName: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true
})

// Add indexes for faster queries
clientSchema.index({ organizationId: 1 });
clientSchema.index({ organizationId: 1, clientName: 1 });

module.exports = mongoose.model("Client", clientSchema);