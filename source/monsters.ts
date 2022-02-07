import AL, { MonsterName, ServerIdentifier, ServerRegion } from "alclient"

const PRIVATE_MONSTERS: string[] = [
    // Very rare monsters
    "cutebee", "goldenbat",
    // Crypt monsters
    "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "xmagefi", "xmagefz", "xmagen", "xmagex"
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