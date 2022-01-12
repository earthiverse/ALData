import AL, { ServerIdentifier, ServerRegion } from "alclient"
import cors from "cors"
import bodyParser from "body-parser"
import express from "express"
import fs from "fs"
import helmet from "helmet"

// Setup Express
const app = express()
app.use(helmet())
app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const credentialsFile = "../credentials.json"
const credentials = JSON.parse(fs.readFileSync(credentialsFile, "utf8"))
if ((credentials.email && credentials.password) || (credentials.userAuth && credentials.userID)) {
    // Adventure Land credentials exist, let's login and gather data
    AL.Game.loginJSONFile(credentialsFile).then(async () => {
        // Cache the GData
        await AL.Game.getGData(true, false)
        // Open a socket to all AL servers
        for (const sR in AL.Game.servers) {
            const serverRegion = sR as ServerRegion
            for (const sI in AL.Game.servers[serverRegion]) {
                const serverIdentifier = sI as ServerIdentifier

                console.log(`Starting ${serverRegion} ${serverIdentifier} ALData logger`)
                await AL.Game.startObserver(serverRegion, serverIdentifier)
            }
        }
    })
} else {
    // Connect to just the database
    await AL.Database.connect(credentials.mongo)
}

// Setup Character Retrieval
app.get("/characters/:id/", async (request, response) => {
    const name = request.params.id
    const result = await AL.PlayerModel.findOne({ name: name }).lean().exec()
    if (result) {
        response.status(200).send({
            id: result.name,
            lastSeen: result.lastSeen,
            map: result.map,
            serverIdentifier: result.serverIdentifier,
            serverRegion: result.serverRegion,
            x: result.x,
            y: result.y
        })
    }
})

// Start the server
app.listen(credentials.port)