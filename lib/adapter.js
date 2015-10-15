'use strict';

// Public dependencies
const _ = require('lodash');
const GraphQL = require('graphql');

module.exports = {
  /*
   * Test
   */
  params: {
    collections: null
  },

  getGraphQLSchema: function (collections) {
    const deferred = Promise.defer();

    const self = this;

    if (_.isEmpty(collections)) {
      return cb('Error: Empty object collections');
    }

    this.params.collections = collections;

    Promise.all([
      self.getQueries(collections),
      self.getMutations(collections)
      ])
      .then(function (results) {

        const Query = _.first(results);
        const Mutation = _.last(results);

        const Schema = new GraphQL.GraphQLSchema({
          query: Query,
          mutation: Mutation
        });

        deferred.resolve(Schema);
      })
      .catch(function (err) {
        console.log(err);
        deferred.reject(err);
      });

    return deferred.promise;
  },

  getQueries: function (collections) {
    const deferred = Promise.defer();

    const self = this;
    const arrayOfPromises = [];

    _.forEach(collections, function (collection, key) {
      arrayOfPromises.push(self.buildType(collection, key));
    });

    Promise.all(arrayOfPromises)
      .then(function (types) {
        const arrayOfPromises = [];
        let count = 0;

        _.forEach(collections, function (collection, key) {
          arrayOfPromises.push(self.buildQueryFields(types[count], collection, key));
          ++count;
        });

        Promise.all(arrayOfPromises)
          .then(function (queryFields) {
            const fields = {};

            // Convert array of object to object
            _.forEach(queryFields, function(field) {
              var key = _.keys(field)[0];
              fields[key] = field[key];
            });

            const Query = new GraphQL.GraphQLObjectType({
              name: 'AppSchema',
              description: 'Root of the AppSchema',
              fields: function() {
                return fields;
              }
            });

            deferred.resolve(Query);
          })
          .catch(function (err){
            deferred.reject(err);
          });
      })
      .catch(function (err) {
        deferred.reject(err);
      });

    return deferred.promise;
  },

  getMutations: function (collections) {
    const deferred = Promise.defer();


    deferred.resolve([]);

    return deferred.promise;
  },

  buildType: function (collection, key) {
    const deferred = Promise.defer();

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
              type: _.capitalize(rules.model),
              resolve: function (object) {
                return self.params.collections[rules.model.toLowerCase()].findOne({
                  id: object.id
                });
              }
            };
          } else if (rules.hasOwnProperty('collection')) {
            fields[key] = {
              type: _.capitalize(rules.collection),
              resolve: function (object) {
                const criteria = {};
                criteria[rules.via.toLowerCase()] = object.id;

                return self.params.collections[rules.model.toLowerCase()].find(criteria);
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

    deferred.resolve(Type);

    return deferred.promise;
  },

  buildQueryFields: function (type, collection, key) {
    const deferred = Promise.defer();

    const collectionIdentity = _.capitalize(collection.adapter.identity);

    let fields = {};

    fields[collectionIdentity.toLowerCase()] = {
      type: new GraphQL.GraphQLList(type),
      resolve: function (object, criteria) {
        return collection.findOne({id: criteria.id});
      }
    };

    deferred.resolve(fields);

    return deferred.promise;
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
