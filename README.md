# ALData

## About

This is an API for getting data for use in the online MMORPG Adventure.land.

The API endpoint might be live at <https://aldata.earthiverse.ca>

## Authentication

Some API functionality (specifically, `PUT` requests) requires an authentication key to ensure that players don't overwrite others' data.

### Adding / setting an authentication key

Notes:

1. The key is stored as plaintext in the database. I will be able to see your key. **Do not re-use any password.**
2. If the owner of the character is known, it will set the key for all characters with the same owner. You can check if the owner is known with the GET /auth/ endpoint (`https://aldata.earthiverse.ca/auth/character_name`).
3. It costs gold (48,000 gold as of March, 2022) to send mail. This gold does not go to me.
4. The mail check only runs once a minute, so it may take a minute to set or update your auth key.

In Adventure.land, you can use the following code to send mail and set or update your auth key:

```js
send_mail("earthiverse", "aldata_auth", "put key here");
```

---

## API

### GET /achievements/:ids

Retrieves the latest achievement data for the given characters.

Examples:

- Single Character: `https://aldata.earthiverse.ca/achievements/earthiverse`
- Multiple Characters: `https://aldata.earthiverse.ca/achievements/earthiverse,lolwutpear`

---

### GET /achievements/:ids/:monster/:fromDate?/:toDate?

Retrieves historical achievement data for the given characters and monster.

Examples:

- Single Character, all time: `https://aldata.earthiverse.ca/achievements/earthiverse/goo`
- Single Character, January, 2022: `https://aldata.earthiverse.ca/achievements/earthiverse/goo/1640995200/1643673600`
- Multiple Characters: `https://aldata.earthiverse.ca/achievements/earthiverse,lolwutpear/goo`
- Multiple Characters, January 2022: `https://aldata.earthiverse.ca/achievements/earthiverse,lolwutpear/goo/1640995200/1643673600`

---

### PUT /achievements/:id/:key

Updates achievement information for the given character.
Set the request body to JSON text representing your character's achievement information in Adventure.land.

Example code:

```js
const ALDATA_KEY = "thisisnotmyrealkey";
parent.socket.once("tracker", (data) => {
  const url = `https://aldata.earthiverse.ca/achievements/${character.id}/${ALDATA_KEY}`;
  const settings = {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max: data.max, monsters: data.monsters }),
  };
  // if response.status == 200, it was successfully updated
  fetch(url, settings).then((response) => show_json(response.status));
});
parent.socket.emit("tracker");
```

---

### GET /auth/:id/:key?

Checks ALData authentication status.

Examples:

- Auth existence check: `https://aldata.earthiverse.ca/auth/earthiverse`
- Auth key check: `https://aldata.earthiverse.ca/auth/earthiverse/thisisnotmyrealauth`

---

### GET /bank/:owner

Retrieves bank information for the given owner

Examples:

- earthiverse's bank: `https://aldata.earthiverse.ca/bank/5622711463182336`

---

### PUT /bank/:owner/:key

Updates bank information for the given owner.
Set the request body to JSON text representing your character's banking information, e.g. `character.bank` in Adventure.land.

Example code:

```js
const ALDATA_KEY = "thisisnotmyrealkey";
const url = `https://aldata.earthiverse.ca/bank/${character.owner}/${ALDATA_KEY}`;
const settings = {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(character.bank),
};
// if response.status == 200, it was successfully updated
fetch(url, settings).then((response) => show_json(response.status));
```

---

### GET /character/:id

Returns data about a single character.

Example:

- `https://aldata.earthiverse.ca/character/earthiverse`

---

### PUT /character/:id/:key

Updates character information for the given character.
Set the request body to JSON text representing the information you want to update about your character

Example code:

```js
const ALDATA_KEY = "thisisnotmyrealkey";
const url = `https://aldata.earthiverse.ca/character/${character.id}/${ALDATA_KEY}`;
const update = {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    in: character.in,
    items: character.items,
    party: character.party,
    rip: character.rip,
    serverIdentifier: parent.server_identifier,
    serverRegion: parent.server_region,
    slots: character.slots,
    s: character.s,
    x: character.x,
    y: character.y,
  }),
};
// if response.status == 200, it was successfully updated
fetch(url, update).then((response) => show_json(response.status));
```

---

### GET /characters/:ids

Returns an array containing data about characters.

Examples:

- Single character: `https://aldata.earthiverse.ca/characters/earthiverse`
- Multiple characters: `https://aldata.earthiverse.ca/characters/earthiverse,earthPri,earthWar,earthMer`

---

### GET /merchants/:ids?

Returns an array containing data about merchants and what items they are buying / have for sale.

The API will only show merchants with data that has been updated within the past week.

Examples:

- All merchants: `https://aldata.earthiverse.ca/merchants`
- Specific merchant(s): `https://aldata.earthiverse.ca/merchants/earthMer,AriaHarper`

---

### GET /monsters/:types/:serverRegion?/:serverIdentifier?

Returns an array containing data about monsters.

**NOTE:** `cutebee` and `goldenbat` will not be returned, even if the database contains information about them.

Examples:

- Single monster type: `https://aldata.earthiverse.ca/monsters/franky`
- Multiple monster types: `https://aldata.earthiverse.ca/monsters/phoenix,mvampire,fvampire`
- Single monster type on a specific server: `https://aldata.earthiverse.ca/monsters/snowman/US/PVP`

---

### GET /npcs/:name/:serverRegion?/:serverIdentifier?

Returns an array containing data about given NPCs

Examples:

- US I Kane: `https://aldata.earthiverse.ca/npcs/Kane/US/I`
- EU II Angel and Kane: `https://aldata.earthiverse.ca/npcs/Angel,Kane/EU/II`
- All Servers Kane: `https://aldata.earthiverse.ca/npcs/Kane`

---

## Sample Code

This code will populate a `parent.S2` variable with some data retrieved from the API every 30s.

```javascript
async function checkServersForMonsters(monsters) {
  // Safety Checks
  if (!Array.isArray(monsters)) return;
  if (monsters.length == 0) return;

  // Query API
  const url = "https://aldata.earthiverse.ca/monsters/" + monsters.join(",");

  const response = await fetch(url);
  if (response.status == 200) {
    const data = await response.json();
    parent.S2 = data;
    return data;
  }
}

// Check now, and every 30s
checkServersForMonsters(["franky"]);
setInterval(() => {
  checkServersForMonsters(["franky"]);
}, 30000);
```
