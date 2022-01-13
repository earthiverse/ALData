# ALData

## About

This is an API for getting data for use in the online MMORPG Adventure.land.

The API endpoint might be live at <https://aldata.earthiverse.ca>

***

## API

### /characeters/:ids

Returns an array containing data about characters.

Examples:

* Single Character: `https://aldata.earthiverse.ca/characters/earthiverse`
* Multiple Characters: `https://aldata.earthiverse.ca/characters/earthiverse,earthPri,earthWar,earthMer`

***

### /monsters/:types/:serverRegion?/:serverIdentifier?

Returns an array containing data about monsters.

**NOTE:** `cutebee` and `golenbat` will not be returned, even if the database contains information about them.

Examples:

* Single Monster Type: `https://aldata.earthiverse.ca/monsters/franky`
* Multiple Monster Types: `https://aldata.earthiverse.ca/monsters/phoenix,mvampire,fvampire`
* US PVP snowman: `https://aldata.earthiverse.ca/monsters/snowman/US/PVP`

***

### /npcs/:name/:serverRegion?/:serverIdentifier?

Returns an array containing data about given NPCs

Examples:

* US I Kane: `https://aldata.earthiverse.ca/npcs/Kane/US/I`
* EU II Angel and Kane: `https://aldata.earthiverse.ca/npcs/Angel,Kane/EU/II`
* All Servers Kane: `https://aldata.earthiverse.ca/npcs/Kane`

***

## Sample Code

This code will populate a `parent.S2` variable with some data retrieved from the API every 30s.

```javascript
async function checkServersForMonsters(monsters) {
  // Safety Checks
  if(!Array.isArray(monsters)) return
  if(monsters.length == 0) return
 
  // Query API
  const url = "https://aldata.earthiverse.ca/monsters/" + monsters.join(",")
 
  const response = await fetch(url)
  if(response.status == 200) {
    const data = await response.json()
    parent.S2 = data
    return data
  }
}

// Check now, and every 30s
checkServersForMonsters(["franky"])
setInterval(() => { checkServersForMonsters(["franky"]) }, 30000)
```
