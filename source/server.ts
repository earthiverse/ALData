import AL, { MonsterName, ServerIdentifier, ServerRegion } from "alclient"
import cors from "cors"
import express from "express"
import fs from "fs"
import helmet from "helmet"
import nocache from "nocache"
import { getCharacters } from "./characters.js"
import { getMonsters } from "./monsters.js"
import { getNPCs } from "./npcs.js"

// Setup Express
const app = express()
app.use(cors())
app.use(helmet())
app.use(nocache())

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

// Redirect base URL to README
app.get("/", async (request, response) => {
    response.redirect("https://github.com/earthiverse/ALData#aldata")
})

// Setup Character Retrieval
app.get("/characters/:ids/", async (request, response) => {
    const ids = request.params.ids.split(",")

    const characters = await getCharacters(ids)
    response.status(200).send(characters)
})

// Setup Monster Retrieval
app.get("/monsters/:types/:serverRegion?/:serverIdentifier?/", async (request, response) => {
    const types = request.params.types.split(",") as MonsterName[]
    const serverRegion = request.params.serverRegion as ServerRegion
    const serverIdentifier = request.params.serverIdentifier as ServerIdentifier

    const monsters = await getMonsters(types, serverRegion, serverIdentifier)
    response.status(200).send(monsters)
})

// Setup NPC Retrieval
app.get("/npcs/:ids/:serverRegion?/:serverIdentifier?/", async (request, response) => {
    const ids = request.params.ids.split(",")
    const serverRegion = request.params.serverRegion as ServerRegion
    const serverIdentifier = request.params.serverIdentifier as ServerIdentifier

    const npcs = await getNPCs(ids, serverRegion, serverIdentifier)
    response.status(200).send(npcs)
})

// Start the server
app.listen(credentials.port)