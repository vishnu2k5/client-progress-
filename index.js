const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors")
const app = express();
require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);


require('dotenv').config();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors())
const Client = require('./clientSchma');
const Progress = require('./progressSchma');


// Client.create({
//     clientName : "Client 1"
// }).then((client) => {
//     Progress.create({
//         clientId: client._id,
//         Lead: "Initial Lead"
//     }).then((progress) => {
//         console.log("Progress created:", progress);
//     });
// });
app.get('/clients', async (req, res) => {
    try {
        const clients = await Client.find();
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
app.get('/progress', async (req, res) => {
    const { clientId } = req.query;
    try {
        const progress = await Progress.find({ clientId }).populate('clientId', 'clientName');
        res.json(progress);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
app.post('/add/clients', async (req, res) => {

    const { clientName } = req.body;

    try {

        // create client
        const newClient = new Client({ clientName });
        const savedClient = await newClient.save();

        // create progress with only clientId
        const newProgress = new Progress({
            clientId: savedClient._id
        });

        await newProgress.save();

        res.status(201).json({
            client: savedClient,
            progress: newProgress,
            message: "Client and Progress created successfully"
        });

    } catch (error) {

        res.status(400).json({ message: error.message });

    }

})
app.put("/update/progress", async (req, res) => {

  const { clientId } = req.query
  const { key, value } = req.body
  console.log(clientId, key, value)

  try {

    const updated = await Progress.updateOne(
      { clientId:new mongoose.Types.ObjectId(clientId) },
      { $set: req.body}
    )
    console.log(updated)

    res.json(updated)

  } catch (error) {

    res.status(400).json({ message: error.message })

  }




})
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log("MongoDB Connected")
    app.listen(3000, () => {
        console.log("Server is running on port 3000")
    })
})
.catch((err) => {
    console.error("MongoDB Connection Error:", err)
})
