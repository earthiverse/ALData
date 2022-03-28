import AL, { MapName, MonsterName, ServerIdentifier, ServerRegion } from "alclient"
import bodyParser from "body-parser"
import cors from "cors"
import express from "express"
import rateLimit from "express-rate-limit"
import fs from "fs"
import helmet from "helmet"
import nocache from "nocache"
import { getAchievements, getAchievementsForMonster, updateAchievements } from "./achievements.js"
import { getAuthStatus, checkAuthByOwner, checkAuthByName } from "./auths.js"
import { getBank, updateBank } from "./banks.js"
import { getCharacters } from "./characters.js"
import { getMonsters } from "./monsters.js"
import { getNPCs } from "./npcs.js"

// Setup Express
const app = express()
app.set("trust proxy", 1)
app.use(cors())
app.use(helmet())
app.use(nocache())
const apiLimiter = rateLimit({
    legacyHeaders: false,
    max: 15, // 15 requests
    message: "Too many requests too fast. Please limit your requests to 15 requests / 60 seconds.",
    standardHeaders: true,
    windowMs: 60 * 1000, // 1 minute
})
app.use(apiLimiter)
app.use(bodyParser.json())

const credentialsFile = "../credentials.json"
const credentials = JSON.parse(fs.readFileSync(credentialsFile, "utf8"))
if ((credentials.email && credentials.password) || (credentials.userAuth && credentials.userID)) {
    // Adventure Land credentials exist, let's login and gather data
    await AL.Game.loginJSONFile(credentialsFile)

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

    // Prepare Pathfinding
    AL.Pathfinder.prepare(AL.Game.G, { include_bank_b: true, include_bank_u: false, include_test: true })

    // Check mail for auths every 60 minutes
    const checkMailLoop = async () => {
        try {
            const recentMail = await AL.Game.getMail()

            recentMail.reverse() // Order oldest to newest, so if they sent two auth mails, the newer one will get set

            for (const mail of recentMail) {
                if (mail.subject.toLowerCase() !== "aldata_auth") continue

                const name = mail.fro
                const aldata_auth = mail.message

                const player = await AL.PlayerModel.findOne({ name: name }).lean().exec()
                if (player) {
                    if (player.owner) {
                        // Update all characters they own with the auth
                        await AL.PlayerModel.updateMany({ owner: player.owner }, { aldata: aldata_auth })
                    } else {
                        // Update the one character
                        await AL.PlayerModel.updateOne({ name: name }, { aldata: aldata_auth })
                    }
                } else {
                    // We don't have this username in our database
                    await AL.PlayerModel.create({
                        aldata: aldata_auth,
                        name: name
                    })
                }

                // We're done with the mail now
                await AL.Game.deleteMail(mail.id)
                console.log(`Updated auth for ${name}!`)
            }
        } catch (e) {
            console.error(e)
        }
        setTimeout(async () => { checkMailLoop() }, 60000)
    }
    checkMailLoop()
} else {
    // Connect to the database
    await AL.Database.connect(credentials.mongo)

    // Get G Data
    await AL.Game.getGData(true, false)

    // Prepare Pathfinding
    AL.Pathfinder.prepare(AL.Game.G, { include_bank_b: true, include_bank_u: false, include_test: true })
}

// Redirect base URL to README
app.get("/", async (request, response) => {
    response.redirect("https://github.com/earthiverse/ALData#aldata")
})

// Setup achievements retrieval & updating
app.get("/achievements/:ids", async (request, response) => {
    const ids = request.params.ids.split(",")

    try {
        const achievements = await getAchievements(ids)
        response.status(200).send(achievements)
    } catch (e) {
        response.status(500).send()
        return
    }
})
app.get("/achievements/:ids/:monster", async (request, response) => {
    const ids = request.params.ids.split(",")
    const monster = request.params.monster as MonsterName

    try {
        const achievements = await getAchievementsForMonster(ids, monster)
        response.status(200).send(achievements)
    } catch (e) {
        response.status(500).send()
        return
    }
})
app.put("/achievements/:id/:key", async (request, response) => {
    const id = request.params.id
    const key = request.params.key

    if (!await checkAuthByName(id, key)) {
        // Failed authentication
        response.status(401).send()
        return
    }

    const achievements = request.body

    try {
        await updateAchievements(id, achievements)
        response.status(200).send()
    } catch (e) {
        response.status(500).send()
        console.error(e)
        return
    }
})

// Setup Authentication Check
app.get("/auth/:id/:key?", async (request, response) => {
    const id = request.params.id
    const key = request.params.key

    try {
        const auth = await getAuthStatus(id, key)
        response.status(200).send(auth)
    } catch (e) {
        response.status(500).send()
        return
    }
})

// Setup bank retrieval & updating
app.get("/bank/:owner", async (request, response) => {
    const owner = request.params.owner

    try {
        const bank = await getBank(owner)
        response.status(200).send(bank)
    } catch (e) {
        response.status(500).send()
    }
})
app.put("/bank/:owner/:key", async (request, response) => {
    const owner = request.params.owner
    const key = request.params.key

    if (!await checkAuthByOwner(owner, key)) {
        // Failed authentication
        response.status(401).send()
        return
    }

    const bank = request.body

    try {
        await updateBank(owner, bank)
        response.status(200).send()
    } catch (e) {
        response.status(500).send()
        return
    }
})

// Setup Character Retrieval
app.get("/character/:id", async (request, response) => {
    const id = request.params.id

    try {
        const character = await getCharacters([id])[0]
        response.status(200).send(character)
    } catch (e) {
        response.status(500).send()
        return
    }
})
app.get("/characters/:ids", async (request, response) => {
    const ids = request.params.ids.split(",")

    try {
        const characters = await getCharacters(ids)
        response.status(200).send(characters)
    } catch (e) {
        response.status(500).send()
        return
    }
})

// Setup Monster Retrieval
app.get("/monsters/:types/:serverRegion?/:serverIdentifier?", async (request, response) => {
    const types = request.params.types.split(",") as MonsterName[]
    const serverRegion = request.params.serverRegion as ServerRegion
    const serverIdentifier = request.params.serverIdentifier as ServerIdentifier

    try {
        const monsters = await getMonsters(types, serverRegion, serverIdentifier)
        response.status(200).send(monsters)
    } catch (e) {
        response.status(500).send()
        return
    }
})

// Setup NPC Retrieval
app.get("/npc/:id/:serverRegion/:serverIdentifier", async (request, response) => {
    const id = request.params.id
    const serverRegion = request.params.serverRegion as ServerRegion
    const serverIdentifier = request.params.serverIdentifier as ServerIdentifier

    try {
        const npc = await getNPCs([id], serverRegion, serverIdentifier)[0]
        response.status(200).send(npc)
    } catch (e) {
        response.status(500).send()
        return
    }
})
app.get("/npcs/:ids/:serverRegion?/:serverIdentifier?", async (request, response) => {
    const ids = request.params.ids.split(",")
    const serverRegion = request.params.serverRegion as ServerRegion
    const serverIdentifier = request.params.serverIdentifier as ServerIdentifier

    try {
        const npcs = await getNPCs(ids, serverRegion, serverIdentifier)
        response.status(200).send(npcs)
    } catch (e) {
        response.status(500).send()
        return
    }
})

// Setup Path Retrieval
app.get("/path/:from/:to", async (request, response) => {
    const [fromMap, fromXString, fromYString] = request.params.from.split(",") as [MapName, string, string]
    const [toMap, toXString, toYString] = request.params.to.split(",") as [MapName, string, string]

    if (!AL.Game.G.maps[fromMap]) {
        response.status(400).send()
        return
    }
    if (!AL.Game.G.maps[toMap]) {
        response.status(400).send()
        return
    }
    if (fromXString === undefined) {
        response.status(400).send()
        return
    }
    if (fromYString === undefined) {
        response.status(400).send()
        return
    }
    if (toXString === undefined) {
        response.status(400).send()
        return
    }
    if (toYString === undefined) {
        response.status(400).send()
        return
    }

    const fromX = Number.parseFloat(fromXString)
    const fromY = Number.parseFloat(fromYString)
    const toX = Number.parseFloat(toXString)
    const toY = Number.parseFloat(toYString)

    try {
        const path = await AL.Pathfinder.getPath({
            map: fromMap,
            x: fromX,
            y: fromY
        }, {
            map: toMap,
            x: toX,
            y: toY
        })
        response.status(200).send(path)
        return
    } catch (e) {
        console.error(e)
        response.status(500).send()
        return
    }
})

// Start the server
app.listen(credentials.port)