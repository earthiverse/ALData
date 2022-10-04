import AL, { MonsterName, ServerIdentifier, ServerRegion } from "alclient"

const PRIVATE_MONSTERS: string[] = [
    // Very rare monsters
    "cutebee", "goldenbat",
    // Crypt monsters
    "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "vbat", "xmagefi", "xmagefz", "xmagen", "xmagex"
]

export async function getMonsters(types: MonsterName[], serverRegion?: ServerRegion, serverIdentifier?: ServerIdentifier) {
    types = types.filter(x => !PRIVATE_MONSTERS.includes(x))
    if (types.length == 0) return []

    const entitiesFilters = { lastSeen: { $gt: Date.now() - 300000 }, type: { $in: types } }
    const respawnFilters = { estimatedRespawn: { $gt: Date.now() }, type: { $in: types } }
    if (serverRegion) {
        entitiesFilters["serverRegion"] = serverRegion
        respawnFilters["serverRegion"] = serverRegion
    }
    if (serverIdentifier) {
        entitiesFilters["serverIdentifier"] = serverIdentifier
        respawnFilters["serverIdentifier"] = serverIdentifier
    }

    const entitiesP = AL.EntityModel.find(entitiesFilters).lean().exec()
    const respawnsP = AL.RespawnModel.find(respawnFilters).lean().exec()
    await Promise.all([entitiesP, respawnsP])

    const entities = await entitiesP
    const respawns = await respawnsP

    const toReturn = []
    for (const entity of entities) {
        if (entity.in && entity.in !== entity.map) continue // Don't include instanced monsters
        toReturn.push({
            hp: entity.hp,
            id: entity.name,
            lastSeen: new Date(entity.lastSeen).toISOString(),
            level: entity.level,
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

    return toReturn
}

export async function getHalloweenMonsterPriority() {
    const monsterPriority: MonsterName[] = ["mrpumpkin", "mrgreen"]
    const serverPriority = ["EUI", "EUII", "USI", "USII", "USIII", "ASIAI", "EUPVP", "USPVP"]

    const entitiesFilters = { lastSeen: { $gt: Date.now() - 30000 }, type: { $in: monsterPriority } }
    const respawnFilters = { estimatedRespawn: { $gt: Date.now() }, type: { $in: monsterPriority } }

    const entitiesP = AL.EntityModel.find(entitiesFilters).lean().exec()
    const respawnsP = AL.RespawnModel.find(respawnFilters).lean().exec()
    await Promise.all([entitiesP, respawnsP])

    const entities = await entitiesP
    entities.sort((a, b) => {
        // PVP Priority
        if (a.serverIdentifier !== "PVP" && b.serverIdentifier == "PVP") return -1
        if (b.serverIdentifier !== "PVP" && a.serverIdentifier == "PVP") return 1

        // Lower HP first
        if (a.hp !== b.hp) return a.hp - b.hp

        // Monster Priority
        if (a.type !== b.type) return monsterPriority.indexOf(a.type) - monsterPriority.indexOf(b.type)

        // Server Priority
        if (a.serverRegion !== b.serverRegion || a.serverIdentifier !== b.serverIdentifier) {
            const aKey = `${a.serverRegion}${a.serverIdentifier}`
            const bKey = `${b.serverRegion}${b.serverIdentifier}`
            return serverPriority.indexOf(aKey) - serverPriority.indexOf(bKey)
        }
    })

    const respawns = await respawnsP
    respawns.sort((a, b) => {
        // Lower ms first
        return a.estimatedRespawn - b.estimatedRespawn
    })

    const toReturn = []
    for (const entity of entities) {
        if (entity.in && entity.in !== entity.map) continue // Don't include instanced monsters
        toReturn.push({
            hp: entity.hp,
            id: entity.name,
            lastSeen: new Date(entity.lastSeen).toISOString(),
            level: entity.level,
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

    return toReturn
}