# Simple NoSQL Store

A wrapper around Cloudant that smoothes out some edges.

## Running

Set a `COUCH_URL` environment varible and run:

```sh
export COUCH_URL=https://myusername:mypassword@myhost.cloudant.com
node index.js
```

## PUT /db - Create a database

```sh
curl -X PUT http://localhost:3000/animals
```

## PUT /db/collection - Create a collection

```sh
curl -X PUT http://localhost:3000/animals/dogs
```

## POST /db/collection - Add a document

Provide a full single JSON object like so:

```sh
curl -X POST -H 'Content-Type: application/json' -d '{"name": "Mitzie"}' http://localhost:3000/animals/dogs
```

or if we need to insert multiple documents, create a JSON array:

```js
[
  {"name":"ben","colour":"brown"},
  {"name":"paul","colour":"white"}
]
```

and insert the data in bulk:

```sh
curl -X POST -H 'Content-type: application/json' -d @dogs.json  http://localhost:3000/animals/dogs
```

or to create simple JSON objects, just supply key/value pairs:

```sh
curl -X POST -d 'name=fred'  http://localhost:3000/animals/dogs
```

### GET /db/collection/id - Get a document

Retrieve a single document

```
curl http://localhost:3000/animals/dogs/5e12d4307b7420a3766b47cd7e8ac0a8
```

### GET /db/collection - Get all documents in a collection

```
curl http://localhost:3000/animals/dogs
```

### GET /db/collection? - Filter documents in a collection

Passing a selector as the `filter` object parameter

```sh
# filter={"name":"Mitzie"}
curl 'http://localhost:3000/animals/dogs?filter=%7B"name":"Mitzie"%7D'
```

or simple key value pairs to be AND'd together

```sh
curl 'http://localhost:3000/animals/dogs?name=sam&colour=brown'
```
