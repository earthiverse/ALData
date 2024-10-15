import AL, { MapName, MonsterName, Observer, ServerIdentifier, ServerInfoDataLive, ServerInfoDataNotLive, ServerRegion } from "alclient"

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
            s: entity.s,
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

export async function getHalloweenMonsterPriority(observers: Observer[], includePVP = false) {
    const monsterPriority: MonsterName[] = ["mrpumpkin", "mrgreen"]
    const serverPriority = ["USI", "EUI", "USII", "USIII", "EUII", "ASIAI", "USPVP", "EUPVP"]

    const entities: {
        hp: number
        lastSeen: Date
        map: MapName
        serverIdentifier: ServerIdentifier
        serverRegion: ServerRegion
        target: string
        type: MonsterName
        x: number
        y: number
    }[] = []
    const respawns: {
        estimatedRespawn: Date
        serverIdentifier: ServerIdentifier
        serverRegion: ServerRegion
        type: MonsterName
    }[] = []
    for (const observer of observers) {
        if (!observer.S) continue // Not ready

        const serverRegion = observer.serverData.region
        const serverIdentifier = observer.serverData.name

        if (!includePVP && serverIdentifier == "PVP") continue

        for (const monster of monsterPriority) {
            if (!observer.S[monster]) continue
            if ((observer.S[monster] as ServerInfoDataLive).live) {
                const data = observer.S[monster] as ServerInfoDataLive
                entities.push({
                    hp: data.hp,
                    lastSeen: new Date(),
                    map: data.map,
                    serverIdentifier: serverIdentifier,
                    serverRegion: serverRegion,
                    target: data.target,
                    type: monster,
                    x: data.x,
                    y: data.y
                })
            } else if (observer.S[monster]) {
                const data = observer.S[monster] as ServerInfoDataNotLive
                const spawn = new Date((new Date(data.spawn)).getTime() + (serverIdentifier == "PVP" ? 20_000 : 0))
                respawns.push({
                    estimatedRespawn: spawn,
                    serverIdentifier: serverIdentifier,
                    serverRegion: serverRegion,
                    type: monster
                })
            }
        }
    }

    entities.sort((a, b) => {
        // Lower HP first
        if (a.hp !== b.hp) return a.hp - b.hp

        // PVP Priority
        if (a.serverIdentifier !== "PVP" && b.serverIdentifier == "PVP") return -1
        if (b.serverIdentifier !== "PVP" && a.serverIdentifier == "PVP") return 1

        // Monster Priority
        if (a.type !== b.type) return monsterPriority.indexOf(a.type) - monsterPriority.indexOf(b.type)

        // Server Priority
        if (a.serverRegion !== b.serverRegion || a.serverIdentifier !== b.serverIdentifier) {
            const aKey = `${a.serverRegion}${a.serverIdentifier}`
            const bKey = `${b.serverRegion}${b.serverIdentifier}`
            return serverPriority.indexOf(aKey) - serverPriority.indexOf(bKey)
        }
    })

    respawns.sort((a, b) => {
        // Lower ms first
        return a.estimatedRespawn.getTime() - b.estimatedRespawn.getTime()
    })

    const toReturn = []
    for (const entity of entities) {
        toReturn.push({
            hp: entity.hp,
            lastSeen: entity.lastSeen.toISOString(),
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
            estimatedRespawn: respawn.estimatedRespawn.toISOString(),
            serverIdentifier: respawn.serverIdentifier,
            serverRegion: respawn.serverRegion,
            type: respawn.type
        })
    }

    return toReturn
}

export async function getHolidayMonsterPriority(observers: Observer[], includePVP = false) {
    const monsterPriority: MonsterName[] = ["grinch", "snowman"]
    const serverPriority = ["USI", "EUI", "USII", "USIII", "EUII", "ASIAI", "USPVP", "EUPVP"]

    const entities: {
        hp: number
        lastSeen: Date
        map: MapName
        serverIdentifier: ServerIdentifier
        serverRegion: ServerRegion
        target: string
        type: MonsterName
        x: number
        y: number
    }[] = []
    const respawns: {
        estimatedRespawn: Date
        serverIdentifier: ServerIdentifier
        serverRegion: ServerRegion
        type: MonsterName
    }[] = []
    for (const observer of observers) {
        if (!observer.S) continue // Not ready

        const serverRegion = observer.serverData.region
        const serverIdentifier = observer.serverData.name

        if (!includePVP && serverIdentifier == "PVP") continue

        for (const monster of monsterPriority) {
            if (!observer.S[monster]) continue
            if ((observer.S[monster] as ServerInfoDataLive).live) {
                const data = observer.S[monster] as ServerInfoDataLive
                entities.push({
                    hp: data.hp,
                    lastSeen: new Date(),
                    map: data.map,
                    serverIdentifier: serverIdentifier,
                    serverRegion: serverRegion,
                    target: data.target,
                    type: monster,
                    x: data.x,
                    y: data.y
                })
            } else if (observer.S[monster]) {
                const data = observer.S[monster] as ServerInfoDataNotLive
                const spawn = new Date((new Date(data.spawn)).getTime() + (serverIdentifier == "PVP" ? 20_000 : 0))
                respawns.push({
                    estimatedRespawn: spawn,
                    serverIdentifier: serverIdentifier,
                    serverRegion: serverRegion,
                    type: monster
                })
            }
        }
    }

    entities.sort((a, b) => {
        // Monster Priority
        if (a.type !== b.type) return monsterPriority.indexOf(a.type) - monsterPriority.indexOf(b.type)

        // Lower HP first
        if (a.hp !== b.hp) return a.hp - b.hp

        // PVP Priority
        if (a.serverIdentifier !== "PVP" && b.serverIdentifier == "PVP") return -1
        if (b.serverIdentifier !== "PVP" && a.serverIdentifier == "PVP") return 1

        // Server Priority
        if (a.serverRegion !== b.serverRegion || a.serverIdentifier !== b.serverIdentifier) {
            const aKey = `${a.serverRegion}${a.serverIdentifier}`
            const bKey = `${b.serverRegion}${b.serverIdentifier}`
            return serverPriority.indexOf(aKey) - serverPriority.indexOf(bKey)
        }
    })

    respawns.sort((a, b) => {
        // Lower ms first
        return a.estimatedRespawn.getTime() - b.estimatedRespawn.getTime()
    })

    const toReturn = []
    for (const entity of entities) {
        toReturn.push({
            hp: entity.hp,
            lastSeen: entity.lastSeen.toISOString(),
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
            estimatedRespawn: respawn.estimatedRespawn.toISOString(),
            serverIdentifier: respawn.serverIdentifier,
            serverRegion: respawn.serverRegion,
            type: respawn.type
        })
    }

    return toReturn
}

export async function getLunarNewYearMonsterPriority(observers: Observer[], includePVP = false) {
    const monsterPriority: MonsterName[] = ["dragold", "tiger"]
    const serverPriority = ["USI", "EUI", "USII", "USIII", "EUII", "ASIAI", "USPVP", "EUPVP"]

    const entities: {
        hp: number
        lastSeen: Date
        map: MapName
        serverIdentifier: ServerIdentifier
        serverRegion: ServerRegion
        target: string
        type: MonsterName
        x: number
        y: number
    }[] = []
    const respawns: {
        estimatedRespawn: Date
        serverIdentifier: ServerIdentifier
        serverRegion: ServerRegion
        type: MonsterName
    }[] = []
    for (const observer of observers) {
        if (!observer.S) continue // Not ready

        const serverRegion = observer.serverData.region
        const serverIdentifier = observer.serverData.name

        if (!includePVP && serverIdentifier == "PVP") continue

        for (const monster of monsterPriority) {
            if (!observer.S[monster]) continue
            if ((observer.S[monster] as ServerInfoDataLive).live) {
                const data = observer.S[monster] as ServerInfoDataLive
                entities.push({
                    hp: data.hp,
                    lastSeen: new Date(),
                    map: data.map,
                    serverIdentifier: serverIdentifier,
                    serverRegion: serverRegion,
                    target: data.target,
                    type: monster,
                    x: data.x,
                    y: data.y
                })
            } else if (observer.S[monster]) {
                const data = observer.S[monster] as ServerInfoDataNotLive
                const spawn = new Date((new Date(data.spawn)).getTime() + (serverIdentifier == "PVP" ? 20_000 : 0))
                respawns.push({
                    estimatedRespawn: spawn,
                    serverIdentifier: serverIdentifier,
                    serverRegion: serverRegion,
                    type: monster
                })
            }
        }
    }

    entities.sort((a, b) => {
        // Monster Priority
        if (a.type !== b.type) return monsterPriority.indexOf(a.type) - monsterPriority.indexOf(b.type)

        // Lower HP first
        if (a.hp !== b.hp) return a.hp - b.hp

        // PVP Priority
        if (a.serverIdentifier !== "PVP" && b.serverIdentifier == "PVP") return -1
        if (b.serverIdentifier !== "PVP" && a.serverIdentifier == "PVP") return 1

        // Server Priority
        if (a.serverRegion !== b.serverRegion || a.serverIdentifier !== b.serverIdentifier) {
            const aKey = `${a.serverRegion}${a.serverIdentifier}`
            const bKey = `${b.serverRegion}${b.serverIdentifier}`
            return serverPriority.indexOf(aKey) - serverPriority.indexOf(bKey)
        }
    })

    respawns.sort((a, b) => {
        // Lower ms first
        return a.estimatedRespawn.getTime() - b.estimatedRespawn.getTime()
    })

    const toReturn = []
    for (const entity of entities) {
        toReturn.push({
            hp: entity.hp,
            lastSeen: entity.lastSeen.toISOString(),
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
            estimatedRespawn: respawn.estimatedRespawn.toISOString(),
            serverIdentifier: respawn.serverIdentifier,
            serverRegion: respawn.serverRegion,
            type: respawn.type
        })
    }

    return toReturn
}