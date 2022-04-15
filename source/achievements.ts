import AL, { IAchievementDocument, TrackerData } from "alclient"
import { MonsterName } from "alclient"
import { LeanDocument } from "mongoose"

/**
 * The first element is the date, the 2nd element is the
 */
export type MonsterAchievementProgress = {
    date: number
    count: number
}[]

const PRIVATE_ACHIEVEMENTS: string[] = []

export async function getAchievements(ids: string[]): Promise<LeanDocument<IAchievementDocument[]>> {
    ids = ids.filter(x => !PRIVATE_ACHIEVEMENTS.includes(x))
    if (ids.length == 0) return []

    return await AL.AchievementModel.aggregate([
        {
            $match: {
                name: { $in: ids }
            }
        },
        {
            $sort: {
                date: 1
            }
        },
        {
            $group: {
                _id: {
                    name: "$name"
                },
                date: {
                    $last: "$date"
                },
                max: {
                    $last: "$max"
                },
                monsters: {
                    $last: "$monsters"
                }
            }
        },
        {
            $project: {
                _id: 0,
                date: 1,
                max: 1,
                monsters: 1,
                name: "$_id.name"
            }
        }
    ]).exec()
}

export async function getAchievementsForMonster(ids: string[], monster: MonsterName, fromDate = 0, toDate = Date.now()): Promise<MonsterAchievementProgress> {
    ids = ids.filter(x => !PRIVATE_ACHIEVEMENTS.includes(x))

    const progress = await AL.AchievementModel.aggregate([
        {
            $match: {
                date: { $gt: fromDate, $lt: toDate },
                name: { $in: ids }
            }
        },
        {
            $sort: {
                date: -1
            }
        },
        {
            $project: {
                _id: 0,
                "count": `$monsters.${monster}`,
                "date": 1,
                "name": 1
            }
        }
    ]).exec()
    return progress
}

/**
 * IMPORTANT: Check auth key before calling this function!
 * @param name Character ID
 * @param tracker Tracker Data
 */
export async function updateAchievements(name: string, tracker: TrackerData): Promise<void> {
    await AL.AchievementModel.create({
        date: Date.now(),
        max: tracker.max,
        monsters: tracker.monsters,
        name: name,
        ...tracker
    })
}