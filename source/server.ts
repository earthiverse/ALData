import AL, { MonsterName, ServerIdentifier, ServerRegion } from "alclient"
import cors from "cors"
import bodyParser from "body-parser"
import express from "express"
import fs from "fs"
import helmet from "helmet"
import nocache from "nocache"

// Setup Express
const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
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
    const names = request.params.ids.split(",")

    // Don't share information about these characters
    const privateCharacters: string[] = []
    for (let i = names.length - 1; i >= 0; i--) {
        const name = names[i]
        if (!name) continue
        if (privateCharacters.includes(name)) names.splice(i, 1)
    }
    if (names.length == 0) {
        response.status(403).send([])
        return
    }

    const results = await AL.PlayerModel.find({ name: { $in: names } }).lean().exec()
    if (results) {
        const characters = []
        for (const result of results) {
            characters.push({
                id: result.name,
                lastSeen: new Date(result.lastSeen).toISOString(),
                map: result.map,
                serverIdentifier: result.serverIdentifier,
                serverRegion: result.serverRegion,
                x: result.x,
                y: result.y
            })
        }
        response.status(200).send(characters)
        return
    } else {
        response.status(200).send([])
        return
    }
})

// Setup Monster Retrieval
app.get("/monsters/:type/", async (request, response) => {
    const types: MonsterName[] = request.params.type.split(",") as MonsterName[]

    // Don't share information about these monsters
    const privateTypes: MonsterName[] = [
        // Very rare monsters
        "cutebee", "goldenbat",
        // Crypt monsters
        "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "xmagefi", "xmagefz", "xmagen", "xmagex"]
    for (let i = types.length - 1; i >= 0; i--) {
        const type = types[i]
        if (!type) continue
        if (privateTypes.includes(type)) types.splice(i, 1)
    }
    if (types.length == 0) {
        response.status(403).send([])
        return
    }

    const entitiesP = AL.EntityModel.find({ lastSeen: { $gt: Date.now() - 300000 }, type: { $in: types } }).lean().exec()
    const respawnsP = AL.RespawnModel.find({ estimatedRespawn: { $gt: Date.now() }, type: { $in: types } }).lean().exec()
    await Promise.all([entitiesP, respawnsP])

    const entities = await entitiesP
    const respawns = await respawnsP

    if (entities || respawns) {
        const toReturn = []
        for (const entity of entities) {
            if (entity.in && entity.in !== entity.map) continue // Don't include instanced monsters
            toReturn.push({
                hp: entity.hp,
                id: entity.name,
                lastSeen: new Date(entity.lastSeen).toISOString(),
                map: entity.map,
                serverIdentifier: entity.serverIdentifier,
                serverRegion: entity.serverRegion,
                target: entity.target,
                type: entity.type,
                x: entity.x,
                y: entity.y
            })
        }
        for (const respawn of respawns) {
            toReturn.push({
                estimatedRespawn: new Date(respawn.estimatedRespawn).toISOString(),
                serverIdentifier: respawn.serverIdentifier,
                serverRegion: respawn.serverRegion,
                type: respawn.type
            })
        }
        response.status(200).send(toReturn)
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
    const npc = await AL.NPCModel.findOne({ name: name, serverIdentifier: serverIdentifier, serverRegion: serverRegion }).lean().exec()
    if (npc) {
        response.status(200).send({
            id: npc.name,
            lastSeen: new Date(npc.lastSeen).toISOString(),
            map: npc.map,
            serverIdentifier: npc.serverIdentifier,
            serverRegion: npc.serverRegion,
            x: npc.x,
            y: npc.y
        })
        return
    } else {
        response.status(200).send({})
        return
    }
})

// Start the server
app.listen(credentials.port)