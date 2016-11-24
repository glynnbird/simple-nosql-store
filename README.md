# Simple NoSQL Store

A wrapper around Cloudant that smoothes out some edges. It simply allows JSON data to be stored in a hierarchy of database/collection/document. The user doesn't have to deal with

- design documents
- revision tokens

<iframe width="853" height="480" src="https://www.youtube.com/embed/gmnOmC_y1yc?rel=0&amp;controls=0&amp;showinfo=0" frameborder="0" allowfullscreen></iframe>

[![demo](http://img.youtube.com/vi/gmnOmC_y1yc/0.jpg)](http://www.youtube.com/watch?v=gmnOmC_y1yc "Simple NoSQL Store")

## Running

Set a `COUCH_URL` environment varible and run:

```sh
export COUCH_URL=https://myusername:mypassword@myhost.cloudant.com
node index.js
```

## API Reference

### PUT /db - Create a database

```sh
curl -X PUT http://localhost:3000/animals
```

### PUT /db/collection - Create a collection

```sh
curl -X PUT http://localhost:3000/animals/dogs
```

### POST /db/collection - Add a document

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

### POST /db/collection/id - Update a document

Provide a replacement document for hte document id supplied

```sh
curl -X POST -H 'Content-Type: application/json' -d '{"name": "Mitzie"}' http://localhost:3000/animals/dogs/d1
```

or supply key/value pairs to make up the replacement document:

```sh
curl -X POST -d 'name=fred&colour=black'  http://localhost:3000/animals/dogs/d1
```

### DELETE /db/collction/id - Delete a document

Delete a document with a known id

```sh
curl -X DELETE http://localhost:3000/animals/dogs/c976778f8d2b99be6fba29875f945e69
```

### GET /db/collection/id - Get a document

Retrieve a single document

```
curl http://localhost:3000/animals/dogs/5e12d4307b7420a3766b47cd7e8ac0a8
```

or retrieve multiple documents:

```
curl http://localhost:3000/animals/dogs/docid1,docid2,docid3
```

### GET /db/collection - Get all documents in a collection

```
curl http://localhost:3000/animals/dogs
```

### GET /db/collection? - Filter documents in a collection

Passing a selector object as the `_filter` parameter

```sh
# filter={"name":"Mitzie"}
curl 'http://localhost:3000/animals/dogs?_filter=%7B"name":"Mitzie"%7D'
```

or simple key value pairs to be AND'd together

```sh
curl 'http://localhost:3000/animals/dogs?name=sam&colour=brown'
```

### GET /db - Get a summary of a database

```sh
curl 'http://localhost:3000/animals'
```

## How it works

Cloudant is used as the underlying data store. When a database is created, a database is also created in Cloudant. At the same time we invisibly create the design documents to be able to query the data and aggregate the collection counts.

The concept of a 'collection' is handled by storing the documents like this:

```js
{
  "_id": "d4",
  "_rev": "1-977da55721863d11674b3691d5163f63",
  "name": "Tilly",
  "dob": "2015-01-02",
  "colour": "brown",
  "collection": "dogs"
 }
 ```

The `collection` key is added by this service and is filtered out (with the `_rev` token) when the user fetches a document.

```js
{
  "_id": "d4",
  "name": "Tilly",
  "dob": "2015-01-02",
  "colour": "brown"
 }
```

When the user supplies a query (`?colour=black&name=Tilly`) the app converts the query into a form the Cloudant Query would understand:

```js
{
	"$and": [{
		"collection": "dogs"
	}, {
		"colour": "black",
		"name": "Tilly"
	}]
}
```

Normally Cloudant requires updates and deletes to happen with a supplied _id and _rev pair because Cloudant uses a revision tree to store its documents. We simplify this, only requring the document's id (POST /db/collection/:id or DELETE /db/collection/:id). To achieve this, the app first GETs the document to find its revision token and tries to perform the operation. It will attempt this up to three times, backing off exponentially. We can't guarantee avoiding a conflict, but it does make changes easier for the user.

## To do

- We could implement a conflict resolution algorithm. 
- Limiting the numbers of returned documents
- Sorting of search results

