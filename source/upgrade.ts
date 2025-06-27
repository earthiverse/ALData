import AL, { Item, ItemData } from "alclient"

// TODO: Make this prettier

const COMPOUNDS = {
    0: {
        1: 0.99,
        2: 0.75,
        3: 0.4,
        4: 0.25,
        5: 0.2,
        6: 0.1,
        7: 0.08,
        8: 0.05,
        9: 0.05,
        10: 0.05,
    },
    1: {
        1: 0.9,
        2: 0.7,
        3: 0.4,
        4: 0.2,
        5: 0.15,
        6: 0.08,
        7: 0.05,
        8: 0.05,
        9: 0.05,
        10: 0.03,
    },
    2: {
        1: 0.8,
        2: 0.6,
        3: 0.32,
        4: 0.16,
        5: 0.1,
        6: 0.05,
        7: 0.03,
        8: 0.03,
        9: 0.03,
        10: 0.02,
    },
}

const UPGRADES = {
    0: {
        1: 0.9999999,
        2: 0.98,
        3: 0.95,
        4: 0.7,
        5: 0.6,
        6: 0.4,
        7: 0.25,
        8: 0.15,
        9: 0.07,
        10: 0.024,
        11: 0.14,
        12: 0.11,
    },
    1: {
        1: 0.99998,
        2: 0.97,
        3: 0.94,
        4: 0.68,
        5: 0.58,
        6: 0.38,
        7: 0.24,
        8: 0.14,
        9: 0.066,
        10: 0.018,
        11: 0.13,
        12: 0.1,
    },
    2: {
        1: 0.97,
        2: 0.94,
        3: 0.92,
        4: 0.64,
        5: 0.52,
        6: 0.32,
        7: 0.232,
        8: 0.13,
        9: 0.062,
        10: 0.015,
        11: 0.12,
        12: 0.09,
    },
}

/**
 *
 * @param starting_cost
 * @param item
 * @param optimize_item If true, we will optimize for least items spent. If false, we will optimize for least cost.
 * @param use_scroll3
 * @param use_offeringx
 * @param lucky_slot
 * @param stacking
 * @returns
 */
export function min_upgrade_cost(
    starting_cost,
    item: ItemData,
    optimize_item: boolean,
    use_scroll3 = false,
    use_offeringx = false,
    lucky_slot = false,
    stacking = true,
) {
    const scrolls = [
        AL.Game.G.items.scroll0,
        AL.Game.G.items.scroll1,
        AL.Game.G.items.scroll2,
        AL.Game.G.items.scroll3,
        AL.Game.G.items.scroll4,
    ]
    const offerings = [null, AL.Game.G.items.offeringp, AL.Game.G.items.offering, AL.Game.G.items.offeringx]
    const costs = {
        scroll: [
            AL.Game.G.items.scroll0.g,
            AL.Game.G.items.scroll1.g,
            AL.Game.G.items.scroll2.g,
            AL.Game.G.items.scroll3.g,
            Infinity,
        ],
        offering: [0, 1500000, AL.Game.G.items.offering.g, 800000000],
    }

    const grade = new Item(item, AL.Game.G).calculateGrade()
    let resulting_cost = Infinity
    let resulting_chance = 0
    let resulting_grace = 0
    let winning_config = []
    // Run test with the item's grade scroll, and the one above it (if it exists);
    for (let i = grade; i <= grade + 1; i++) {
        if ((i >= 3 && use_scroll3) || i < 3) {
            // Then, we need to consider offerings, of which there are 4 possible choices.
            for (let j = 0; j < 4; j++) {
                if ((j == 3 && use_offeringx) || j != 3) {
                    // k = number of sacrifices to make
                    for (
                        let k = 0;
                        k < (stacking ? Math.max(0, Math.ceil((item.level + 2 - item.grace) / 0.5)) + 1 : 1);
                        k++
                    ) {
                        const current_cost = starting_cost + costs.scroll[i] + costs.offering[j] + costs.offering[1] * k
                        const new_item = {
                            grace: item.grace + 0.5 * k,
                            name: item.name,
                            level: item.level,
                        }
                        let { chance: result_chance, new_grace } = getUpgradeChance(
                            new_item,
                            scrolls[i],
                            offerings[j],
                        ) as {
                            chance: number
                            new_grace: number
                        }
                        if (lucky_slot) {
                            result_chance = 0.6 * Math.min(1, (result_chance + 0.012) / 0.975) + 0.4 * result_chance
                        }
                        if (
                            optimize_item
                                ? result_chance > resulting_chance
                                : current_cost / result_chance < resulting_cost
                        ) {
                            resulting_cost = current_cost / result_chance
                            resulting_chance = result_chance
                            resulting_grace = new_grace
                            winning_config = [i, j, k]
                        }
                    }
                }
            }
        }
    }
    return { resulting_cost, resulting_chance, resulting_grace, winning_config }
}

export function min_compound_cost(
    starting_cost,
    item: ItemData,
    optimize_item: boolean,
    use_scroll3 = false,
    use_offeringx = false,
) {
    // optimize_item = true: Optimize for least items spent
    // optimize_item = false: optimize for least cost
    const scrolls = [
        AL.Game.G.items.cscroll0,
        AL.Game.G.items.cscroll1,
        AL.Game.G.items.cscroll2,
        AL.Game.G.items.cscroll3,
        null,
    ]
    const offerings = [null, AL.Game.G.items.offeringp, AL.Game.G.items.offering, AL.Game.G.items.offeringx]
    const grade = new Item(item, AL.Game.G).calculateGrade()
    const costs = {
        scroll: [
            AL.Game.G.items.cscroll0.g,
            AL.Game.G.items.cscroll1.g,
            AL.Game.G.items.cscroll2.g,
            AL.Game.G.items.cscroll3.g,
            Infinity,
        ],
        offering: [0, 1500000, AL.Game.G.items.offering.g, 800000000],
    }
    let resulting_cost = Infinity
    let resulting_chance = 0
    let resulting_grace = 0
    let winning_config = []
    // Run test with the item's grade scroll, and the one above it (if it exists);
    for (let i = grade; i <= grade + 1; i++) {
        if ((i >= 3 && use_scroll3) || i < 3) {
            // Then, we need to consider offerings, of which there are 4 possible choices.
            for (let j = 0; j < 4; j++) {
                if ((j == 3 && use_offeringx) || j != 3) {
                    const current_cost = starting_cost * 3 + costs.scroll[i] + costs.offering[j]
                    const new_item = {
                        grace: item.grace,
                        name: item.name,
                        level: item.level,
                    }
                    const { chance: result_chance, new_grace } = getCompoundChance(new_item, scrolls[i], offerings[j])
                    if (
                        optimize_item ? result_chance > resulting_chance : current_cost / result_chance < resulting_cost
                    ) {
                        resulting_cost = current_cost / result_chance
                        resulting_chance = result_chance
                        resulting_grace = new_grace
                        winning_config = [i, j]
                    }
                }
            }
        }
    }
    return { resulting_cost, resulting_chance, resulting_grace, winning_config }
}

const ZERO_GRADE_CACHE = new Map()
function getZeroGrade(item_name) {
    if (ZERO_GRADE_CACHE.has(item_name)) {
        return ZERO_GRADE_CACHE.get(item_name)
    }
    const mock = { name: item_name, level: 0 }
    ZERO_GRADE_CACHE.set(item_name, new Item(mock, AL.Game.G).calculateGrade())
    return ZERO_GRADE_CACHE.get(item_name)
}

function getUpgradeChance(item, scroll_def, offering_def) {
    let { name: item_name, grace: grace } = item
    let new_grace = item.grace
    const zero_grade = getZeroGrade(item_name)
    const grade = new Item(item, AL.Game.G).calculateGrade()
    if (grade > scroll_def.grade) {
        return 0
    }
    let probability = 1
    let oprobability = 1
    let high = false
    const new_level = (item.level || 0) + 1
    oprobability = probability = UPGRADES[zero_grade][new_level]
    let igrace
    if (!zero_grade) {
        igrace = 1
    } else if (zero_grade == 1) {
        igrace = -1
    } else if (zero_grade == 2) {
        igrace = -2
    }
    grace = Math.max(0, Math.min(new_level + 1, (item.grace || 0) + igrace))
    grace = (probability * grace) / new_level + grace / 1000.0
    if (scroll_def.grade > grade && new_level <= 10) {
        probability = probability * 1.2 + 0.01
        high = true
        new_grace = new_grace + 0.4
    }
    if (offering_def) {
        let increase = 0.4

        if (offering_def.grade > grade + 1) {
            probability = probability * 1.7 + grace * 4
            high = true
            increase = 3
        } else if (offering_def.grade > grade) {
            probability = probability * 1.5 + grace * 1.2
            high = true
            increase = 1
        } else if (offering_def.grade == grade) {
            probability = probability * 1.4 + grace
        } else if (offering_def.grade == grade - 1) {
            probability = probability * 1.15 + grace / 3.2
            increase = 0.2
        } else {
            probability = probability * 1.08 + grace / 4
            increase = 0.1
        }
        new_grace = new_grace + increase
    } else {
        grace = Math.max(0, grace / 4.8 - 0.4 / ((new_level - 0.999) * (new_level - 0.999)))
        probability += grace // previously 12.0 // previously 9.0 [16/07/18]
    }
    if (high) {
        probability = Math.min(probability, Math.min(oprobability + 0.36, oprobability * 3))
    } else {
        probability = Math.min(probability, Math.min(oprobability + 0.24, oprobability * 2))
    }
    return { chance: Math.min(probability, 1), new_grace }
}

function getCompoundChance(item, scroll_def, offering_def) {
    let { name: item_name, grace: grace } = item
    let new_grace = item.grace
    const zero_grade = getZeroGrade(item_name)
    const grade = new Item(item, AL.Game.G).calculateGrade()
    if (scroll_def == null || grade > scroll_def.grade) {
        return { chance: 0, new_grace: 0 }
    }
    let probability = 1
    let oprobability = 1
    let high = 0
    let grace_bonus = 0
    const new_level = (item.level || 0) + 1
    let igrade = zero_grade
    if (item.level >= 3) {
        igrade = new Item({ name: item.name, level: item.level - 2 }, AL.Game.G).calculateGrade()
    }
    oprobability = probability = COMPOUNDS[igrade][new_level]
    if (scroll_def.grade > grade) {
        probability = probability * 1.1 + 0.001
        grace_bonus += 0.4
        high = scroll_def.grade - grade
    }
    if (offering_def) {
        let increase = 0.5
        grace = 0.027 * (item.grace * 3 + 0.5)

        if (offering_def.grade > grade + 1) {
            probability = probability * 1.64 + grace * 2
            high = 1
            increase = 3
        } else if (offering_def.grade > grade) {
            probability = probability * 1.48 + grace
            high = 1
            increase = 1
        } else if (offering_def.grade == grade) {
            probability = probability * 1.36 + Math.min(30 * 0.027, grace)
        } else if (offering_def.grade == grade - 1) {
            probability = probability * 1.15 + Math.min(25 * 0.019, grace) / Math.max(item.level - 2, 1)
            increase = 0.2
        } else {
            probability = probability * 1.08 + Math.min(15 * 0.015, grace) / Math.max(item.level - 1, 1)
            increase = 0.1
        }

        new_grace = item.grace * 3
        grace_bonus += increase
    } else {
        grace = 0.007 * item.grace
        probability = probability + Math.min(25 * 0.007, grace) / Math.max(item.level - 1, 1)
        new_grace = item.grace
    }
    new_grace = new_grace / 6.4 + grace_bonus
    probability = Math.min(
        probability,
        Math.min(oprobability * (3 + ((high && high * 0.6) || 0)), oprobability + 0.2 + ((high && high * 0.05) || 0)),
    )
    return { chance: Math.min(probability, 1), new_grace }
}
