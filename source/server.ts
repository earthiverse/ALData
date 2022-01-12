import AL, { MonsterName, ServerIdentifier, ServerRegion } from "alclient"
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

    // Don't share information about these characters
    const privateCharacters: string[] = []
    if (privateCharacters.includes(name)) {
        response.status(403).send({})
        return
    }

    const result = await AL.PlayerModel.findOne({ name: name }).lean().exec()
    if (result) {
        response.status(200).send({
            id: result.name,
            lastSeen: new Date(result.lastSeen).toISOString(),
            map: result.map,
            serverIdentifier: result.serverIdentifier,
            serverRegion: result.serverRegion,
            x: result.x,
            y: result.y
        })
    }
})

// Setup Monster Retrieval
app.get("/monsters/:type/", async (request, response) => {
    const type = request.params.type as MonsterName

    // Don't share information about these monsters
    const privateTypes: MonsterName[] = ["cutebee", "goldenbat"]
    if (privateTypes.includes(type)) {
        response.status(403).send([])
        return
    }

    const results = await AL.EntityModel.find({ lastSeen: { $gt: Date.now() - 300000 }, type: type }).lean().exec()
    if (results) {
        const entities = []
        for (const result of results) {
            entities.push({
                id: result.name,
                lastSeen: new Date(result.lastSeen).toISOString(),
                map: result.map,
                serverIdentifier: result.serverIdentifier,
                serverRegion: result.serverRegion,
                x: result.x,
                y: result.y
            })
        }
        response.status(200).send(entities)
        return
    } else {
        response.status(200).send([])
        return
    }
})

// Setup NPC Retrieval
app.get("/npcs/:serverRegion/:serverIdentifier/:id/", async (request, response) => {
    const serverRegion = request.params.serverRegion
    const serverIdentifier = request.params.serverIdentifier
    const name = request.params.id
    const result = await AL.NPCModel.findOne({ name: name, serverIdentifier: serverIdentifier, serverRegion: serverRegion }).lean().exec()
    if (result) {
        response.status(200).send({
            id: result.name,
            lastSeen: new Date(result.lastSeen).toISOString(),
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