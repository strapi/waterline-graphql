'use strict';

// Public dependencies
const _ = require('lodash');
const GraphQL = require('graphql');

module.exports = {
  /*
   * Test
   */
  params: {
    collections: {},
    types: {}
  },

  getGraphQLSchema: function (collections) {
    if (_.isEmpty(collections)) {
      return 'Error: Empty object collections';
    }

    this.params.collections = collections;

    const Query = this.getQueries(collections);
    const Mutation = this.getMutations(collections);

    const Schema = new GraphQL.GraphQLSchema({
      query: Query
    });

    return Schema;
  },

  getQueries: function (collections) {
    const self = this;
    const queryFields = [];

    // Build type
    _.forEach(collections, function (collection, key) {
      self.buildType(collection, key);
    });

    // Build query
    _.forEach(collections, function (collection, key) {
      queryFields.push(self.buildQueryFields(collection, key));
    });

    // Convert array of object to object
    const fields = {};
    
    _.forEach(queryFields, function(field) {
      var key = _.keys(field)[0];
      fields[key] = field[key];
    });

    // Build GraphQL Query object
    return new GraphQL.GraphQLObjectType({
      name: 'AppSchema',
      description: 'Root of the AppSchema',
      fields: function() {
        return fields;
      }
    });
  },

  getMutations: function (collections) {
    const deferred = Promise.defer();

    deferred.resolve([]);

    return deferred.promise;
  },

  buildType: function (collection, key) {
    const self = this;
    const collectionIdentity = _.capitalize(collection.adapter.identity);
    const collectionAttributes = collection._attributes;
    const collectionAssociations = collection.associations;

    const Type = new GraphQL.GraphQLObjectType({
      name: _.capitalize(collectionIdentity),
      description: 'This represents a/an ' + _.capitalize(collectionIdentity),
      fields: function () {
        const fields = {};

        _.forEach(collectionAttributes, function (rules, key) {
          if (rules.hasOwnProperty('model')) {
            fields[key] = {
              type: self.params.types[_.capitalize(rules.model)],
              resolve: function (object) {
                return self.params.collections[rules.model.toLowerCase()].findOne({
                  id: object.id
                }).populateAll();
              }
            };
          } else if (rules.hasOwnProperty('collection')) {
            fields[key] = {
              type: new GraphQL.GraphQLList(self.params.types[_.capitalize(rules.collection)]),
              resolve: function (object) {
                const criteria = {};
                criteria[rules.via.toLowerCase()] = object.id;

                return self.params.collections[rules.collection.toLowerCase()].find(criteria).populateAll();
              }
            };
          } else {
            fields[key] = {
              type: rules.required ? new GraphQL.GraphQLNonNull(convertToGraphQLType(rules)) : convertToGraphQLType(rules)
            };
          }
        });

        return fields;
      }
    });
  
    // Save to global parameters
    this.params.types[collectionIdentity] = Type;
  },

  buildQueryFields: function (collection, key) {
    const self = this;
    const collectionIdentity = _.capitalize(collection.adapter.identity);

    let fields = {};

    fields[collectionIdentity.toLowerCase()] = {
      type: self.params.types[collectionIdentity],
      args: {
        id: {
          name: 'id',
          type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLString)
        }
      },
      resolve: function (object, criteria, cache) {
        return collection.findOne({
          id: criteria.id
        });
      }
    };

    // fields[collectionIdentity.toLowerCase()] = {
    //   type: new GraphQL.GraphQLList(self.params.types[collectionIdentity]),
    //   resolve: function (object, criteria, cache) {
    //     return collection.find({
    //       id: criteria.id
    //     });
    //   }
    // };

    return fields;
  },

  buildMutation: function (collection, key) {
    const deferred = Promise.defer();

    console.log("Mutation: " + key);

    deferred.resolve();

    return deferred.promise;
  }
};

// Helpers

/*
 * Convert Waterline type to GraphQL type system
 *
 * @return {Object}
 */
function convertToGraphQLType (rules) {
  switch (rules.type.toLowerCase()) {
    case 'string':
      return GraphQL.GraphQLString;
    case 'integer':
      return GraphQL.GraphQLInt;
    case 'boolean':
      return GraphQL.GraphQLBoolean;
    case 'float':
      return GraphQL.GraphQLFloat;
    default:
      return GraphQL.GraphQLString;
  }
}
