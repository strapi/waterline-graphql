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

    // Build GraphQL type system objects
    _.forEach(collections, function (collection, key) {
      self.buildType(collection, key);
    });

    // Build GraphQL query
    _.forEach(collections, function (collection, key) {
      queryFields.push(self.buildQueryFields(collection, key));
    });

    // Convert array of objects to object
    const fields = {};
    
    _.forEach(queryFields, function(field) {
      _.forEach(_.keys(field), function(key, index) {
        fields[key] = field[key];
      });
    });

    // Build GraphQL query object
    return new GraphQL.GraphQLObjectType({
      name: 'Schema',
      description: 'Root of the Schema',
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
      
                return self.params.collections[rules.collection.toLowerCase()].find().populateAll('', {
                  where: criteria
                });
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
    const collectionIdentity = _.capitalize(collection.adapter.identity);
    const fields = {};

    fields[collectionIdentity.toLowerCase()] = {
      type: this.params.types[collectionIdentity],
      args: {
        id: {
          name: 'id',
          type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLString)
        }
      },
      resolve: function (object, criteria, cache) {
        return collection.findOne({
          id: criteria.id
        }).populateAll();
      }
    };

    fields[collectionIdentity.toLowerCase() + 's'] = {
      type: new GraphQL.GraphQLList(this.params.types[collectionIdentity]),
      args: {
        limit: {
          name: 'limit',
          type: GraphQL.GraphQLInt
        },
        skip: {
          name: 'skip',
          type: GraphQL.GraphQLInt
        },
        sort: {
          name: 'sort',
          type: GraphQL.GraphQLString
        }
      },
      resolve: function (object, criteria, cache) {
        const filters = _.omit(criteria, function (value, key) {
          return _.isNull(value) || _.isUndefined(value);
        });

        return collection.find(filters).populateAll();
      }
    };

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
