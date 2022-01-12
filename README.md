# ALData

## About

This is an API for getting data for use in the online MMORPG Adventure.land.

The API endpoint might be live at <https://aldata.earthiverse.ca>

***

## /characeters/:ids

Returns an array containing data about characters.

Examples:

* Single Character: `https://aldata.earthiverse.ca/characters/earthiverse`
* Multiple Characters: `https://aldata.earthiverse.ca/characters/earthiverse,earthPri,earthWar,earthMer`

***

## /monsters/:types

Returns an array containing data about monsters.

**NOTE:** `cutebee` and `golenbat` will not be returned, even if the database contains information about them.

Examples:

* Single Monster Type: `https://aldata.earthiverse.ca/monsters/franky`
* Multiple Monster Types: `https://aldata.earthiverse.ca/monsters/phoenix,mvampire,fvampire`

***

## /npcs/:serverRegion/:serverIdentifier/:name

Returns an object containing data about a given NPC

* US I Kane: `https://aldata.earthiverse.ca/npcs/US/I/Kane`
* EU II Angel: `https://aldata.earthiverse.ca/npcs/EU/II/Angel`
