# GraphQL adapter for Waterline

Inspired by [waterline-to-graphql adapter](https://github.com/agenthunt/waterline-to-graphql)

## Installation

Install the latest stable release with the npm command-line tool:

```bash
$ npm install waterline-graphql
```

## Usage

### From Waterline collections to GraphQL schemas

```javascript
// Import the adapter
const WaterlineGraphQL = require('waterline-graphql');

// Convert Waterline collections to GraphQL schemas
WaterlineGraphQL.getGraphQLSchema({
  collections: strapi.orm.collections,
  usefulFunctions: true
}, function (schemas) {
  // Use your schemas here...
});
```

### Execute GraphQL queries

```javascript
const graphql = require('graphql').graphql();

// Build your query
const query = '{ users{firstName lastName articles{title comments{text}}} }';

// Execute the query
graphql(schemas, query)
  .then(function (result) {
    console.log(result);
  })
  .catch(function (error) {
    console.log(error);
  });
```

## Configuration

```javascript
{
  collections: strapi.orm.collections // Required attributes
  usefulFunctions: true|false // Allow you to access to powerful useful functions
}
```

Note: If you are using standalone Waterline models, your models need to be patched with an
associations array. [See the issue here](https://github.com/balderdashy/waterline/issues/797).

## Complex queries

You can execute more complex queries like this.

This example will return 10 user's records sorted alphabetically by `firstName`:

```javascript
let query = '{ users(limit: 10, sort: "firstName ASC"){firstName lastName articles{title comments{text}}} }';
```

You can access to the 10 next users by adding the `skip` parameter:

```javascript
let query = '{ users(limit: 10, sort: "firstName ASC", skip: 10){firstName lastName articles{title comments{text}}} }';
```

And you also can select those records in a period between two dates:

```javascript
let query = '{ users(limit: 10, sort: "firstName ASC", skip: 10, start: "09/21/2015", end:" 09/22/2015"){firstName lastName articles{title comments{text}}} }';
```

## Useful functions (mutations)

### getLatestModel (count: Int!, start: Date, end: Date)

This example will return the five latest subscribers between the September 27th
and the September 28th 2015.

```javascript
let query = '{ getLatestUsers(count: 5, start: "9/27/2015", end: "9/28/2015") }';
```

### getFirstModel (count: Int!, start: Date, end: Date)

This example will return the five first articles from the September 27th 2015.

```javascript
let query = '{ getFirstArticles(count: 5, start: "9/27/2015") }';
```

### countModel (start: Date, end: Date)

This example will return the number of subscribers the September 28th 2015.

```javascript
let query = '{ countUsers(start: "9/28/2015", end: "9/28/2015") }';
```
